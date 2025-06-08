// App.tsx (ВАШЕГО ВЕБ-САЙТА)
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'; // Добавлен useLocation
import ReactGA4 from 'react-ga4'; // Импортирован react-ga4

import { AuthProvider } from './contexts/AuthContext';
import { GlobalStateProvider } from './contexts/GlobalStateContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ModerationProvider } from './contexts/ModerationContext';
import './index.css';
import AppLayout from './components/layout/AppLayout';
import AuthPage from './pages/AuthPage';
import DealsPage from './pages/DealsPage';
import DealDetailPage from './pages/DealDetailPage';
import AddDealPage from './pages/AddDealPage';
import AddPromoPage from './pages/AddPromoPage';
import PromosPage from './pages/PromosPage';
import PromoDetailPage from './pages/PromoDetailPage';
import DiscussionsPage from './pages/DiscussionsPage';
import CategoriesPage from './pages/CategoriesPage';
import ProfilePage from './pages/ProfilePage';
import SavedItemsPage from './pages/SavedItemsPage';
import UserCommentsPage from './pages/UserCommentsPage';
import UserPostedItemsPage from './pages/UserPostedItemsPage';
import NotificationSettingsPage from './pages/NotificationSettingsPage';
import UserSettingsPage from './pages/UserSettingsPage';
import PrivateRoute from './components/PrivateRoute';
import AddDealPageNew from './pages/AddDealPageNew';
import EditDealPage from './pages/EditDealPage';
import EditDealCarouselPage from './pages/EditDealCarouselPage';
import EditPromoPage from './pages/EditPromoPage';
import CategoryItemsPage from './pages/CategoryItemsPage';
import AddSweepstakesPage from './pages/AddSweepstakesPage';
import SweepstakesDetailPage from './pages/SweepstakesDetailPage';
import SweepstakesPage from './pages/SweepstakesPage';
import EditSweepstakesPage from './pages/EditSweepstakesPage';
import ModerationPage from './pages/ModerationPage';
import ModerationSettingsPage from './pages/ModerationSettingsPage';
import UserSubscriptionsPage from './pages/UserSubscriptionsPage';
import SearchPage from './pages/SearchPage';
import FacebookDataDeletionPage from './pages/FacebookDataDeletionPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';

import initGlobalInteractions from './utils/globalInteractions';
import initWebViewConsole from './utils/webViewConsole';

import { supabase } from './lib/supabase';

// Ваш реальный Measurement ID для Google Analytics 4
const GA4_MEASUREMENT_ID = "G-N0VDTWZSBV";

// Инициализируем GA4 один раз при загрузке приложения
ReactGA4.initialize(GA4_MEASUREMENT_ID);

// Вспомогательный компонент для отслеживания просмотров страниц
const GAListener: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // Отправляем событие просмотра страницы при каждой смене URL
    // location.pathname - путь страницы (например, /deals/123)
    // location.search - параметры запроса (например, ?q=test)
    ReactGA4.send({ hitType: "pageview", page: location.pathname + location.search });
    console.log(`GA4: Pageview sent for ${location.pathname + location.search}`);
  }, [location]); // Зависимость от location означает, что эффект будет повторно запускаться при изменении URL

  return null; // Этот компонент не рендерит ничего в DOM
};

