import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
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
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import NotificationSettingsPage from './pages/NotificationSettingsPage';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <Router>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route element={<AppLayout />}>
                <Route path="/" element={<DealsPage />} />
                <Route path="/deals/:id" element={<DealDetailPage />} />
                <Route path="/deals/new" element={<PrivateRoute><AddDealPage /></PrivateRoute>} />
                <Route path="/promos/new" element={<PrivateRoute><AddPromoPage /></PrivateRoute>} />
                <Route path="/promos" element={<PrivateRoute><PromosPage /></PrivateRoute>} />
                <Route path="/promos/:id" element={<PrivateRoute><PromoDetailPage /></PrivateRoute>} />
                <Route path="/discussions" element={<PrivateRoute><DiscussionsPage /></PrivateRoute>} />
                <Route path="/categories" element={<PrivateRoute><CategoriesPage /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
                <Route path="/saved" element={<PrivateRoute><SavedItemsPage /></PrivateRoute>} />
                <Route path="/comments" element={<PrivateRoute><UserCommentsPage /></PrivateRoute>} />
                <Route path="/settings/notifications" element={<PrivateRoute><NotificationSettingsPage /></PrivateRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </Router>
  );
}

export default App;