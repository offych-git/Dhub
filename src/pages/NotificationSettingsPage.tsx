import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const NotificationSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    mentions: true,
    replies: true,
    votes: true,
    favorites: true,
    email_notifications: true
  });

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      if (data?.notification_preferences) {
        setPreferences(data.notification_preferences);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof typeof preferences) => {
    try {
      setSaving(true);
      const newPreferences = { ...preferences, [key]: !preferences[key] };
      
      const { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: newPreferences })
        .eq('id', user?.id);

      if (error) throw error;

      setPreferences(newPreferences);
    } catch (error) {
      console.error('Error updating notification preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 pb-16 pt-16">
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="text-white">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-white font-medium ml-4">Notification Settings</h1>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-white font-medium">Push Notifications</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Choose what notifications you want to receive
                </p>
              </div>

              <div className="divide-y divide-gray-700">
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-white">Mentions</h3>
                    <p className="text-gray-400 text-sm">
                      When someone mentions you in a comment
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle('mentions')}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                      preferences.mentions ? 'bg-orange-500' : 'bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        preferences.mentions ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-white">Replies</h3>
                    <p className="text-gray-400 text-sm">
                      When someone replies to your comment
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle('replies')}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                      preferences.replies ? 'bg-orange-500' : 'bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        preferences.replies ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-white">Votes</h3>
                    <p className="text-gray-400 text-sm">
                      When someone votes on your deals or promos
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle('votes')}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                      preferences.votes ? 'bg-orange-500' : 'bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        preferences.votes ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-white">Favorites</h3>
                    <p className="text-gray-400 text-sm">
                      When someone favorites your deals or promos
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle('favorites')}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                      preferences.favorites ? 'bg-orange-500' : 'bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        preferences.favorites ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-white font-medium">Email Notifications</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Receive notifications via email
                </p>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-white">Email Updates</h3>
                  <p className="text-gray-400 text-sm">
                    Receive notifications in your email
                  </p>
                </div>
                <button
                  onClick={() => handleToggle('email_notifications')}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                    preferences.email_notifications ? 'bg-orange-500' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.email_notifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationSettingsPage;