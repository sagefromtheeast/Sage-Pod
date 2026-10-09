import 'expo-router/entry';

// Work Android can start without showing the app registers here, at bundle
// load. Routes load only when the app renders, which a headless start (a
// background refresh, a widget update or button) never does.
import '@/background';
import '@/widget';
