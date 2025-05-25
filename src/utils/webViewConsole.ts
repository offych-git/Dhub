
// Перехватывает вызовы console и отправляет их в React Native WebView
export function initWebViewConsole(): void {
  if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) {
    // Мы не в React Native WebView с postMessage, ничего не делаем
    return;
  }

  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
  };

  function serializeArg(arg: any) {
    if (typeof arg === 'function') return `[Function: ${arg.name || 'anonymous'}]`;
    if (typeof arg === 'symbol') return String(arg);
    if (arg instanceof Error) return `[Error: ${arg.message}\n${arg.stack}]`;
    try {
      // Пытаемся клонировать, чтобы избежать проблем с объектами, которые не могут быть сериализованы напрямую
      return JSON.parse(JSON.stringify(arg)); // Для простых объектов
    } catch (e) {
      return String(arg); // Если не получается, просто в строку
    }
  }

  ['log', 'warn', 'error', 'info', 'debug'].forEach(function(level) {
    console[level] = function(...args: any[]) {
      // Отправляем сообщение в React Native
      try {
        const serializedArgs = args.map(serializeArg);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'CONSOLE', // Наш кастомный тип сообщения
          level: level,
          payload: serializedArgs // Отправляем массив аргументов
        }));
      } catch (e) {
        originalConsole.error('Error posting message to RN:', e);
      }

      // Также вызываем оригинальную функцию консоли
      originalConsole[level].apply(console, args);
    };
  });

  console.log('WebView console override initialized.');
}

export default initWebViewConsole;
