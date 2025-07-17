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
  
  // States
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    totalUsers: 0,
    usersWithTokens: 0,
    sentToday: 0
  });
  
  // Form states
  const [testTitle, setTestTitle] = useState('🧪 Тестовое уведомление');
  const [testMessage, setTestMessage] = useState('Это тестовое уведомление для проверки работы системы');
  const [massTitle, setMassTitle] = useState('');
  const [massMessage, setMassMessage] = useState('');
  const [notificationType, setNotificationType] = useState('deal');
  const [category, setCategory] = useState('');
  const [notificationUrl, setNotificationUrl] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [testDealId, setTestDealId] = useState('');
  
  // Language-specific message templates
  const getMessageTemplates = (lang: string) => {
    const templates = {
      ru: {
        deal: { title: '🔥 Новая скидка до 70%!', message: 'Не упустите возможность сэкономить на любимых товарах!' },
        promo: { title: '🎁 Специальное предложение', message: 'Эксклюзивная акция только для вас!' },
        news: { title: '📰 Важные новости', message: 'Узнайте первыми о последних обновлениях' }
      },
      en: {
        deal: { title: '🔥 New deal up to 70% off!', message: 'Don\'t miss the chance to save on your favorite items!' },
        promo: { title: '🎁 Special offer', message: 'Exclusive promotion just for you!' },
        news: { title: '📰 Important news', message: 'Be the first to know about the latest updates' }
      },
      es: {
        deal: { title: '🔥 ¡Nueva oferta hasta 70% de descuento!', message: '¡No pierdas la oportunidad de ahorrar en tus productos favoritos!' },
        promo: { title: '🎁 Oferta especial', message: '¡Promoción exclusiva solo para ti!' },
        news: { title: '📰 Noticias importantes', message: 'Sé el primero en conocer las últimas actualizaciones' }
      }
    };
    
    return templates[lang as keyof typeof templates] || templates.ru;
  };

  // Apply template based on language and type
  const applyTemplate = () => {
    if (selectedLanguage === 'all' || testMode) return;
    
    const templates = getMessageTemplates(selectedLanguage);
    const template = templates[notificationType as keyof typeof templates];
    
    if (template) {
      setMassTitle(template.title);
      setMassMessage(template.message);
    }
  };
  
  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [alerts, setAlerts] = useState<Array<{id: number, message: string, type: 'success' | 'error' | 'info'}>>([]);
  const [alertCounter, setAlertCounter] = useState(0);
  const [currentStep, setCurrentStep] = useState<'setup' | 'compose' | 'send'>('setup');
  const [testMode, setTestMode] = useState(true);
  const [userProfileStatus, setUserProfileStatus] = useState<'unknown' | 'checking' | 'found' | 'not_found' | 'no_token'>('unknown');
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'single' | 'multiple'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string>('all');
  const [dataQualityFilter, setDataQualityFilter] = useState<'all' | 'good' | 'unknown'>('all');
  
  // Available filter options (populated from data)
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([]);
  const [availableDeviceTypes, setAvailableDeviceTypes] = useState<string[]>([]);

  // Alert functions
  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = alertCounter;
    setAlertCounter(prev => prev + 1);
    setAlerts(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setAlerts(prev => prev.filter(alert => alert.id !== id));
    }, 5000);
  };

  // Auto-check user profile on load
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

  // Load users
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

  // Load statistics
  const loadStats = async () => { /* ... */ };
  const [languageStats, setLanguageStats] = useState<{[key: string]: number}>({});
  const loadLanguageStats = async () => { /* ... */ };

  const getFilteredUsers = () => {
    let filtered = users;
    // ... filtering logic ...
    return filtered;
  };

  // Send notification
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
      const confirmed = confirm(`Вы собираетесь отправить уведомление ${recipients.length} пользователям. Продолжить?`);
      if (!confirmed) return;
    }

    setIsLoading(true);
    try {
      const extractDealId = (input: string) => {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input)) {
          return input;
        }
        const match = input.match(/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
        return match ? match[1] : '';
      };
      const dealIdForPush = testMode ? extractDealId(testDealId) : '';

      // ✅ ИСПРАВЛЕННЫЙ ВЫЗОВ: Отправляем "плоский" объект без обертки { body: ... }
      const { data, error } = await supabase.functions.invoke('send-push-notification-v2', {
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
      });

      if (error) throw error;
      
      if (data.success) {
        showAlert(`✅ Уведомление успешно отправлено ${recipients.length} пользователям!`, 'success');
      } else {
        showAlert(`❌ Ошибка отправки: ${data.message || 'Неизвестная ошибка'}`, 'error');
      }
      
    } catch (error) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="animate-spin h-8 w-8 text-orange-500" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Доступ запрещен</h2>
          <p className="text-gray-600 mb-6">
            У вас нет прав администратора для доступа к этой странице.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  const getStepIcon = (step: string) => { /* ... */ return null; };
  const canProceedToCompose = () => { /* ... */ return true; };
  const canSend = () => { /* ... */ return true; };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`px-4 py-3 rounded-md shadow-lg max-w-sm ${
              alert.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
              alert.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
              'bg-blue-100 text-blue-800 border border-blue-200'
            }`}
          >
            {alert.message}
          </div>
        ))}
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-8 w-8 text-orange-500" />
            <h1 className="text-3xl font-bold text-gray-900">Push-уведомления</h1>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4 border">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium text-gray-600">Всего пользователей</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalUsers}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-gray-600">С push-токенами</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.usersWithTokens}</p>
              <div className="text-xs text-gray-500 mt-1">
                {stats.totalUsers > 0 ? Math.round((stats.usersWithTokens / stats.totalUsers) * 100) : 0}% конверсия
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-orange-500" />
                <span className="text-sm font-medium text-gray-600">Отправлено сегодня</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.sentToday}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-500" />
                <span className="text-sm font-medium text-gray-600">Языки</span>
              </div>
              <div className="mt-1">
                {Object.entries(languageStats).slice(0, 3).map(([lang, count]) => (
                  <div key={lang} className="flex justify-between text-xs">
                    <span className="text-gray-600">{lang}:</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
                {Object.keys(languageStats).length > 3 && (
                  <div className="text-xs text-gray-400 mt-1">
                    +{Object.keys(languageStats).length - 3} еще
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Режим отправки</h3>
                <p className="text-sm text-gray-600">
                  {testMode ? 'Безопасное тестирование на выбранных пользователях' : 'Массовая рассылка всем пользователям'}
                </p>
              </div>
              <div className="flex bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setTestMode(true);
                    setCurrentStep('setup');
                  }}
                  className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 sm:flex-none ${
                    testMode 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <TestTube className="h-4 w-4" />
                  <span className="hidden sm:inline">Тестирование</span>
                  <span className="sm:hidden">Тест</span>
                </button>
                <button
                  onClick={() => {
                    setTestMode(false);
                    setCurrentStep('setup');
                  }}
                  className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 sm:flex-none ${
                    !testMode 
                      ? 'bg-white text-red-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Zap className="h-4 w-4" />
                  <span className="hidden sm:inline">Массовая рассылка</span>
                  <span className="sm:hidden">Массовая</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border">
          <div className="border-b px-4 sm:px-6 py-4">
            <div className="flex items-center justify-center">
              <div className="flex items-center space-x-4 sm:space-x-8">
                {['setup', 'compose', 'send'].map((step, index) => (
                  <div key={step} className="flex items-center">
                    <div className={`flex items-center gap-1 sm:gap-2 ${
                      currentStep === step 
                        ? 'text-orange-600' 
                        : index < ['setup', 'compose', 'send'].indexOf(currentStep)
                          ? 'text-green-600'
                          : 'text-gray-400'
                    }`}>
                      {getStepIcon(step)}
                      <span className="font-medium text-sm sm:text-base hidden sm:inline">
                        {step === 'setup' ? 'Настройка' : 
                         step === 'compose' ? 'Создание' : 'Отправка'}
                      </span>
                      <span className="font-medium text-xs sm:hidden">
                        {step === 'setup' ? '1' : 
                         step === 'compose' ? '2' : '3'}
                      </span>
                    </div>
                    {index < 2 && (
                      <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 text-gray-300 ml-2 sm:ml-4" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {currentStep === 'setup' && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    {testMode ? 'Настройка тестирования' : 'Подготовка массовой рассылки'}
                  </h2>
                  <p className="text-gray-600">
                    {testMode 
                      ? 'Выберите получателей для безопасного тестирования уведомлений'
                      : 'Проверьте количество получателей перед массовой рассылкой'
                    }
                  </p>
                </div>
                {testMode ? (
                  <div>
                    <div className={`p-4 rounded-lg border mb-4 ${
                      userProfileStatus === 'found' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
                    }`}>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      {/* ... User selection UI ... */}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    {/* ... Mass send summary JSX ... */}
                  </div>
                )}
                <div className="flex justify-center sm:justify-end">
                   <button onClick={() => setCurrentStep('compose')} disabled={!canProceedToCompose()} className="...">Далее</button>
                 </div>
              </div>
            )}
            {currentStep === 'compose' && (
              <div className="space-y-6">{/* ... Compose Step JSX ... */}</div>
            )}
            {currentStep === 'send' && (
              <div className="space-y-6">{/* ... Send Step JSX ... */}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
 
export default PushNotificationAdminPage;