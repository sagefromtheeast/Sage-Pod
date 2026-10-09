import { FlexWidget, ImageWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget';

import { palettes, type Palette } from '@/ui/theme';
import type { WidgetModel } from '@/widget/model';

export const WIDGET_NAME = 'NowPlaying';
/** Widget button actions, handled in `src/widget/index.ts`. */
export const WIDGET_ACTIONS = { toggle: 'TOGGLE', back: 'SKIP_BACK', forward: 'SKIP_FORWARD' } as const;

const ICON = require('../../assets/icon.png');
/** Below this width (dp) the skip buttons give way to the title. */
const COMPACT_WIDTH = 250;
/** Below this height (dp) the padding tightens, and art and buttons shrink to fit. */
const SHORT_HEIGHT = 76;

type Props = { model: WidgetModel; palette: Palette; width: number; height: number };

/**
 * AntennaPod's player widget: cover, title, podcast, progress, and skip back /
 * play-pause / skip forward. Tapping anywhere else opens the player.
 */
export function NowPlayingWidget({ model, palette, width, height }: Props) {
  const color = (value: string) => value as ColorProp;
  const padding = height < SHORT_HEIGHT ? 6 : 12;
  const inner = Math.max(28, height - 2 * padding);
  const art = Math.min(inner, 96);
  const compact = width < COMPACT_WIDTH;
  const loaded = model.episodeId != null;

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: loaded ? 'sagepod://player' : 'sagepod://' }}
      accessibilityLabel={loaded ? `${model.title}, ${model.podcast}. Open the player` : 'Open Sage Pod'}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: color(palette.surface),
        borderRadius: 20,
        padding,
        flexGap: 12,
      }}
    >
      <ImageWidget
        image={model.artwork ? (model.artwork as `https:${string}`) : ICON}
        imageWidth={art}
        imageHeight={art}
        radius={12}
        resizeMode="cover"
      />
      <FlexWidget style={{ flex: 1, flexDirection: 'column', justifyContent: 'center', flexGap: 2 }}>
        <TextWidget
          text={model.title}
          maxLines={compact ? 2 : 1}
          truncate="END"
          style={{ fontSize: 15, fontWeight: '600', color: color(palette.text) }}
        />
        <TextWidget
          text={model.remaining ? `${model.podcast} · ${model.remaining}` : model.podcast}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 12, color: color(palette.textMuted) }}
        />
        {loaded ? <Progress value={model.progress} palette={palette} /> : null}
      </FlexWidget>
      {loaded ? (
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
          {compact ? null : (
            <Button
              action={WIDGET_ACTIONS.back}
              svg={SKIP_BACK}
              label="Skip back"
              palette={palette}
              size={Math.min(36, inner)}
            />
          )}
          <Button
            action={WIDGET_ACTIONS.toggle}
            svg={model.playing ? PAUSE : PLAY}
            label={model.playing ? 'Pause' : 'Play'}
            palette={palette}
            size={Math.min(44, inner)}
            primary
          />
          {compact ? null : (
            <Button
              action={WIDGET_ACTIONS.forward}
              svg={SKIP_FORWARD}
              label="Skip forward"
              palette={palette}
              size={Math.min(36, inner)}
            />
          )}
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

/** Both schemes, so the launcher follows the system's light or dark mode. */
export function nowPlayingWidget(model: WidgetModel, width: number, height: number) {
  return {
    light: <NowPlayingWidget model={model} palette={palettes.light} width={width} height={height} />,
    dark: <NowPlayingWidget model={model} palette={palettes.dark} width={width} height={height} />,
  };
}

function Progress({ value, palette }: { value: number; palette: Palette }) {
  const done = Math.round(Math.max(0, Math.min(1, value)) * 1000);
  return (
    <FlexWidget
      style={{
        marginTop: 6,
        height: 3,
        width: 'match_parent',
        flexDirection: 'row',
        borderRadius: 2,
        backgroundColor: palette.track as ColorProp,
      }}
    >
      {done > 0 ? <FlexWidget style={{ flex: done, height: 3, backgroundColor: palette.accent as ColorProp }} /> : null}
      {done < 1000 ? <FlexWidget style={{ flex: 1000 - done, height: 3 }} /> : null}
    </FlexWidget>
  );
}

function Button({
  action,
  svg,
  label,
  palette,
  size,
  primary = false,
}: {
  action: string;
  svg: (fill: string) => string;
  label: string;
  palette: Palette;
  size: number;
  primary?: boolean;
}) {
  const icon = Math.round(size / 2);
  return (
    <FlexWidget
      clickAction={action}
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: (primary ? palette.accent : palette.surfaceAlt) as ColorProp,
      }}
    >
      <SvgWidget svg={svg(primary ? palette.onAccent : palette.text)} style={{ width: icon, height: icon }} />
    </FlexWidget>
  );
}

const svgIcon = (path: string) => (fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="${path}"/></svg>`;

const PLAY = svgIcon('M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z');
const PAUSE = svgIcon('M7 5h3.5v14H7zM13.5 5H17v14h-3.5z');
const SKIP_BACK = svgIcon('M11 6.5v11L3.5 12zM20 6.5v11L12.5 12z');
const SKIP_FORWARD = svgIcon('M13 6.5v11l7.5-5.5zM4 6.5v11l7.5-5.5z');
