
// Глобальные функции для взаимодействия с UI компонентами
// Используются для вызова из внешнего кода (например, WebView)

type GlobalInteractionHandler = () => void;

// Хранилище для callback-функций
interface GlobalHandlers {
  toggleNotifications: GlobalInteractionHandler | null;
  toggleAddMenu: GlobalInteractionHandler | null;
  toggleSideMenu: GlobalInteractionHandler | null;
}

// Хранилище для callback-функций компонентов
const handlers: GlobalHandlers = {
  toggleNotifications: null,
  toggleAddMenu: null,
  toggleSideMenu: null,
};

let lastNotificationRegistrationTime = 0; // Переименовал для ясности

export const registerNotificationHandler = (handler: GlobalInteractionHandler | null) => {
  const now = Date.now();
  const timeSinceLastRegistration = now - lastNotificationRegistrationTime;
  lastNotificationRegistrationTime = now;

  console.log("GlobalInteractions: Вызвана registerNotificationHandler.", {
    handlerExists: !!handler,
    previousHandlerExists: !!handlers.toggleNotifications,
    timeSinceLastMs: timeSinceLastRegistration,
  });

  // Логика для предотвращения быстрой отмены регистрации из-за StrictMode
  if (handler === null && timeSinceLastRegistration < 500 && handlers.toggleNotifications !== null) {
    console.warn("GlobalInteractions: Игнорируем быструю отмену регистрации для toggleNotifications (вероятно StrictMode). Обработчик НЕ изменен.");
    return; // Не меняем handlers.toggleNotifications на null
  }

  handlers.toggleNotifications = handler; // <--- ИСПОЛЬЗУЙТЕ ОБЪЕКТ HANDLERS
  console.log("GlobalInteractions: handlers.toggleNotifications теперь:", handlers.toggleNotifications ? 'ФУНКЦИЯ' : handlers.toggleNotifications);
};

export const registerAddMenuHandler = (handler: GlobalInteractionHandler | null) => { // Разрешаем null
  // Здесь тоже можно добавить логику для StrictMode, если нужно для плюсика
  handlers.toggleAddMenu = handler;
  console.log("GlobalInteractions: handlers.toggleAddMenu теперь:", handlers.toggleAddMenu ? 'ФУНКЦИЯ' : handlers.toggleAddMenu);
};

export const registerSideMenuHandler = (handler: GlobalInteractionHandler | null) => { // Разрешаем null
  handlers.toggleSideMenu = handler;
  console.log("GlobalInteractions: handlers.toggleSideMenu теперь:", handlers.toggleSideMenu ? 'ФУНКЦИЯ' : handlers.toggleSideMenu);
};

const setupGlobalHandlers = () => {
  console.log("Функция setupGlobalHandlers() ВЫЗВАНА!");

  window.toggleNotificationsView = () => {
    console.log("Вызвана глобальная функция window.toggleNotificationsView()");
    console.log("ТЕКУЩЕЕ ЗНАЧЕНИЕ handlers.toggleNotifications существует:", !!handlers.toggleNotifications); // Проверяем handlers.toggleNotifications

    if (handlers.toggleNotifications) { // Используем handlers.toggleNotifications
      console.log("Вызываем зарегистрированный обработчик handlers.toggleNotifications");
      try {
        handlers.toggleNotifications();
        console.log("Обработчик handlers.toggleNotifications успешно выполнен");
      } catch (error) {
        console.error("ОШИБКА при выполнении handlers.toggleNotifications:", error);
      }
    } else {
      console.warn("Notification handler not registered (window.toggleNotificationsView)");
      console.log("Детальная отладка на момент вызова: handlers =", JSON.stringify(handlers, null, 2));
    }
  };

  window.toggleAddContentMenu = () => {
    console.log("Вызвана глобальная функция window.toggleAddContentMenu()");
    console.log("ТЕКУЩЕЕ ЗНАЧЕНИЕ handlers.toggleAddMenu существует:", !!handlers.toggleAddMenu);
    if (handlers.toggleAddMenu) {
      console.log("Вызываем зарегистрированный обработчик handlers.toggleAddMenu");
      handlers.toggleAddMenu();
    } else {
      console.warn("Add menu handler not registered (window.toggleAddContentMenu)");
      console.log("Детальная отладка на момент вызова: handlers =", JSON.stringify(handlers, null, 2));
    }
  };

  // toggleAppSideMenu остается как было, так как оно работало
  window.toggleAppSideMenu = () => {
    console.log("Вызвана глобальная функция window.toggleAppSideMenu()");
    console.log("ТЕКУЩЕЕ ЗНАЧЕНИЕ handlers.toggleSideMenu существует:", !!handlers.toggleSideMenu);
    if (handlers.toggleSideMenu) {
      handlers.toggleSideMenu();
    } else {
      console.warn("Side menu handler not registered (window.toggleAppSideMenu)");
    }
  };
};

// Декларация типов для window
declare global {
  interface Window {
    toggleNotificationsView: () => void;
    toggleAddContentMenu: () => void;
    toggleAppSideMenu: () => void;
  }
}

// Инициализация при загрузке
export const initGlobalInteractions = () => {
  setupGlobalHandlers();
  console.log("Global UI interactions initialized");
};

export default initGlobalInteractions;
