/**
 * Отправляет команду в React Native для вызова тактильной обратной связи.
 * @param {string} hapticType - Тип вибрации.
 */
export function triggerNativeHaptic(hapticType: string): void {
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    const message = {
      type: 'HAPTIC_FEEDBACK_REQUEST',
      payload: { type: hapticType }
    };
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  } else {
    // console.warn('Web: ReactNativeWebView.postMessage недоступен.');
  }
}
