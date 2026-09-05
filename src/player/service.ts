import Constants from 'expo-constants';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';

import {
  COMPLETION_TAIL_SECONDS,
  getEpisode,
  markPlayed,
  savePosition,
} from '@/db/episodes';
import { dequeue, enqueueFront, nextInQueue } from '@/db/queue';
import { deleteDownload, getLocalEpisodePath } from '@/player/downloads';
import { getMeta, getSettings, setMeta } from '@/db/settings';
import type { EpisodeWithFeed } from '@/db/types';

/** Playback rates offered in the UI, and cycled through by the rate button. */
export const PLAYBACK_RATES = [0.8, 1, 1.2, 1.5, 1.75, 2, 2.5, 3] as const;

export type PlayerState = {
  episode: EpisodeWithFeed | null;
  /** Seconds into the episode. */
  position: number;
  /** Episode length in seconds — from the feed until the file reports its own. */
  duration: number;
  playing: boolean;
  buffering: boolean;
  /** Playback rate currently applied to the audio engine. */
  rate: number;
  /** Epoch ms at which the sleep timer fires, or null when it is off. */
  sleepTimerEndsAt: number | null;
  error: string | null;
};

const INITIAL_STATE: PlayerState = {
  episode: null,
  position: 0,
  duration: 0,
  playing: false,
  buffering: false,
  rate: 1,
  sleepTimerEndsAt: null,
  error: null,
};

/** How often the engine reports status, and therefore how often the UI ticks. */
const STATUS_INTERVAL_MS = 500;
/** How often the current position is written to the database. */
const POSITION_SAVE_INTERVAL_MS = 5_000;

type Subscriber = (state: PlayerState) => void;

/**
 * The app's single playback engine.
 *
 * Deliberately a module singleton rather than React state: playback outlives
 * any screen, keeps running when the app is backgrounded, and is driven from
 * the lock screen and notification shade where no component is mounted. The
 * React layer subscribes to it (see `PlayerProvider`), never the reverse.
 */
class PlayerService {
  private player: AudioPlayer | null = null;
  private state: PlayerState = INITIAL_STATE;
  private subscribers = new Set<Subscriber>();

  private statusSubscription: { remove: () => void } | null = null;
  private saveHandle: ReturnType<typeof setInterval> | null = null;
  private sleepHandle: ReturnType<typeof setTimeout> | null = null;
  /** Epoch ms when playback was last paused, for smart resume rewind. */
  private lastPausedAt: number | null = null;

  /** Guards against the double-advance a repeated `didJustFinish` would cause. */
  private finishing = false;
  /** Suppresses position writes while a seek is in flight. */
  private seeking = false;
  private audioModeReady = false;

  // ---------------------------------------------------------------- lifecycle

  /**
   * Configures the audio session and restores the last-played episode.
   *
   * The episode is loaded paused, at its saved position, so reopening the app
   * shows the player where the listener left it without any sound starting.
   */
  async init(): Promise<void> {
    await this.ensureAudioMode();

    const lastId = await getMeta('lastEpisodeId');
    if (!lastId) return;

    const episode = await getEpisode(Number(lastId));
    if (episode) await this.load(episode, { autoPlay: false });
  }

