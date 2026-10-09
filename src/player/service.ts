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
  getEpisode,
  markPlayed,
  savePosition,
} from '@/db/episodes';
import { setFeedFlags, type FeedPrefs } from '@/db/feeds';
import { dequeue, enqueueFront, nextInQueue } from '@/db/queue';
import { deleteDownload, getLocalEpisodePath } from '@/player/downloads';
import { getMeta, getSettings, setMeta, setSetting, subscribeSettings } from '@/db/settings';
import type { EpisodeWithFeed } from '@/db/types';
import { confirmMeteredStreaming } from '@/player/meteredGuard';
import { afterSkip, almostEnded } from '@/player/playedRules';
import { positionAfterPause } from '@/player/resumeRewind';
import { clampSpeed } from '@/player/speed';
import { basicAuthHeader } from '@/feed/auth';
import { feedCredentialsFor } from '@/feed/credentials';
import { boolOverride, boostMillibels, playerVolume, resolveOverride, shouldSkipEnding } from '@/feed/feedPrefs';
import { lockScreenOptions, onRemoteNext, setSkipSilence, setVolumeBoost } from '@/player/audioExtras';
import {
  afterEpisodeFinished,
  extendTimer,
  fadeVolume,
  inHourWindow,
  pauseTimer,
  remainingMs,
  resumeTimer,
  SLEEP_WARNING_MS,
  startEpisodesTimer,
  startMinutesTimer,
  type SleepTimer,
} from '@/player/sleepTimer';

/** Speed choices in Settings and podcast settings (the player sheet uses editable presets). */
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
  /** The active sleep timer, or null when it is off. */
  sleepTimer: SleepTimer | null;
  error: string | null;
};

