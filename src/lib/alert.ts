/**
 * Cross-platform alert dispatch.
 *
 * react-native-web ships `Alert.alert()` as an empty stub, so on the web
 * deployment every confirmation dialog — delete account, file a report,
 * reminder results — silently did nothing. This module keeps the familiar
 * `Alert.alert(title, message?, buttons?)` shape but routes:
 *   - native → react-native's Alert (unchanged behavior);
 *   - web    → the `AlertProvider` modal mounted in the root layout, with a
 *              `window.alert` last resort if no provider is mounted.
 */
import { Alert, Platform } from 'react-native';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type AlertTask = {
  title: string;
  message?: string;
  buttons: AlertButton[];
};

type Listener = (task: AlertTask) => void;

const listeners = new Set<Listener>();

/** Used by AlertProvider (web modal) — returns an unsubscribe function. */
export function subscribeAlerts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  const resolved: AlertButton[] =
    buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];

  if (Platform.OS !== 'web') {
    Alert.alert(title, message, resolved);
    return;
  }

  const task: AlertTask = { title, message, buttons: resolved };
  if (listeners.size > 0) {
    listeners.forEach((l) => l(task));
    return;
  }
  // No provider mounted (shouldn't happen — AlertProvider wraps the app).
  globalThis.alert([title, message].filter(Boolean).join('\n\n'));
}
