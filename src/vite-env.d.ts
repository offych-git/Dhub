/// <reference types="vite/client" />

interface Window {
  ReactNativeWebView?: {
    postMessage: (message: string) => void;
  };
  toggleNotificationsView?: () => void;
  toggleAddContentMenu?: () => void;
  toggleAppSideMenu?: () => void;
}

