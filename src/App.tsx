// App.tsx (Без кода для WebView)
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ReactGA4 from 'react-ga4';

import { AuthProvider } from './contexts/AuthContext';
import { GlobalStateProvider } from './contexts/GlobalStateContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ModerationProvider } from './contexts/ModerationContext';
import './index.css';
import AppLayout from './components/layout/AppLayout';
import AuthPage from './pages/AuthPage';
// ... все остальные импорты страниц ...
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
// Удален импорт initWebViewConsole

const GA4_MEASUREMENT_ID = "G-N0VDTWZSBV";

ReactGA4.initialize(GA4_MEASUREMENT_ID);

const GAListener: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    ReactGA4.send({ hitType: "pageview", page: location.pathname + location.search });
    console.log(`GA4: Pageview sent for ${location.pathname + location.search}`);
  }, [location]);

  return null;
};

function App() {
  useEffect(() => {
    // Оставляем только инициализацию, не связанную с WebView
    initGlobalInteractions();

    // Весь код для определения WebView и связи с ReactNative полностью удален
  }, []);

  return (
    <Router>
      <GAListener />

      <AuthProvider>
        <GlobalStateProvider>
          <ThemeProvider>
            <ModerationProvider>
              <LanguageProvider>
                <Routes>
                  {/* ПУБЛИЧНЫЕ БАЗОВЫЕ МАРШРУТЫ */}
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/auth/reset-password" element={<AuthPage isResetPasswordPage={true} />} />
                  <Route path="/auth/callback" element={<AuthPage />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                  <Route path="/facebook-data-deletion" element={<FacebookDataDeletionPage />} />
                  
                  {/* МАРШРУТЫ, ИСПОЛЬЗУЮЩИЕ ОБЩИЙ LAYOUT */}
                  <Route element={<AppLayout />}>
                    <Route path="/promos/:id" element={<PromoDetailPage />} />
                    <Route path="/deals/:id" element={<DealDetailPage />} />
                    <Route path="/sweepstakes/:id" element={<SweepstakesDetailPage />} />
                    <Route path="/category/:categoryId" element={<CategoryItemsPage />} />

                    <Route path="/" element={<DealsPage />} />
                    <Route path="/promos" element={<PromosPage />} />
                    <Route path="/sweepstakes" element={<SweepstakesPage />} />
                    <Route path="/discussions" element={<DiscussionsPage />} />
                    <Route path="/categories" element={<CategoriesPage />} />
                    <Route path="/search" element={<SearchPage />} />

                    {/* Приватные маршруты */}
                    <Route path="/deals/new" element={<PrivateRoute><AddDealPage /></PrivateRoute>} />
                    <Route path="/deals/new-carousel" element={<PrivateRoute><AddDealPageNew /></PrivateRoute>} />
                    <Route path="/deals/:id/edit" element={<PrivateRoute><EditDealPage /></PrivateRoute>} />
                    <Route path="/deals/:id/edit-carousel" element={<PrivateRoute><EditDealCarouselPage /></PrivateRoute>} />

                    <Route path="/promos/new" element={<PrivateRoute><AddPromoPage /></PrivateRoute>} />
                    <Route path="/promos/:id/edit" element={<PrivateRoute><EditPromoPage /></PrivateRoute>} />
                    
                    <Route path="/sweepstakes/new" element={<PrivateRoute><AddSweepstakesPage /></PrivateRoute>} />
                    <Route path="/sweepstakes/:id/edit" element={<PrivateRoute><EditSweepstakesPage /></PrivateRoute>} />
                    
                    <Route path="/moderation" element={<PrivateRoute><ModerationPage /></PrivateRoute>} />
                    <Route path="/moderation/settings" element={<PrivateRoute><ModerationSettingsPage /></PrivateRoute>} />
                    <Route path="/user-subscriptions" element={<PrivateRoute><UserSubscriptionsPage /></PrivateRoute>} />

                    <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
                    <Route path="/saved" element={<PrivateRoute><SavedItemsPage /></PrivateRoute>} />
                    <Route path="/comments" element={<PrivateRoute><UserCommentsPage /></PrivateRoute>} />
                    <Route path="/posted" element={<PrivateRoute><UserPostedItemsPage /></PrivateRoute>} />
                    <Route path="/settings/notifications" element={<PrivateRoute><NotificationSettingsPage /></PrivateRoute>} />
                    <Route path="/user-settings" element={<PrivateRoute><UserSettingsPage /></PrivateRoute>} />
                  </Route>

                  {/* ЗАПАСНОЙ МАРШРУТ */}
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