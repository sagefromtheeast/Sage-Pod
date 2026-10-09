import { formatRemaining } from '../util/time';

/**
 * What the home-screen widget shows, from the player's state. Kept pure so
 * the change check and labels are tested without a widget host.
 */
export type WidgetModel = {
  /** Null when nothing is loaded: the widget invites the listener to open the app. */
  episodeId: number | null;
  title: string;
  podcast: string;
  /** An http(s) image the widget host can fetch itself, or null for the app icon. */
  artwork: string | null;
  playing: boolean;
  /** 0–1 through the episode. */
  progress: number;
  /** "12 min left", or empty when the length isn't known. */
  remaining: string;
};

type PlayerSnapshot = {
  episode: {
    id: number;
    title: string;
    feed_title: string;
    image_url: string | null;
    feed_image_url: string | null;
  } | null;
  playing: boolean;
  position: number;
  duration: number;
};

export const EMPTY_WIDGET: WidgetModel = {
  episodeId: null,
  title: 'Nothing playing',
  podcast: 'Open Sage Pod to pick an episode',
  artwork: null,
  playing: false,
  progress: 0,
  remaining: '',
};

export function widgetModel({ episode, playing, position, duration }: PlayerSnapshot): WidgetModel {
  if (!episode) return EMPTY_WIDGET;
  const length = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const at = Math.max(0, Math.min(position, length || position));
  return {
    episodeId: episode.id,
    title: episode.title,
    podcast: episode.feed_title,
    artwork: [episode.image_url, episode.feed_image_url].find(isFetchable) ?? null,
    playing,
    progress: length ? at / length : 0,
    remaining: length ? formatRemaining(length - at) : '',
  };
}

/**
 * Redrawing a widget crosses into the launcher, so it happens only when
 * something visible changes: the episode, play state, artwork, or the
 * remaining time (whole minutes, so about once a minute while playing).
 */
export function widgetKey(model: WidgetModel): string {
  return [
    model.episodeId,
    model.playing,
    model.artwork,
    model.title,
    model.remaining,
    Math.round(model.progress * 50),
  ].join('|');
}

function isFetchable(url: string | null): url is string {
  return !!url && /^https?:\/\//i.test(url);
}
