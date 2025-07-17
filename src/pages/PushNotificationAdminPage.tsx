import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Bell, 
  Users, 
  Send, 
  MessageSquare, 
  Loader, 
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  User,
  Settings,
  TestTube,
  Zap
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  push_token: string;
  language?: string;
  push_tokens?: string[];
  deviceCount?: number;
  devices?: Array<{
    createdAt: string;
    token: string;
    hasToken: boolean;
    type: string;
    platform: string;
    lastActive?: string;
    appVersion?: string;
    deviceId?: string;
  }>;
}

interface NotificationStats {
  totalUsers: number;
  usersWithTokens: number;
  sentToday: number;
}

const PushNotificationAdminPage: React.FC = () => {
  const { isAdmin, loading } = useAdmin();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    totalUsers: 0,
    usersWithTokens: 0,
    sentToday: 0
  });
  
  const [testTitle, setTestTitle] = useState('🧪 Тестовое уведомление');
  const [testMessage, setTestMessage] = useState('Это тестовое уведомление для проверки работы системы');
  const [massTitle, setMassTitle] = useState('');
  const [massMessage, setMassMessage] = useState('');
  const [notificationType, setNotificationType] = useState('deal');
  const [category, setCategory] = useState('');
  const [notificationUrl, setNotificationUrl] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [testDealId, setTestDealId] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [alerts, setAlerts] = useState<Array<{id: number, message: string, type: 'success' | 'error' | 'info'}>>([]);
  const [alertCounter, setAlertCounter] = useState(0);
  const [currentStep, setCurrentStep] = useState<'setup' | 'compose' | 'send'>('setup');
  const [testMode, setTestMode] = useState(true);
  const [userProfileStatus, setUserProfileStatus] = useState<'unknown' | 'checking' | 'found' | 'not_found' | 'no_token'>('unknown');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'single' | 'multiple'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string>('all');
  const [dataQualityFilter, setDataQualityFilter] = useState<'all' | 'good' | 'unknown'>('all');
  
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([]);
  const [availableDeviceTypes, setAvailableDeviceTypes] = useState<string[]>([]);

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = alertCounter;
    setAlertCounter(prev => prev + 1);
    setAlerts(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setAlerts(prev => prev.filter(alert => alert.id !== id));
    }, 5000);
  };

  const checkUserProfile = async () => {
    if (!user?.id) return;
    
    setUserProfileStatus('checking');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, push_token')
        .eq('id', user.id)
        .single();
      
      if (error || !data) {
        setUserProfileStatus('not_found');
        return;
      }
      
      if (data.push_token) {
        setUserProfileStatus('found');
        setSelectedUsers([user.id]);
      } else {
        setUserProfileStatus('no_token');
      }
    } catch (err) {
      setUserProfileStatus('not_found');
    }
  };

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const { data: allDevices, error: devErr } = await supabase
        .from('user_devices')
        .select('*');
      if (devErr) throw devErr;

      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, email, push_token');
      if (pErr) throw pErr;

      const deviceUserIds = new Set(allDevices.map(d => d.user_id));
      const profileUserIds = new Set(profiles.map(p => p.id));
      const allUserIds = new Set([...deviceUserIds, ...profileUserIds]);

      const devicesByUser: Record<string, any[]> = {};
      allDevices.forEach((d: any) => {
        if (!devicesByUser[d.user_id]) devicesByUser[d.user_id] = [];
        devicesByUser[d.user_id].push(d);
      });

      const usersList: User[] = Array.from(allUserIds)
        .map((userId: string) => {
          const profile = profiles.find(p => p.id === userId);
          const userDevices = devicesByUser[userId] || [];
          
          const tokenSet = new Set<string>();
          userDevices.forEach((d: any) => {
            if (d.push_token) tokenSet.add(d.push_token);
          });
          if (profile?.push_token && !tokenSet.has(profile.push_token)) {
            tokenSet.add(profile.push_token);
          }
          const tokens = Array.from(tokenSet);

          return {
            id: userId,
            email: profile?.email || `User ${userId.slice(0, 8)}...`,
            language: 'ru',
            push_token: tokens[0] || '',
            push_tokens: tokens,
            deviceCount: userDevices.length,
            devices: userDevices.map((d: any) => ({
              createdAt: d.created_at,
              token: d.push_token,
              hasToken: !!d.push_token && d.push_token !== '',
              type: d.device_type,
              platform: d.platform,
              lastActive: d.last_active,
              appVersion: d.app_version,
              deviceId: d.device_identifier,
            })),
          };
        })
        .filter(user => user.push_token);

      setUsers(usersList);

      const platforms = [...new Set(usersList.flatMap(u => (u.devices ?? []).map(d => d.platform)))];
      const deviceTypes = [...new Set(usersList.flatMap(u => (u.devices ?? []).map(d => d.type)))];
      setAvailablePlatforms(platforms as string[]);
      setAvailableDeviceTypes(deviceTypes as string[]);
    } catch (e: any) {
      console.error('loadUsers error:', e);
      showAlert(`Ошибка загрузки пользователей: ${e.message}`, 'error');
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadStats = async () => { /* ... */ };
  const [languageStats, setLanguageStats] = useState<{[key: string]: number}>({});
  const loadLanguageStats = async () => { /* ... */ };

  const getFilteredUsers = () => {
    let filtered = users;
    
    if (selectedLanguage !== 'all') {
      filtered = filtered.filter(user => (user.language || 'unknown') === selectedLanguage);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.email?.toLowerCase().includes(query) ||
        user.id.toLowerCase().includes(query)
      );
    }
    
    if (deviceFilter !== 'all') {
      filtered = filtered.filter(user => {
        const deviceCount = user.deviceCount || (user.push_token ? 1 : 0);
        return deviceFilter === 'single' ? deviceCount === 1 : deviceCount > 1;
      });
    }

    if (platformFilter !== 'all') {
        filtered = filtered.filter(user => (user.devices ?? []).some(d => d.platform === platformFilter));
    }
    
    if (deviceTypeFilter !== 'all') {
        filtered = filtered.filter(user => (user.devices ?? []).some(d => d.type === deviceTypeFilter));
    }
    
    if (dataQualityFilter !== 'all') {
      filtered = filtered.filter(user => {
        const hasGoodData = (user.devices ?? []).some(d => d.platform !== 'unknown' && d.type !== 'unknown' && d.appVersion && d.appVersion !== 'unknown');
        return dataQualityFilter === 'good' ? hasGoodData : !hasGoodData;
      });
    }

    return filtered;
  };

  const sendNotification = async () => {
    const title = testMode ? testTitle : massTitle;
    const message = testMode ? testMessage : massMessage;
    const filteredUsers = getFilteredUsers();
    const recipients = testMode ? selectedUsers : filteredUsers.map(u => u.id);

    if (!title || !message) {
      showAlert('Заполните заголовок и текст уведомления', 'error');
      return;
    }

    if (testMode && recipients.length === 0) {
      showAlert('Выберите получателей для тестирования', 'error');
      return;
    }

    if (!testMode) {
      const targetCount = filteredUsers.length;
      const confirmed = confirm(`Вы собираетесь отправить уведомление ${targetCount} пользователям. Продолжить?`);
      if (!confirmed) return;
    }

    setIsLoading(true);
    try {
      const extractDealId = (input: string) => {
        if (/^[0-9a-f]{8}-/i.test(input)) return input;
        const match = input.match(/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
        return match ? match[1] : '';
      };

      const dealIdForPush = testMode ? extractDealId(testDealId) : '';

      // ✅ =================================================================
      // ✅ ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ: Отправляем "плоский" объект без обертки { body: ... }
      // ✅ =================================================================
      const payloadToSend = {
        targetUserIds: recipients,
        title,
        body: message,
        data: {
          type: testMode ? 'test' : notificationType,
          category: testMode ? '' : category,
          url: testMode ? '' : notificationUrl,
          entity_id: dealIdForPush,
          timestamp: new Date().toISOString()
        }
      };

      const { data, error } = await supabase.functions.invoke('send-push-notification-v2', payloadToSend);
      // =================================================================

      if (error) throw error;
      
      if (data.success) {
        showAlert(`✅ Уведомление успешно отправлено ${recipients.length} пользователям!`, 'success');
        if (!testMode) {
            setMassTitle('');
            setMassMessage('');
            setCurrentStep('setup');
        }
      } else {
        showAlert(`❌ Ошибка отправки: ${data.message}`, 'error');
      }
      
    } catch (error) {
      console.error('Error sending notification:', error);
      showAlert('❌ Ошибка: ' + (error as Error).message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadStats();
      loadLanguageStats();
      checkUserProfile();
      loadUsers();
    }
  }, [isAdmin]);
  
  // ... остальной JSX код для рендеринга ...
  // (Этот код слишком длинный для включения сюда, но он остается без изменений)

  if (loading) return <div>Loading...</div>;
  if (!isAdmin) return <div>Access Denied</div>;
  
  return (
    // Весь ваш JSX код остается здесь...
    <div className="min-h-screen bg-gray-50 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Push-уведомления</h1>
        {/* Здесь должен быть весь ваш JSX для UI, он остается без изменений */}
        <p>UI компоненты и верстка остаются прежними.</p>
        <button onClick={sendNotification} disabled={isLoading}>
            {isLoading ? "Отправка..." : "Отправить уведомление"}
        </button>
    </div>
  );
};

export default PushNotificationAdminPage;