function App() {
  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isWebView =
      userAgent.includes('wv') ||
      userAgent.includes('fbav') ||
      userAgent.includes('instagram') ||
      userAgent.includes('snapchat') ||
      (userAgent.includes('iphone') && !userAgent.includes('safari')) ||
      new URLSearchParams(window.location.search).has('embedded');

    if (isWebView) {
      document.body.classList.add('embedded-app');
    } else {
      document.body.classList.add('standalone-browser');
    }

    initGlobalInteractions();
    initWebViewConsole();

    (window as any).supabase = supabase;

    if ((window as any).ReactNativeWebViewFramework &&
        typeof (window as any).ReactNativeWebViewFramework.signalSupabaseReady === 'function') {
      console.log('[WEBSITE App.tsx] Signaling Supabase is ready to ReactNativeWebViewFramework.');
      (window as any).ReactNativeWebViewFramework.signalSupabaseReady();
    } else {
      console.warn('[WEBSITE App.tsx] ReactNativeWebViewFramework.signalSupabaseReady not found immediately. Setting a timeout to try again.');
      const timeoutId = setTimeout(() => {
        if ((window as any).ReactNativeWebViewFramework &&
            typeof (window as any).ReactNativeWebViewFramework.signalSupabaseReady === 'function') {
          console.log('[WEBSITE App.tsx] Signaling Supabase is ready to ReactNativeWebViewFramework (delayed attempt).');
          (window as any).ReactNativeWebViewFramework.signalSupabaseReady();
        } else {
          console.error('[WEBSITE App.tsx] ReactNativeWebViewFramework.signalSupabaseReady still not found after delay.');
        }
      }, 1500);
      return () => clearTimeout(timeoutId);
    }

    return () => {
      document.body.classList.remove('embedded-app', 'standalone-browser');
    };
  }, []);

  return (
    <Router>
      {/* Добавляем GAListener внутри Router, чтобы он имел доступ к useLocation */}
      <GAListener /> 

      <AuthProvider>
        <GlobalStateProvider>
          <ThemeProvider>
            <ModerationProvider>
              <LanguageProvider>
                <Routes>
                  {/* ПУБЛИЧНЫЕ БАЗОВЫЕ МАРШРУТЫ (без AppLayout и PrivateRoute) */}
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/auth/reset-password" element={<AuthPage isResetPasswordPage={true} />} />
                  <Route path="/auth/callback" element={<AuthPage />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                  <Route path="/facebook-data-deletion" element={<FacebookDataDeletionPage />} />

                  {/* ПУБЛИЧНЫЕ ДИНАМИЧЕСКИЕ МАРШРУТЫ (без AppLayout и PrivateRoute, с :id) */}
                  <Route path="/promos/:id" element={<PromoDetailPage />} />
                  <Route path="/deals/:id" element={<DealDetailPage />} />
                  <Route path="/sweepstakes/:id" element={<SweepstakesDetailPage />} />
                  <Route path="/category/:categoryId" element={<CategoryItemsPage />} />

                  {/* МАРШРУТЫ, ИСПОЛЬЗУЮЩИЕ ОБЩИЙ LAYOUT (AppLayout) */}
                  <Route element={<AppLayout />}>
                    {/* Публичная домашняя страница */}
                    <Route path="/" element={<DealsPage />} />

                    {/* Общие страницы-списки, которые публичны, но используют AppLayout */}
                    <Route path="/promos" element={<PromosPage />} />
                    <Route path="/sweepstakes" element={<SweepstakesPage />} />
                    <Route path="/discussions" element={<DiscussionsPage />} />
                    <Route path="/categories" element={<CategoriesPage />} />
                    <Route path="/search" element={<SearchPage />} />

                    {/* ПРИВАТНЫЕ МАРШРУТЫ (Обычно требуют PrivateRoute и используют AppLayout) */}
                    <Route path="/deals/new" element={<PrivateRoute><AddDealPage /></PrivateRoute>} />
                    <Route path="/deals/new-carousel" element={<PrivateRoute><AddDealPageNew /></PrivateRoute>} />
                    <Route path="/edit-carousel/:id" element={<PrivateRoute><EditDealCarouselPage /></PrivateRoute>} />
                    <Route path="/promos/new" element={<PrivateRoute><AddPromoPage /></PrivateRoute>} />
                    <Route path="/promos/:id/edit" element={<PrivateRoute><EditPromoPage /></PrivateRoute>} />
                    <Route path="/sweepstakes/new" element={<PrivateRoute><AddSweepstakesPage /></PrivateRoute>} />
                    <Route path="/edit-deal/:id" element={<PrivateRoute><EditDealPage /></PrivateRoute>} />
                    <Route path="/edit-promo/:id" element={<PrivateRoute><EditPromoPage /></PrivateRoute>} />
                    <Route path="/edit-sweepstakes/:id" element={<PrivateRoute><EditSweepstakesPage /></PrivateRoute>} />
                    <Route path="/moderation" element={<PrivateRoute><ModerationPage /></PrivateRoute>} />
                    <Route path="/moderation/settings" element={<PrivateRoute><ModerationSettingsPage /></PrivateRoute>} />
                    <Route path="/user-subscriptions" element={<PrivateRoute><UserSubscriptionsPage /></PrivateRoute>} />

                    {/* Страницы профиля и настроек пользователя (обычно приватные) */}
                    <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
                    <Route path="/saved" element={<PrivateRoute><SavedItemsPage /></PrivateRoute>} />
                    <Route path="/comments" element={<PrivateRoute><UserCommentsPage /></PrivateRoute>} />
                    <Route path="/posted" element={<PrivateRoute><UserPostedItemsPage /></PrivateRoute>} />
                    <Route path="/settings/notifications" element={<PrivateRoute><NotificationSettingsPage /></PrivateRoute>} />
                    <Route path="/user-settings" element={<PrivateRoute><UserSettingsPage /></PrivateRoute>} />

                  </Route>

                  {/* ЗАПАСНОЙ МАРШРУТ (ВСЕГДА В САМОМ КОНЦЕ) */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </LanguageProvider>
            </ModerationProvider>
          </ThemeProvider>
        </GlobalStateProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;