const INITIAL_STATE: PlayerState = {
  episode: null,
  position: 0,
  duration: 0,
  playing: false,
  buffering: false,
  rate: 1,
  sleepTimer: null,
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
  private remoteNextSubscription: { remove: () => void } | null = null;
  /** The skip amounts and skip-silence choice last handed to the engine. */
  private appliedControls = '';
  private saveHandle: ReturnType<typeof setInterval> | null = null;
  private sleepHandle: ReturnType<typeof setTimeout> | null = null;
  /**
   * Epoch ms when the current episode was last paused (or, right after a
   * load, last listened to). The next resume rewinds by how long ago that was.
   */
  private lastPausedAt: number | null = null;
  /** Last play state reported by the engine, to spot real transitions. */
  private enginePlaying = false;

  /** Guards against the double-advance a repeated `didJustFinish` would cause. */
  private finishing = false;
  /**
   * The loaded episode was just marked played (finished or skipped). Marking
   * played resets its stored position, so the flush in the next load() must
   * not write the old one back.
   */
  private markedPlayedId: number | null = null;
  /** Set once the current episode's "skip ending" has fired, so it fires once. */
  private skippedEnding = false;
  /** The player volume for the podcast's volume reduction (1 = none or a boost); the sleep fade scales from it. */
  private baseVolume = 1;
  /** Suppresses position writes while a seek is in flight. */
  private seeking = false;
  private audioModeReady = false;
  private initPromise: Promise<void> | null = null;

  // ---------------------------------------------------------------- lifecycle

  /**
   * Configures the audio session and restores the last-played episode.
   *
   * The episode is loaded paused, at its saved position, so reopening the app
   * shows the player where the listener left it without any sound starting.
   */
  init(): Promise<void> {
    // Once per runtime: a widget tap may have started the app before its screens.
    this.initPromise ??= this.restore().catch((error: unknown) => {
      this.initPromise = null;
      throw error;
    });
    return this.initPromise;
  }

  private async restore(): Promise<void> {
    await this.ensureAudioMode();
    subscribeSettings(() => this.applyControlSettings());

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
    options: {
      autoPlay?: boolean;
      startAt?: number;
      /** False when no one tapped anything (the queue advancing): don't ask, just don't stream. */
      interactive?: boolean;
    } = {}
  ): Promise<void> {
    let { autoPlay = true } = options;
    const interactive = options.interactive ?? true;

    if (this.state.episode?.id === episode.id && this.player) {
      if (autoPlay) this.play();
      return;
    }

    // Settings › Downloads › Mobile data › Streaming: ask before streaming
    // over mobile data, or load paused when the queue advances on its own.
    if (autoPlay && !(await confirmMeteredStreaming(episode, { ask: interactive }))) {
      if (interactive) return;
      autoPlay = false;
    }

    await this.ensureAudioMode();
    await this.flushPosition();
    this.markedPlayedId = null;
    this.teardownPlayer();

    const settings = getSettings();
    const localUri = episode.download_state === 'done' ? getLocalEpisodePath(episode) : null;
    const source = localUri ?? episode.media_url;
    // A password-protected podcast's stream, from the feed's own host.
    const auth = localUri ? null : await feedCredentialsFor(episode.feed_id, source);

    const skipIntro = episode.feed_skip_intro_seconds ?? 0;
    let startAt = options.startAt ?? episode.position;
    // Load at the saved position and let the first resume apply the rewind,
    // measured from when this episode was last listened to. Rewinding here
    // instead would shrink the saved position every time the app restores a
    // paused episode, even if nothing is ever played.
    this.lastPausedAt = options.startAt === undefined ? (episode.played_at ?? null) : null;
    this.enginePlaying = false;
    this.skippedEnding = false;

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

    const player = createAudioPlayer(auth ? { uri: source, headers: { Authorization: basicAuthHeader(auth) } } : source, {
      updateInterval: STATUS_INTERVAL_MS,
      keepAudioSessionActive: true,
    });
    this.player = player;

    this.statusSubscription = player.addListener('playbackStatusUpdate', (status) =>
      this.onStatus(status)
    );
    // The lock screen's and notification's next button.
    this.remoteNextSubscription = onRemoteNext(player, () => void this.skipToNext());

    player.shouldCorrectPitch = true;
    player.setPlaybackRate(rate, 'high');
    // Per-podcast volume adaptation (AntennaPod: reductions and boosts).
    this.applyVolume(episode.feed_volume_reduction);
    setSkipSilence(player, settings.skipSilence);

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
        // The patched engine reads the amounts and next button (src/player/audioExtras.ts).
        lockScreenOptions(getSettings().skipForward, getSettings().skipBackward)
      );
      this.appliedControls = controlsKey();
    } catch {
      // Graceful fallback if native lock screen binding fails.
    }
  }

  private teardownPlayer(): void {
    this.stopPositionSaver();
    this.statusSubscription?.remove();
    this.statusSubscription = null;
    this.remoteNextSubscription?.remove();
    this.remoteNextSubscription = null;

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

    // Pauses and resumes can come from outside the app (lock screen,
    // headphones, a phone call), so follow the engine's own transitions —
    // not our optimistic `state.playing`, which flips before audio starts.
    if (status.playing !== this.enginePlaying) {
      this.enginePlaying = status.playing;
      this.onEnginePlayingChanged(status.playing);
    }

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
    else if (
      !this.skippedEnding &&
      !this.finishing &&
      status.playing &&
      shouldSkipEnding(status.currentTime, duration, this.state.episode?.feed_skip_ending_seconds ?? null)
    ) {
      // The podcast's "skip ending": treat the outro as the end of the episode.
      this.skippedEnding = true;
      this.player.pause();
      void this.onFinished();
    }
  }

  // -------------------------------------------------------------- transport

  play(): void {
    if (!this.player) return;
    // Listening again to an episode that just finished: save its position again.
    this.markedPlayedId = null;

    this.applyResumeRewind();
    this.maybeAutoEnableSleepTimer();
    this.player.play();
    this.setState({ playing: true, error: null });
    this.startPositionSaver();
  }

  pause(): void {
    if (!this.player) return;
    this.player.pause();
    this.lastPausedAt = Date.now();
    this.setState({ playing: false });
    this.syncSleepTimer(false);
    void this.flushPosition();
  }

  /**
   * Lets go of the episode before the database is replaced (Restore backup):
   * its position is saved into the old data first, and nothing afterwards can
   * write it into the restored one. The app restarts straight after.
   */
  async release(): Promise<void> {
    if (this.state.playing) this.player?.pause();
    await this.flushPosition();
    this.teardownPlayer();
  }

  togglePlayPause(): void {
    if (this.state.playing) this.pause();
    else this.play();
  }

  /** Backs up by the pause-scaled amount if the episode was paused; once per pause. */
  private applyResumeRewind(): void {
    const pausedAt = this.lastPausedAt;
    this.lastPausedAt = null;
    if (pausedAt === null || !getSettings().rewindOnResume) return;

    const target = positionAfterPause(this.state.position, Date.now() - pausedAt);
    if (target < this.state.position) {
      // seekTo() raises the `seeking` guard, so a status tick can't snap the
      // position back before the engine has moved.
      void this.seekTo(target).catch(() => {
        // Losing a sub-second rewind is harmless; never block playback on it.
      });
    }
  }

  /** Engine-reported play/pause, including ones from outside the app. */
  private onEnginePlayingChanged(playing: boolean): void {
    this.syncSleepTimer(playing);
    if (playing) {
      this.maybeAutoEnableSleepTimer();
      // A resume we didn't initiate (lock screen, headset): rewind here.
      // play() already consumed lastPausedAt for in-app resumes.
      this.applyResumeRewind();
    } else if (this.lastPausedAt === null && !this.finishing) {
      // A pause we didn't initiate: remember it and save the position now.
      this.lastPausedAt = Date.now();
      void this.flushPosition();
    }
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

  /**
   * The speed sheet's choice: applies it now and keeps it, on the podcast if
   * that podcast has its own speed, otherwise as the global speed.
   */
  async setSpeed(rate: number): Promise<void> {
    const value = clampSpeed(rate);
    this.setRate(value);
    const episode = this.state.episode;
    if (episode && episode.feed_playback_speed !== null) {
      this.setState({ episode: { ...episode, feed_playback_speed: value } });
      await setFeedFlags(episode.feed_id, { playbackSpeed: value });
    } else {
      await setSetting('playbackRate', value);
    }
  }

  /**
   * A podcast's settings changed while one of its episodes is loaded: carry
   * the new values into the cached episode so speed, skip ending, volume and
   * auto-delete follow them now rather than from the next episode.
   */
  applyFeedPrefs(feedId: number, prefs: Partial<FeedPrefs>, globalRate: number): void {
    const episode = this.state.episode;
    if (!episode || episode.feed_id !== feedId) return;
    const next = { ...episode };
    if (prefs.playbackSpeed !== undefined) next.feed_playback_speed = prefs.playbackSpeed;
    if (prefs.skipIntroSeconds !== undefined) next.feed_skip_intro_seconds = prefs.skipIntroSeconds;
    if (prefs.skipEndingSeconds !== undefined) next.feed_skip_ending_seconds = prefs.skipEndingSeconds;
    if (prefs.volumeReduction !== undefined) next.feed_volume_reduction = prefs.volumeReduction;
    if (prefs.autoDelete !== undefined) next.feed_auto_delete = prefs.autoDelete === null ? null : prefs.autoDelete ? 1 : 0;
    this.setState({ episode: next });
    if (prefs.playbackSpeed !== undefined) this.setRate(prefs.playbackSpeed ?? globalRate);
    if (prefs.volumeReduction !== undefined) this.applyVolume(prefs.volumeReduction);
  }

  /** A reduction lowers the player volume; a boost adds gain on top of full volume. */
  private applyVolume(factor: number | null): void {
    this.baseVolume = playerVolume(factor);
    if (!this.player) return;
    // A sleep fade in progress picks the new base up on its next tick.
    if (!this.inWarning) this.player.volume = this.baseVolume;
    setVolumeBoost(this.player, boostMillibels(factor));
  }

  /** Skip amounts and skip silence changed in Settings: hand them to the loaded episode now. */
  private applyControlSettings(): void {
    const key = controlsKey();
    if (!this.player || !this.state.episode || key === this.appliedControls) return;
    setSkipSilence(this.player, getSettings().skipSilence);
    this.publishLockScreenMetadata(this.state.episode);
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
      this.markedPlayedId = finished.id;
      // Find what follows before removing the finished episode: once it is
      // gone, "the episode after it" can't be looked up and the head would
      // play instead, jumping back if it was played from mid-queue (or
      // sorted there by Keep sorted).
      const next = await nextInQueue(finished.id);
      if (settings.removeFromQueueWhenFinished) await dequeue(finished.id);

      // Reclaim the space a finished episode's audio was using, if the
      // listener asked us to.
      const autoDelete = resolveOverride(boolOverride(finished.feed_auto_delete), settings.deleteAfterFinished).value;
      if (autoDelete && finished.download_state === 'done') {
        await deleteDownload(finished.id);
      }

      // An episodes sleep timer counts finished episodes; on the last one,
      // stop here instead of advancing.
      if (this.state.sleepTimer?.kind === 'episodes') {
        const { timer, stop } = afterEpisodeFinished(this.state.sleepTimer);
        if (stop) {
          this.cancelSleepTimer();
          this.setState({ playing: false, position: 0 });
          return;
        }
        this.setState({ sleepTimer: timer });
      }

      if (!settings.continuousPlayback) {
        this.setState({ playing: false, position: 0 });
        return;
      }

      if (next) await this.load(next, { autoPlay: true, interactive: false });
      else this.setState({ playing: false, position: 0 });
    } finally {
      this.finishing = false;
    }
  }

  /**
   * Skips to the next queued episode. The skipped one stays unplayed and
   * queued, unless it was nearly over ("Smart mark as played") or "Keep
   * skipped episodes" is off — then it is marked played and may leave the queue.
   */
  async skipToNext(): Promise<void> {
    const current = this.state.episode;
    const next = await nextInQueue(current?.id ?? null);
    if (current) {
      const settings = getSettings();
      const outcome = afterSkip({
        position: this.state.position,
        duration: this.state.duration,
        smartMarkSeconds: settings.smartMarkSeconds,
        keepSkipped: settings.keepSkippedEpisodes,
        removeFinishedFromQueue: settings.removeFromQueueWhenFinished,
      });
      if (outcome.markPlayed) {
        await markPlayed(current.id, true);
        this.markedPlayedId = current.id;
      }
      if (outcome.dequeue) await dequeue(current.id);
    }
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
      // Only while playing: a paused episode was already saved by pause(), and
      // re-saving it would refresh played_at, which the resume rewind reads as
      // "last listened".
      if (!this.state.playing) return;
      const secondsPlayed = (POSITION_SAVE_INTERVAL_MS / 1000) * this.state.rate;
      void this.flushPosition(secondsPlayed);
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
    if (!episode || position <= 0 || episode.id === this.markedPlayedId) return;

    if (listenedSeconds > 0) {
      // Lazy-import to avoid cyclic dependencies if any
      const { addListenedSeconds } = require('@/db/stats');
      await addListenedSeconds(episode.feed_id, episode.id, listenedSeconds);
    }

    // "Smart mark as played": stopping in the last few seconds counts as
    // finishing, so the episode doesn't linger in Continue Listening with only
    // an outro left. Only when stopped — the periodic save while playing must
    // keep the real position, or a long threshold would lose it mid-listen.
    if (!this.state.playing && almostEnded(position, duration, getSettings().smartMarkSeconds)) {
      await markPlayed(episode.id, true);
      return;
    }

    await savePosition(episode.id, position, duration || null);
  }

  // ------------------------------------------------------------- sleep timer

  private shakeSubscription: { remove: () => void } | null = null;
  private warningHandle: ReturnType<typeof setInterval> | null = null;
  private inWarning = false;

  /** Pauses after `count` episodes finish (1 = at the end of this one). No clock. */
  startEpisodesSleepTimer(count = 1): void {
    this.cancelSleepTimer();
    this.setState({ sleepTimer: startEpisodesTimer(count) });
  }

  /** Starts (or restarts) a countdown that only runs while audio plays. */
  startSleepTimer(minutes: number): void {
    this.cancelSleepTimer();
    this.setState({ sleepTimer: startMinutesTimer(minutes, Date.now(), this.state.playing) });
    this.scheduleSleepTimeout();
  }

  /** "+5 min" / "+1 episode": extends the running timer. */
  extendSleepTimer(amount: number): void {
    const timer = this.state.sleepTimer;
    if (!timer) return;
    this.setState({ sleepTimer: extendTimer(timer, amount) });
    this.scheduleSleepTimeout();
  }

  cancelSleepTimer(): void {
    this.clearSleepHandles();
    this.leaveWarning();
    if (this.state.sleepTimer) this.setState({ sleepTimer: null });
  }

  /** AntennaPod's auto-enable: starting playback inside the hour window arms the timer. */
  private maybeAutoEnableSleepTimer(): void {
    const settings = getSettings();
    if (this.state.sleepTimer || !settings.sleepAutoEnable) return;
    if (inHourWindow(new Date().getHours(), settings.sleepAutoFrom, settings.sleepAutoTo)) {
      this.setState({ sleepTimer: startMinutesTimer(settings.sleepMinutes, Date.now(), true) });
      this.scheduleSleepTimeout();
    }
  }

  /** Freezes or restarts a minutes countdown to match whether audio is playing. */
  private syncSleepTimer(playing: boolean): void {
    const timer = this.state.sleepTimer;
    if (timer?.kind !== 'minutes') return;
    const next = playing ? resumeTimer(timer, Date.now()) : pauseTimer(timer, Date.now());
    if (next === timer) return;
    this.setState({ sleepTimer: next });
    this.scheduleSleepTimeout();
  }

  /**
   * Arms the timeout for a running countdown (disarms it for a frozen one), plus
   * a ticker for the last 10 s: fade the volume to 0.1, optionally vibrate, and
   * listen for a shake that restarts the timer (AntennaPod only listens then).
   */
  private scheduleSleepTimeout(): void {
    this.clearSleepHandles();

    const timer = this.state.sleepTimer;
    if (timer?.kind !== 'minutes' || timer.endsAt === null) {
      // Frozen (paused) or not a countdown: full volume, no shake listener.
      // Resuming re-enters the warning on the first tick.
      this.leaveWarning();
      return;
    }

    const left = Math.max(0, timer.endsAt - Date.now());
    this.sleepHandle = setTimeout(() => {
      // Pause before cancelling: cancelling restores full volume, which would
      // otherwise blare for a moment after the fade.
      this.pause();
      this.cancelSleepTimer();
    }, left);

    const tick = () => {
      const current = this.state.sleepTimer;
      const remaining = current ? remainingMs(current, Date.now()) : null;
      if (remaining === null) return;
      if (remaining <= SLEEP_WARNING_MS) this.enterWarning(remaining, current!);
      else this.leaveWarning();
    };
    tick();
    this.warningHandle = setInterval(tick, 250);
  }

  private enterWarning(remaining: number, timer: SleepTimer): void {
    if (this.player) this.player.volume = this.baseVolume * fadeVolume(remaining);
    if (this.inWarning) return;
    this.inWarning = true;

    const settings = getSettings();
    if (settings.sleepVibrate) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (settings.sleepShakeToReset && timer.kind === 'minutes') {
      const minutes = timer.minutes;
      Accelerometer.setUpdateInterval(100);
      this.shakeSubscription = Accelerometer.addListener(({ x, y, z }) => {
        // AntennaPod uses ~2.25g as the threshold for a "shake"
        const gForce = Math.sqrt(x * x + y * y + z * z);
        if (gForce > 2.25) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          this.startSleepTimer(minutes);
        }
      });
    }
  }

  private clearSleepHandles(): void {
    if (this.sleepHandle) clearTimeout(this.sleepHandle);
    this.sleepHandle = null;
    if (this.warningHandle) clearInterval(this.warningHandle);
    this.warningHandle = null;
  }

  /** Back to full volume and no shake listener (timer extended, reset, paused, fired or cancelled). */
  private leaveWarning(): void {
    if (!this.inWarning) return;
    this.inWarning = false;
    if (this.player) this.player.volume = this.baseVolume;
    this.shakeSubscription?.remove();
    this.shakeSubscription = null;
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

function controlsKey(): string {
  const { skipForward, skipBackward, skipSilence } = getSettings();
  return `${skipForward}|${skipBackward}|${skipSilence}`;
}
