import { useSetting } from '@/db/settings';
import type { IconName } from '@/ui/ActionSheet';
import {
  parseSwipes,
  serializeSwipes,
  SWIPE_ICONS,
  SWIPE_LABELS,
  SWIPE_SCREEN_KEYS,
  SWIPE_SCREENS,
  type SwipeAction,
  type SwipeScreen,
} from '@/settings/swipes';
import { SettingsNote, SettingsScreen } from '@/ui/settings/SettingsScreen';
import { useUpdateSetting } from '@/ui/settings/useUpdateSetting';
import { SettingsChoice, SettingsSection } from '@/ui/SettingsRow';

/**
 * AntennaPod's swipe actions dialog as a page: a right and a left swipe for
 * each list, chosen from what makes sense there.
 */
export default function SwipeSettings() {
  const update = useUpdateSetting();
  const settings = {
    swipeInbox: useSetting('swipeInbox'),
    swipeQueue: useSetting('swipeQueue'),
    swipeEpisodes: useSetting('swipeEpisodes'),
    swipeDownloads: useSetting('swipeDownloads'),
  };

  const set = (screen: SwipeScreen, side: 'right' | 'left', action: SwipeAction) => {
    const { setting } = SWIPE_SCREENS[screen];
    const pair = { ...parseSwipes(screen, settings[setting]), [side]: action };
    void update(setting, serializeSwipes(pair));
  };

  return (
    <SettingsScreen>
      {SWIPE_SCREEN_KEYS.map((screen) => {
        const { label, actions, setting } = SWIPE_SCREENS[screen];
        const pair = parseSwipes(screen, settings[setting]);
        return [
          <SettingsSection key={`${screen}-title`} title={label} />,
          (['right', 'left'] as const).map((side) => (
            <SettingsChoice<SwipeAction>
              key={`${screen}-${side}`}
              label={side === 'right' ? 'Swipe right' : 'Swipe left'}
              value={pair[side]}
              options={actions}
              format={(action) => SWIPE_LABELS[action]}
              icon={(action) => SWIPE_ICONS[action] as IconName}
              onChange={(action) => set(screen, side, action)}
            />
          )),
        ];
      })}
      <SettingsNote>
        Home’s inbox section uses the Inbox swipes. Each swipe offers Undo, and deleting a download asks first.
      </SettingsNote>
    </SettingsScreen>
  );
}