  private async ensureAudioMode(): Promise<void> {
    if (this.audioModeReady) return;
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      // Spoken audio should stop other audio rather than talk over it.
      interruptionMode: 'doNotMix',
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    });
    this.audioModeReady = true;
  }

  // ---------------------------------------------------------------- subscribe

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.state);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  getState(): PlayerState {
    return this.state;
  }

  private setState(patch: Partial<PlayerState>): void {
    this.state = { ...this.state, ...patch };
    for (const subscriber of this.subscribers) subscriber(this.state);
  }

  // ------------------------------------------------------------------- loading

  /**
   * Loads an episode into the engine.
   *
   * Prefers a completed download over the network URL, so a downloaded episode
   * plays offline and costs no data.
   */
  async load(
    episode: EpisodeWithFeed,
    options: { autoPlay?: boolean; startAt?: number } = {}
  ): Promise<void> {
    const { autoPlay = true } = options;

    if (this.state.episode?.id === episode.id && this.player) {
      if (autoPlay) this.play();
      return;
    }

    await this.ensureAudioMode();
    await this.flushPosition();
    this.teardownPlayer();

    const settings = getSettings();
    const localUri = episode.download_state === 'done' ? getLocalEpisodePath(episode) : null;
    const source = localUri ?? episode.media_url;

    const skipIntro = episode.feed_skip_intro_seconds ?? 0;
    // Only rewind on resume when the listener has been away long enough to
    // have lost context — a quick pause-unpause should not jump backwards.
    const pauseGapMs = this.lastPausedAt ? Date.now() - this.lastPausedAt : Infinity;
    const shouldRewind = pauseGapMs > 5 * 60_000; // 5 minutes
    let startAt =
      options.startAt ??
      (shouldRewind && episode.position > settings.resumeRewind
        ? episode.position - settings.resumeRewind
        : episode.position);

    if (startAt < skipIntro) {
      startAt = skipIntro;
    }

    const rate = episode.feed_playback_speed ?? settings.playbackRate;

    this.setState({
      episode,
      position: startAt,
      duration: episode.duration ?? 0,
      playing: false,
      buffering: true,
      rate,
      error: null,
    });

    const player = createAudioPlayer(source, {
      updateInterval: STATUS_INTERVAL_MS,
      keepAudioSessionActive: true,
    });
    this.player = player;

    this.statusSubscription = player.addListener('playbackStatusUpdate', (status) =>
      this.onStatus(status)
    );

    player.shouldCorrectPitch = true;
    player.setPlaybackRate(rate, 'high');

    this.publishLockScreenMetadata(episode);
    await setMeta('lastEpisodeId', String(episode.id));

    if (startAt > 0) {
      try {
        await player.seekTo(startAt);
      } catch {
        // A seek before the media has loaded its duration can fail; the
        // position is restored again on the first status update instead.
      }
    }

    if (autoPlay) this.play();
    this.startPositionSaver();
  }

  /** Loads an episode by id — used by deep links and the lock screen. */
  async loadById(episodeId: number, options: { autoPlay?: boolean } = {}): Promise<void> {
    const episode = await getEpisode(episodeId);
    if (!episode) return;
    await this.load(episode, options);
  }

  /** Plays an episode, moving it to the front of the queue first. */
  async playEpisode(episode: EpisodeWithFeed): Promise<void> {
    await enqueueFront(episode.id);
    await this.load(episode, { autoPlay: true });
  }

  private publishLockScreenMetadata(episode: EpisodeWithFeed): void {
    // Expo Go does not include the native AudioControlsService foreground service
    // in its pre-compiled manifest. Attempting to activate lock screen controls in
    // Expo Go triggers a native service binding failure.
    if (Constants.appOwnership === 'expo') return;

    try {
      this.player?.setActiveForLockScreen(
        true,
        {
          title: episode.title,
          artist: episode.feed_author ?? episode.feed_title,
          albumTitle: episode.feed_title,
          artworkUrl: episode.image_url ?? episode.feed_image_url ?? undefined,
        },
        { showSeekForward: true, showSeekBackward: true, isLiveStream: false }
      );
    } catch {
      // Graceful fallback if native lock screen binding fails.
    }
  }

  private teardownPlayer(): void {
    this.stopPositionSaver();
    this.statusSubscription?.remove();
    this.statusSubscription = null;

    if (this.player) {
      try {
        if (Constants.appOwnership !== 'expo') {
          this.player.clearLockScreenControls();
        }
        this.player.remove();
      } catch {
        // The engine may already have released the player; nothing to undo.
      }
      this.player = null;
    }
  }

  // -------------------------------------------------------------- status loop

  private onStatus(status: AudioStatus): void {
    if (!this.player) return;

    if (status.error) {
      this.setState({ error: status.error, buffering: false, playing: false });
      return;
    }

    const duration =
      status.duration > 0 ? status.duration : this.state.duration || this.state.episode?.duration || 0;

    if (!this.seeking) {
      this.setState({
        position: status.currentTime,
        duration,
        playing: status.playing,
        buffering: status.isBuffering,
        rate: status.playbackRate || this.state.rate,
      });
    } else {
      this.setState({ duration, playing: status.playing, buffering: status.isBuffering });
    }

    if (status.didJustFinish) void this.onFinished();
  }

  // -------------------------------------------------------------- transport

  play(): void {
    if (!this.player) return;
    this.player.play();
    this.setState({ playing: true, error: null });
    this.startPositionSaver();
  }

  pause(): void {
    if (!this.player) return;
    this.player.pause();
    this.lastPausedAt = Date.now();
    this.setState({ playing: false });
    void this.flushPosition();
  }

  togglePlayPause(): void {
    if (this.state.playing) this.pause();
    else this.play();
  }

  /** Seeks to an absolute position, clamped to the episode. */
  async seekTo(seconds: number): Promise<void> {
    if (!this.player) return;

    const max = this.state.duration || Number.MAX_SAFE_INTEGER;
    const target = Math.max(0, Math.min(seconds, max));

    this.seeking = true;
    this.setState({ position: target });
    try {
      await this.player.seekTo(target);
    } finally {
      this.seeking = false;
    }
    await this.flushPosition();
  }

  /** Skips forward by the user's configured interval. */
  async skipForward(): Promise<void> {
    await this.seekTo(this.state.position + getSettings().skipForward);
  }

  /** Rewinds by the user's configured interval. */
  async skipBackward(): Promise<void> {
    await this.seekTo(this.state.position - getSettings().skipBackward);
  }

  setRate(rate: number): void {
    if (!this.player) return;
    // 'high' pitch correction keeps speech natural at 1.5x-3x, which is where
    // podcast listeners actually live.
    this.player.setPlaybackRate(rate, 'high');
    this.setState({ rate });
  }

  /** Advances to the next rate in `PLAYBACK_RATES`, wrapping around. */
  cycleRate(): number {
    const index = PLAYBACK_RATES.findIndex((rate) => Math.abs(rate - this.state.rate) < 0.01);
    const next = PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length];
    this.setRate(next);
    return next;
  }

  // ------------------------------------------------------------------- queue

  /** Marks the finished episode played and starts the next queued one. */
  private async onFinished(): Promise<void> {
    if (this.finishing) return;
    this.finishing = true;

    try {
      const finished = this.state.episode;
      if (!finished) return;

      const settings = getSettings();
      await markPlayed(finished.id, true);
      if (settings.removeFromQueueWhenFinished) await dequeue(finished.id);

      // Reclaim the space a finished episode's audio was using, if the
      // listener asked us to.
      if (settings.deleteAfterFinished && finished.download_state === 'done') {
        await deleteDownload(finished.id);
      }

      if (!settings.continuousPlayback) {
        this.setState({ playing: false, position: 0 });
        return;
      }

      const next = await nextInQueue(finished.id);
      if (next) await this.load(next, { autoPlay: true });
      else this.setState({ playing: false, position: 0 });
    } finally {
      this.finishing = false;
    }
  }

  /** Skips the current episode without marking it played. */
  async skipToNext(): Promise<void> {
    const current = this.state.episode;
    const next = await nextInQueue(current?.id ?? null);
    if (next) {
      await this.load(next, { autoPlay: true });
    } else {
      this.pause();
    }
  }

  // -------------------------------------------------------- position persistence

  private lastFlushPosition: number = 0;

  private startPositionSaver(): void {
    if (this.saveHandle) return;
    this.lastFlushPosition = this.state.position;
    this.saveHandle = setInterval(() => {
      if (this.state.playing) {
        // Calculate time played at current playback rate
        const secondsPlayed = (POSITION_SAVE_INTERVAL_MS / 1000) * this.state.rate;
        void this.flushPosition(secondsPlayed);
      } else {
        void this.flushPosition();
      }
    }, POSITION_SAVE_INTERVAL_MS);
  }

  private stopPositionSaver(): void {
    if (!this.saveHandle) return;
    clearInterval(this.saveHandle);
    this.saveHandle = null;
  }

  /**
   * Writes the current position to the database.
   *
   * Runs on a timer while playing and on every pause, seek and track change, so
   * that a force-quit or a battery death loses at most a few seconds.
   */
  async flushPosition(listenedSeconds: number = 0): Promise<void> {
    const { episode, position, duration } = this.state;
    if (!episode || position <= 0) return;

    if (listenedSeconds > 0) {
      // Lazy-import to avoid cyclic dependencies if any
      const { addListenedSeconds } = require('@/db/stats');
      await addListenedSeconds(episode.feed_id, episode.id, listenedSeconds);
    }

    // Treat "almost the end" as finished so the episode does not linger in
    // Continue Listening with 8 seconds of outro left.
    if (duration > 0 && position >= duration - COMPLETION_TAIL_SECONDS) {
      await markPlayed(episode.id, true);
      return;
    }

    await savePosition(episode.id, position, duration || null);
  }

  // ------------------------------------------------------------- sleep timer

  private shakeSubscription: any = null;
  private sleepMinutes: number = 0;

  /** Starts the sleep timer to fire when the current episode finishes. */
  startSleepTimerUntilEndOfEpisode(): void {
    const { position, duration } = this.state;
    const remainingSeconds = Math.max(10, (duration || 0) - position);
    this.startSleepTimer(remainingSeconds / 60);
  }

  /** Starts (or restarts) the sleep timer. */
  startSleepTimer(minutes: number): void {
    this.cancelSleepTimer();
    this.sleepMinutes = minutes;
    const endsAt = Date.now() + minutes * 60_000;

    this.sleepHandle = setTimeout(() => {
      this.pause();
      this.cancelSleepTimer();
    }, minutes * 60_000);

    this.setState({ sleepTimerEndsAt: endsAt });

    Accelerometer.setUpdateInterval(100);
    this.shakeSubscription = Accelerometer.addListener(({ x, y, z }) => {
      // AntennaPod uses ~2.25g as the threshold for a "shake"
      const gForce = Math.sqrt(x * x + y * y + z * z);
      if (gForce > 2.25) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        this.startSleepTimer(this.sleepMinutes);
      }
    });
  }

  cancelSleepTimer(): void {
    if (this.sleepHandle) clearTimeout(this.sleepHandle);
    this.sleepHandle = null;
    this.sleepMinutes = 0;

    if (this.shakeSubscription) {
      this.shakeSubscription.remove();
      this.shakeSubscription = null;
    }

    this.setState({ sleepTimerEndsAt: null });
  }

  /** Stops playback and unloads the current episode. */
  async stop(): Promise<void> {
    await this.flushPosition();
    this.cancelSleepTimer();
    this.teardownPlayer();
    this.setState({ ...INITIAL_STATE });
  }
}

export const player = new PlayerService();
