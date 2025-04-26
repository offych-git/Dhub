import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadNotifications();
      subscribeToNotifications();
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const subscribeToNotifications = () => {
    const subscription = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const loadNotifications = async () => {
    try {
      const { data: notifs, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:actor_id (
            id,
            email,
            display_name
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setNotifications(notifs || []);
      
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', user?.id)
        .eq('read', false);

      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const markAsRead = async (notificationId?: string) => {
    try {
      if (notificationId) {
        // Mark single notification as read
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId);
      } else {
        // Mark all notifications as read
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user?.id)
          .eq('read', false);
      }

      await loadNotifications();
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getNotificationText = (notification: any) => {
    const actorName = notification.actor?.display_name || 
                     notification.actor?.email?.split('@')[0] || 
                     'Someone';

    switch (notification.type) {
      case 'mention':
        return `${actorName} mentioned you in a comment`;
      case 'reply':
        return `${actorName} replied to your comment`;
      case 'vote':
        return `${actorName} voted on your ${notification.source_type === 'deal' ? 'deal' : 'promo'}`;
      case 'favorite':
        return `${actorName} favorited your ${notification.source_type === 'deal' ? 'deal' : 'promo'}`;
      default:
        return notification.content;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-white hover:text-orange-500"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-50">
          <div className="p-3 border-b border-gray-700 flex justify-between items-center">
            <h3 className="text-white font-medium">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAsRead()}
                className="text-orange-500 text-sm hover:text-orange-400"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                No notifications yet
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 border-b border-gray-700 hover:bg-gray-700 cursor-pointer ${
                    !notification.read ? 'bg-gray-700/50' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-600 mr-3">
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                          notification.actor?.display_name || 
                          notification.actor?.email?.split('@')[0] || 
                          'User'
                        )}&background=random`}
                        alt="User avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm">
                        {getNotificationText(notification)}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;