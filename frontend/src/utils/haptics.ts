// expo-haptics behind the "Vibrations" setting: same API, silent when the player turned it off.
import * as H from "expo-haptics";

let enabled = true;
export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

export const ImpactFeedbackStyle = H.ImpactFeedbackStyle;
export const NotificationFeedbackType = H.NotificationFeedbackType;

export const impactAsync = (style?: H.ImpactFeedbackStyle) => (enabled ? H.impactAsync(style) : Promise.resolve());
export const notificationAsync = (type?: H.NotificationFeedbackType) => (enabled ? H.notificationAsync(type) : Promise.resolve());
export const selectionAsync = () => (enabled ? H.selectionAsync() : Promise.resolve());
