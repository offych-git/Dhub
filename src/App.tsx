import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { GlobalStateProvider } from './contexts/GlobalStateContext';
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
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
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
import SweepstakesPage from './pages/SweepstakesPage'; // Added import


function App() {
  return (
    <Router>
      <AuthProvider>
        <GlobalStateProvider>
          <LanguageProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/auth/reset-password" element={<AuthPage isResetPasswordPage={true} />} />
              <Route path="/auth/callback" element={<AuthPage />} />
              <Route path="/auth/reset-password" element={<AuthPage isResetPasswordPage={true} />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route element={<AppLayout />}>
                <Route path="/" element={<DealsPage />} />
                <Route path="/deals/:id" element={<DealDetailPage />} />
                <Route path="/deals/new" element={<PrivateRoute><AddDealPage /></PrivateRoute>} />
                <Route path="/deals/new-carousel" element={<PrivateRoute><AddDealPageNew /></PrivateRoute>} /> 
                <Route path="/deals/:id/edit" element={<PrivateRoute><EditDealCarouselPage /></PrivateRoute>} />
                <Route path="/edit-carousel/:id" element={<PrivateRoute><EditDealCarouselPage /></PrivateRoute>} />
                <Route path="/promos/new" element={<PrivateRoute><AddPromoPage /></PrivateRoute>} />
                <Route path="/promos" element={<PromosPage />} />
                <Route path="/promos/:id" element={<PrivateRoute><PromoDetailPage /></PrivateRoute>} />
                <Route path="/promos/:id/edit" element={<PrivateRoute><EditPromoPage /></PrivateRoute>} />
                <Route path="/sweepstakes/new" element={<PrivateRoute><AddSweepstakesPage /></PrivateRoute>} /> 
                <Route path="/sweepstakes/:id" element={<SweepstakesDetailPage />} /> 
                <Route path="/sweepstakes" element={<SweepstakesPage />} /> {/* Added route */}
                <Route path="/discussions" element={<PrivateRoute><DiscussionsPage /></PrivateRoute>} />
                <Route path="/categories" element={<PrivateRoute><CategoriesPage /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
                <Route path="/saved" element={<PrivateRoute><SavedItemsPage /></PrivateRoute>} />
                <Route path="/comments" element={<PrivateRoute><UserCommentsPage /></PrivateRoute>} />
                <Route path="/posted" element={<PrivateRoute><UserPostedItemsPage /></PrivateRoute>} />
                <Route path="/settings/notifications" element={<PrivateRoute><NotificationSettingsPage /></PrivateRoute>} />
                <Route path="/user-settings" element={<PrivateRoute><UserSettingsPage /></PrivateRoute>} />
                <Route path="/category/:categoryId" element={<CategoryItemsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </LanguageProvider>
        </GlobalStateProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;