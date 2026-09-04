# Sage Pod

A React Native + Expo podcast player. See `README.md` for the architecture.

## Expo has changed

This project is on **Expo SDK 57**. Several APIs moved recently — check the
installed type definitions in `node_modules` or the versioned docs at
https://docs.expo.dev/versions/v57.0.0/ before writing code against them.
In particular:

- `expo-router` no longer depends on React Navigation. `Tabs`, `BottomTabBar`
  and `BottomTabBarProps` come from **`expo-router/js-tabs`**, not
  `@react-navigation/bottom-tabs` (which is not installed). `Stack` still comes
  from `expo-router`.
- Audio is **`expo-audio`**, not `expo-av`. It provides lock-screen and
  notification controls directly via `setActiveForLockScreen()`.
- `expo-file-system` uses the `File` / `Directory` / `Paths` classes.

## Conventions

- Imports use the `@/*` alias for `src/*`. Keep them extensionless.
- Database access goes through a repository in `src/db/`, never raw SQL in a
  screen.
- Screens re-render from SQLite change events via `useQuery`. Do not add manual
  cache invalidation.
- Colours, spacing and type come from `src/ui/theme.ts` via `useTheme()`. No
  hard-coded hex values in screens.

## Checks

```bash
npm run typecheck   # app + tests
npm test            # feed parser suite
npx expo export --platform android   # catches Metro resolution errors
```
