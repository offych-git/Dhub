import React, { useState, useEffect } from 'react';
import { LogOut, Heart, Tag, Bell, MessageSquare, KeyRound, Trash2, Globe2, Pencil, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const ProfilePage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [savedItemsCount, setSavedItemsCount] = useState(0);
  const [stats, setStats] = useState({
    dealsCount: 0,
    promosCount: 0,
    commentsCount: 0
  });

  useEffect(() => {
    if (user) {
      loadUserProfile();
      loadUserStats();
      loadSavedItemsCount();
    }
  }, [user]);

  const loadSavedItemsCount = async () => {
    if (!user) return;

    try {
      // Get saved deals count
      const { count: savedDealsCount } = await supabase
        .from('deal_favorites')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      // Get saved promos count
      const { count: savedPromosCount } = await supabase
        .from('promo_favorites')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      setSavedItemsCount((savedDealsCount || 0) + (savedPromosCount || 0));
    } catch (err) {
      console.error('Error loading saved items count:', err);
    }
  };

  const loadUserProfile = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      const name = profile?.display_name || user?.email?.split('@')[0] || '';
      setDisplayName(name);
      setOriginalName(name);
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const loadUserStats = async () => {
    if (!user) return;

    try {
      // Get deals count
      const { count: dealsCount } = await supabase
        .from('deals')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      // Get promos count
      const { count: promosCount } = await supabase
        .from('promo_codes')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      // Get total comments count (both deal and promo comments)
      const { count: dealCommentsCount } = await supabase
        .from('deal_comments')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      const { count: promoCommentsCount } = await supabase
        .from('promo_comments')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      setStats({
        dealsCount: (dealsCount || 0) + (promosCount || 0), // Total of deals and promos
        promosCount: promosCount || 0,
        commentsCount: (dealCommentsCount || 0) + (promoCommentsCount || 0)
      });
    } catch (err) {
      console.error('Error loading user stats:', err);
    }
  };

  const handleNameEdit = () => {
    setIsEditingName(true);
  };

  const handleNameSave = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', user.id);

      if (error) throw error;

      setOriginalName(displayName);
      setIsEditingName(false);
      setSuccess('Name updated successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setDisplayName(originalName);
    } finally {
      setLoading(false);
    }
  };

  const handleNameCancel = () => {
    setDisplayName(originalName);
    setIsEditingName(false);
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      setError(null);
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if there's an error, navigate to auth page
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      setSuccess('Password reset instructions have been sent to your email');
      setShowPasswordModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: dbError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (dbError) throw dbError;

      await signOut();
      navigate('/auth');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' },
    { code: 'es', label: 'Español' }
  ];

  return (
    <div className="pb-16 pt-16 bg-gray-900 min-h-screen">
      <div className="px-4 pt-4">
        {error && (
          <div className="bg-red-500 text-white px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500 text-white px-4 py-2 rounded mb-4">
            {success}
          </div>
        )}

        {/* User info */}
        <div className="flex items-center mb-6">
          <div className="w-16 h-16 rounded-full overflow-hidden mr-4">
            <img 
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`}
              alt="User avatar" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center">
              {isEditingName ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="bg-gray-800 text-white px-2 py-1 rounded"
                    autoFocus
                  />
                  <button
                    onClick={handleNameSave}
                    disabled={loading || !displayName.trim()}
                    className="text-green-500 hover:text-green-400 disabled:opacity-50"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleNameCancel}
                    className="text-red-500 hover:text-red-400"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-white text-xl font-bold">{displayName}</h2>
                  <button
                    onClick={handleNameEdit}
                    className="ml-2 text-gray-400 hover:text-white"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            <p className="text-gray-400">{user?.email}</p>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={() => setShowLanguageModal(true)}
              className="p-2 text-white hover:text-orange-500"
              title="Change Language"
            >
              <Globe2 className="h-6 w-6" />
            </button>
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="p-2 text-white hover:text-orange-500"
              title="Change Password"
            >
              <KeyRound className="h-6 w-6" />
            </button>
            <button 
              onClick={() => setShowDeleteModal(true)}
              className="p-2 text-white hover:text-red-500"
              title="Delete Account"
            >
              <Trash2 className="h-6 w-6" />
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-orange-500 text-xl font-bold">{stats.dealsCount}</div>
              <div className="text-gray-400 text-sm">Deals Shared</div>
            </div>
            <div>
              <div className="text-orange-500 text-xl font-bold">{stats.commentsCount}</div>
              <div className="text-gray-400 text-sm">Comments</div>
            </div>
            <div>
              <div className="text-orange-500 text-xl font-bold">{stats.promosCount}</div>
              <div className="text-gray-400 text-sm">Promos</div>
            </div>
          </div>
        </div>
        
        {/* Menu items */}
        <div className="bg-gray-800 rounded-lg overflow-hidden mb-6">
          <div className="divide-y divide-gray-700">
            <div className="px-4 py-3 flex items-center">
              <Heart className="h-5 w-5 text-orange-500 mr-3" />
              <button
                onClick={() => navigate('/saved')}
                className="text-white flex-1 text-left"
              >
                Saved Items
              </button>
              <span className="ml-auto text-gray-400">{savedItemsCount}</span>
            </div>
            <div className="px-4 py-3 flex items-center">
              <Tag className="h-5 w-5 text-orange-500 mr-3" />
              <span className="text-white">My Posted Deals</span>
              <span className="ml-auto text-gray-400">{stats.dealsCount}</span>
            </div>
            <div className="px-4 py-3 flex items-center">
              <Bell className="h-5 w-5 text-orange-500 mr-3" />
              <span className="text-white">Notifications</span>
              <span className="ml-auto bg-orange-500 text-white text-xs px-2 py-1 rounded-full">3</span>
            </div>
            <div className="px-4 py-3 flex items-center">
              <MessageSquare className="h-5 w-5 text-orange-500 mr-3" />
              <button
                onClick={() => navigate('/comments')}
                className="text-white flex-1 text-left"
              >
                My Comments
              </button>
              <span className="ml-auto text-gray-400">{stats.commentsCount}</span>
            </div>
          </div>
        </div>
        
        {/* Sign Out button */}
        <button
          onClick={handleSignOut}
          disabled={loading}
          className="w-full bg-gray-800 text-white py-3 rounded-lg flex items-center justify-center disabled:opacity-50"
        >
          <LogOut className="h-5 w-5 text-orange-500 mr-2" />
          <span>{loading ? 'Signing out...' : 'Sign Out'}</span>
        </button>
      </div>

      {/* Language Modal */}
      {showLanguageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-white text-lg font-medium mb-4">Select Language</h3>
            <div className="space-y-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code as 'en' | 'ru' | 'es');
                    setShowLanguageModal(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-md ${
                    language === lang.code
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowLanguageModal(false)}
              className="mt-4 w-full bg-gray-700 text-white py-2 rounded-md hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-white text-lg font-medium mb-4">Change Password</h3>
            <p className="text-gray-300 mb-4">
              We'll send you an email with instructions to change your password.
            </p>
            {error && (
              <div className="bg-red-500 text-white px-4 py-2 rounded mb-4">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-500 text-white px-4 py-2 rounded mb-4">
                {success}
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 text-white hover:text-gray-300"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordReset}
                disabled={loading}
                className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
              >
                {loading ? 'Sending...' : 'Send Instructions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-white text-lg font-medium mb-4">Delete Account</h3>
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete your account? This action cannot be undone.
            </p>
            {error && (
              <div className="bg-red-500 text-white px-4 py-2 rounded mb-4">
                {error}
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-white hover:text-gray-300"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={loading}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                {loading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;