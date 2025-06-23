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
  push_tokens?: string[]; // Массив токенов для множественных устройств
  deviceCount?: number;   // Количество устройств
  devices?: Array<{       // Детали устройств
    token: string;
    type: string;
    platform: string;
  }>;
}

interface NotificationStats {
  totalUsers: number;
  usersWithTokens: number;
  sentToday: number;
}

const PushNotificationAdminPage: React.FC = () => {
  const { role, isAdmin, loading } = useAdmin();
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
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all'); // 'all' или конкретный язык
  
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
      // he: {
      //   deal: { title: '🔥 הנחה חדשה עד 70%!', message: 'אל תפספסו הזדמנות לחסוך על המוצרים האהובים עליכם!' },
      //   promo: { title: '🎁 הצעה מיוחדת', message: 'מבצע בלעדי רק בשבילכם!' },
      //   news: { title: '📰 חדשות חשובות', message: 'היו הראשונים לדעת על העדכונים האחרונים' }
      // },
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
  const [alerts, setAlerts] = useState<Array<{id: number, message: string, type: 'success' | 'error' | 'info'}>>([]);
  const [alertCounter, setAlertCounter] = useState(0);
  const [currentStep, setCurrentStep] = useState<'setup' | 'compose' | 'send'>('setup');
  const [testMode, setTestMode] = useState(true); // Начинаем с тестового режима
  const [userProfileStatus, setUserProfileStatus] = useState<'unknown' | 'checking' | 'found' | 'not_found' | 'no_token'>('unknown');

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
        // Автоматически выбираем себя для тестирования
        setSelectedUsers([user.id]);
      } else {
        setUserProfileStatus('no_token');
      }
    } catch (err) {
      setUserProfileStatus('not_found');
    }
  };

  // Load users with push tokens
  const loadUsers = async () => {
    try {
      console.log('🔍 Loading users with push tokens...');
      
      // Сначала пробуем загрузить из новой таблицы user_devices
      let { data: devicesData, error: devicesError } = await supabase
        .from('user_devices')
        .select(`
          user_id,
          push_token,
          device_type,
          platform,
          profiles!inner(id, email, language)
        `)
        .not('push_token', 'is', null);

      if (!devicesError && devicesData && devicesData.length > 0) {
        console.log('✅ Loaded users from user_devices table:', devicesData.length);
        
        // Группируем устройства по пользователям
        const userMap = new Map();
        
        devicesData.forEach((device: any) => {
          const userId = device.user_id;
          const profile = device.profiles;
          
          if (!userMap.has(userId)) {
            userMap.set(userId, {
              id: userId,
              email: profile?.email || 'Unknown',
              language: profile?.language || 'ru',
              push_tokens: [], // Массив токенов для всех устройств
              devices: []
            });
          }
          
          const user = userMap.get(userId);
          user.push_tokens.push(device.push_token);
          user.devices.push({
            token: device.push_token,
            type: device.device_type,
            platform: device.platform
          });
        });
        
        // Преобразуем Map в массив и добавляем совместимость со старым форматом
        const usersWithDevices = Array.from(userMap.values()).map(user => ({
          ...user,
          push_token: user.push_tokens[0], // Для совместимости со старым кодом
          deviceCount: user.push_tokens.length
        }));
        
        setUsers(usersWithDevices);
        console.log('📱 Users with multiple devices loaded:', usersWithDevices.length);
        
      } else {
        console.log('⚠️ user_devices table not found or empty, falling back to profiles...');
        
        // Fallback: загружаем из старой таблицы profiles
        let { data, error } = await supabase
          .from('profiles')
          .select('id, email, push_token, language')
          .not('push_token', 'is', null);
        
        // If language column doesn't exist, load without it
        if (error && error.message.includes('column profiles.language does not exist')) {
          console.warn('Language column not found, loading without language data');
          const result = await supabase
            .from('profiles')
            .select('id, email, push_token')
            .not('push_token', 'is', null);
          
          data = result.data?.map(user => ({ 
            ...user, 
            language: 'ru',
            push_tokens: [user.push_token], // Преобразуем в массив для совместимости
            deviceCount: 1
          })) || [];
          error = result.error;
        } else if (data) {
          // Преобразуем старый формат в новый для совместимости
          data = data.map(user => ({
            ...user,
            push_tokens: [user.push_token],
            deviceCount: 1
          }));
        }
        
        if (error) throw error;
        setUsers(data || []);
        console.log('📱 Users loaded from profiles (fallback):', data?.length || 0);
      }
      
      // Если пользователь найден и у него есть токен, автоматически выбираем его
      if (userProfileStatus === 'found' && user?.id) {
        setSelectedUsers([user.id]);
      }
      
    } catch (error) {
      console.error('Error loading users:', error);
      showAlert('Ошибка загрузки пользователей: ' + (error as Error).message, 'error');
    }
  };

  // Load statistics
  const loadStats = async () => {
    try {
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      // Пробуем получить статистику из новой таблицы user_devices
      let { data: devicesData, error: devicesError } = await supabase
        .from('user_devices')
        .select('user_id')
        .not('push_token', 'is', null);
      
      let usersWithTokens = 0;
      
      if (!devicesError && devicesData && devicesData.length > 0) {
        // Подсчитываем уникальных пользователей с устройствами
        const uniqueUsers = new Set(devicesData.map(d => d.user_id));
        usersWithTokens = uniqueUsers.size;
        console.log('📊 Stats from user_devices:', usersWithTokens, 'users with', devicesData.length, 'devices');
      } else {
        // Fallback к старой таблице profiles
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .not('push_token', 'is', null);
        usersWithTokens = count || 0;
        console.log('📊 Stats from profiles (fallback):', usersWithTokens, 'users');
      }
      
      const today = new Date().toISOString().split('T')[0];
      const { count: sentToday } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);
      
      setStats({
        totalUsers: totalUsers || 0,
        usersWithTokens,
        sentToday: sentToday || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Load language statistics
  const [languageStats, setLanguageStats] = useState<{[key: string]: number}>({});
  
  const loadLanguageStats = async () => {
    try {
      // Try to load with language column first
      let { data, error } = await supabase
        .from('profiles')
        .select('language, push_token')
        .not('push_token', 'is', null);
      
      // If language column doesn't exist, create default stats
      if (error && error.message.includes('column profiles.language does not exist')) {
        console.warn('Language column not found, using default language stats');
        const result = await supabase
          .from('profiles')
          .select('push_token')
          .not('push_token', 'is', null);
        
        if (result.error) throw result.error;
        
        // Set all users as Russian by default
        const stats: {[key: string]: number} = {
          'ru': result.data?.length || 0
        };
        setLanguageStats(stats);
        return;
      }
      
      if (error) throw error;
      
      const stats: {[key: string]: number} = {};
      data?.forEach(profile => {
        const lang = profile.language || 'ru';
        stats[lang] = (stats[lang] || 0) + 1;
      });
      
      setLanguageStats(stats);
    } catch (error) {
      console.error('Error loading language stats:', error);
    }
  };

  // Get filtered users by language
  const getFilteredUsers = () => {
    if (selectedLanguage === 'all') {
      return users;
    }
    return users.filter(user => {
      const userLang = user.language || 'unknown';
      return userLang === selectedLanguage;
    });
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

    // Подтверждение для массовой рассылки
    if (!testMode) {
      const targetCount = filteredUsers.length;
      const languageInfo = selectedLanguage === 'all' 
        ? 'всем пользователям' 
        : `пользователям с языком "${selectedLanguage}"`;
      
      const confirmed = confirm(
        `Вы собираетесь отправить уведомление ${targetCount} ${languageInfo}!\n\n` +
        `Заголовок: ${title}\n` +
        `Текст: ${message}\n\n` +
        `Это действие нельзя отменить. Продолжить?`
      );
      if (!confirmed) return;
    }

    try {
      setIsLoading(true);
      
      // ИСПОЛЬЗУЕМ НОВУЮ СИСТЕМУ МНОЖЕСТВЕННЫХ УСТРОЙСТВ
      // Отправляем targetUserIds вместо targetTokens - так Edge Function сам соберет все токены
      console.log(`📤 Sending to ${recipients.length} users (all their devices will receive notification)`);

      const { data, error } = await supabase.functions.invoke('send-push-notification-v2', {
        body: {
          targetUserIds: recipients, // Используем targetUserIds для множественных устройств!
          title,
          body: message,
          data: {
            type: testMode ? 'test' : notificationType,
            category: testMode ? '' : category,
            url: testMode ? '' : notificationUrl,
            timestamp: new Date().toISOString()
          }
        }
      });

      if (error) throw error;
      
      if (data.success) {
        const userCount = recipients.length;
        const isOnlyMe = testMode && recipients.length === 1 && recipients[0] === user?.id;
        
        showAlert(
          isOnlyMe 
            ? '✅ Тестовое уведомление отправлено вам на все ваши устройства! Проверьте телефон.' 
            : testMode
              ? `✅ Тестовое уведомление отправлено ${userCount} пользователям на все их устройства`
              : `🎉 Массовое уведомление отправлено ${userCount} пользователям на все их устройства!`,
          'success'
        );
        
        // Очищаем форму после массовой рассылки
        if (!testMode) {
          setMassTitle('');
          setMassMessage('');
          setCategory('');
          setNotificationUrl('');
          setTestMode(true); // Возвращаемся в тестовый режим
          setCurrentStep('setup');
        }
      } else {
        showAlert('❌ Ошибка отправки: ' + data.message, 'error');
      }
      
    } catch (error) {
      console.error('Error sending notification:', error);
      showAlert('❌ Ошибка: ' + (error as Error).message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (isAdmin) {
      loadStats();
      loadLanguageStats();
      checkUserProfile();
      loadUsers();
    }
  }, [isAdmin, user?.id]);

  // Check admin access
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

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'setup': return <Settings className="h-5 w-5" />;
      case 'compose': return <MessageSquare className="h-5 w-5" />;
      case 'send': return <Send className="h-5 w-5" />;
      default: return null;
    }
  };

  const canProceedToCompose = () => {
    if (testMode) {
      return selectedUsers.length > 0 || userProfileStatus === 'found';
    }
    return users.length > 0;
  };

  const canSend = () => {
    const title = testMode ? testTitle : massTitle;
    const message = testMode ? testMessage : massMessage;
    return title.trim() && message.trim() && !isLoading;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">
        {/* Alert System */}
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

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="h-8 w-8 text-orange-500" />
          <h1 className="text-3xl font-bold text-gray-900">Push-уведомления</h1>
        </div>
        
        {/* Stats */}
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

        {/* Mode Toggle */}
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

        {/* Recommendations Section */}
        {stats.usersWithTokens < stats.totalUsers * 0.3 && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 rounded-full p-2">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">
                  💡 Как увеличить количество подписчиков на уведомления
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <h4 className="font-medium text-blue-800">📱 В мобильном приложении:</h4>
                    <ul className="text-blue-700 space-y-1">
                      <li>• Объяснить ценность перед запросом разрешения</li>
                      <li>• Показать примеры полезных уведомлений</li>
                      <li>• Запрашивать в подходящий момент</li>
                      <li>• Повторно предлагать через время</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-blue-800">🌐 На веб-сайте:</h4>
                    <ul className="text-blue-700 space-y-1">
                      <li>• Промо-баннер "Скачай приложение"</li>
                      <li>• QR-код для быстрой установки</li>
                      <li>• Web Push как альтернатива</li>
                      <li>• Email-кампании с предложением</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-3 text-xs text-blue-600">
                  Текущая конверсия: {stats.totalUsers > 0 ? Math.round((stats.usersWithTokens / stats.totalUsers) * 100) : 0}% 
                  (рекомендуется 30%+)
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Step Navigation */}
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
          {/* Step 1: Setup */}
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
                  {/* User Profile Status */}
                  <div className={`p-4 rounded-lg border mb-4 ${
                    userProfileStatus === 'found' ? 'bg-green-50 border-green-200' :
                    userProfileStatus === 'no_token' ? 'bg-yellow-50 border-yellow-200' :
                    userProfileStatus === 'not_found' ? 'bg-red-50 border-red-200' :
                    'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5" />
                      <div className="flex-1">
                        {userProfileStatus === 'checking' && (
                          <p className="text-blue-800">🔍 Проверяю ваш профиль...</p>
                        )}
                        {userProfileStatus === 'found' && (
                          <div>
                            <p className="text-green-800 font-medium">✅ Ваш профиль готов к тестированию</p>
                            <p className="text-green-700 text-sm">У вас есть push-токен, вы автоматически выбраны для тестирования</p>
                          </div>
                        )}
                        {userProfileStatus === 'no_token' && (
                          <div>
                            <p className="text-yellow-800 font-medium">⚠️ Нет push-токена</p>
                            <p className="text-yellow-700 text-sm">Зайдите в мобильное приложение и разрешите уведомления</p>
                          </div>
                        )}
                        {userProfileStatus === 'not_found' && (
                          <div>
                            <p className="text-red-800 font-medium">❌ Профиль не найден</p>
                            <p className="text-red-700 text-sm">Ваш аккаунт не найден в системе</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recipients Selection */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-3">
                      Получатели тестирования ({selectedUsers.length} выбрано)
                    </h3>
                    
                    {users.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                        <p>Загружаю список пользователей...</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {users.map(userItem => (
                          <label key={userItem.id} className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(userItem.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUsers(prev => [...prev, userItem.id]);
                                } else {
                                  setSelectedUsers(prev => prev.filter(id => id !== userItem.id));
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">
                                  {userItem.email || 'Пользователь без email'}
                                </span>
                                {userItem.id === user?.id && (
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                    Это вы
                                  </span>
                                )}
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  (userItem.deviceCount || 1) > 1 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  📱 {userItem.deviceCount || 1} {(userItem.deviceCount || 1) === 1 ? 'устройство' : 'устройств'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                {userItem.push_tokens && userItem.push_tokens.length > 1 
                                  ? `${userItem.push_tokens.length} токенов: ${userItem.push_tokens[0].substring(0, 15)}...`
                                  : `Токен: ${userItem.push_token?.substring(0, 20)}...`
                                }
                              </p>
                              {userItem.devices && userItem.devices.length > 0 && (
                                <div className="text-xs text-blue-600 mt-1">
                                  <span className="font-medium">Устройства: </span>
                                  {userItem.devices.map((d, idx) => (
                                    <span key={idx} className="inline-block mr-2 mb-1">
                                      {d.platform === 'android' ? '🤖' : d.platform === 'ios' ? '📱' : '💻'} 
                                      {d.platform} ({d.type === 'expo_go' ? 'Expo Go' : d.type === 'development_build' ? 'Dev Build' : d.type})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Zap className="h-16 w-16 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Массовая рассылка
                  </h3>
                  <div className="text-gray-600 mb-4">
                    <p>Уведомление будет отправлено <strong>{users.length} пользователям</strong> с push-токенами</p>
                    <p className="text-sm mt-2">
                      📱 Общее количество устройств: <strong>
                        {users.reduce((total, user) => total + (user.deviceCount || 1), 0)}
                      </strong>
                    </p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-red-800 text-sm">
                      ⚠️ Это действие нельзя отменить. Убедитесь, что уведомление готово к отправке.
                    </p>
                  </div>
                </div>
              )}

                             <div className="flex justify-center sm:justify-end">
                 <button
                   onClick={() => setCurrentStep('compose')}
                   disabled={!canProceedToCompose()}
                   className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                 >
                   <span className="hidden sm:inline">Создать уведомление</span>
                   <span className="sm:hidden">Далее</span>
                   <ArrowRight className="h-4 w-4" />
                 </button>
               </div>
            </div>
          )}

          {/* Step 2: Compose */}
          {currentStep === 'compose' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {testMode ? 'Тестовое уведомление' : 'Массовое уведомление'}
                </h2>
                <div className="text-gray-600">
                  {testMode ? (
                    <p>
                      Создайте уведомление для <strong>{selectedUsers.length}</strong> получателей
                      <br />
                      <span className="text-sm">
                        📱 Будет отправлено на {users.filter(u => selectedUsers.includes(u.id))
                          .reduce((total, user) => total + (user.deviceCount || 1), 0)} устройств
                      </span>
                    </p>
                  ) : (
                    <p>
                      Создайте уведомление для <strong>{getFilteredUsers().length}</strong> пользователей
                      <br />
                      <span className="text-sm">
                        📱 Будет отправлено на {getFilteredUsers().reduce((total, user) => total + (user.deviceCount || 1), 0)} устройств
                      </span>
                      {selectedLanguage !== 'all' && (
                        <span className="block text-sm text-blue-600 mt-1">
                          Фильтр по языку: {selectedLanguage}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>

                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Заголовок уведомления *
                   </label>
                   <input
                     type="text"
                     value={testMode ? testTitle : massTitle}
                     onChange={(e) => testMode ? setTestTitle(e.target.value) : setMassTitle(e.target.value)}
                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm sm:text-base"
                     placeholder={testMode ? "🧪 Тестовое уведомление" : "🔥 Новая скидка 50%!"}
                   />
                 </div>

                 {!testMode && (
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Тип уведомления
                     </label>
                     <select
                       value={notificationType}
                       onChange={(e) => setNotificationType(e.target.value)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm sm:text-base"
                     >
                       <option value="deal">🔥 Новая скидка</option>
                       <option value="promo">🎁 Промо-акция</option>
                       <option value="sweepstakes">🎰 Розыгрыш</option>
                       <option value="news">📰 Новости</option>
                       <option value="custom">✨ Произвольное</option>
                     </select>
                   </div>
                                  )}
               </div>

              {/* Language selector for mass notifications */}
              {!testMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🌍 Целевая аудитория по языку
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm sm:text-base"
                    >
                      <option value="all">Все языки ({users.length} пользователей)</option>
                      {Object.entries(languageStats).map(([lang, count]) => (
                        <option key={lang} value={lang}>
                                                  {lang === 'ru' ? '🇷🇺 Русский' :
                         lang === 'en' ? '🇺🇸 English' :
                         lang === 'uk' ? '🇺🇦 Українська' :
                         // lang === 'he' ? '🇮🇱 עברית' :
                         lang === 'es' ? '🇪🇸 Español' :
                         lang === 'unknown' ? '❓ Неизвестный' :
                         `🌐 ${lang}`
                        } ({count} пользователей)
                        </option>
                      ))}
                    </select>
                    {selectedLanguage !== 'all' && ['ru', 'en', 'es'].includes(selectedLanguage) && (
                      <button
                        onClick={applyTemplate}
                        className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm whitespace-nowrap"
                        title="Применить шаблон для выбранного языка"
                      >
                        📝 Шаблон
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Выберите язык для отправки уведомлений только пользователям с этим языком
                    {selectedLanguage !== 'all' && ['ru', 'en', 'es'].includes(selectedLanguage) && (
                      <span className="text-blue-600 ml-1">• Доступен шаблон сообщения</span>
                    )}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Текст уведомления *
                </label>
                                 <textarea
                   value={testMode ? testMessage : massMessage}
                   onChange={(e) => testMode ? setTestMessage(e.target.value) : setMassMessage(e.target.value)}
                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm sm:text-base"
                   rows={4}
                   placeholder={testMode 
                     ? "Это тестовое уведомление для проверки работы системы" 
                     : "Подробное описание акции или новости..."
                   }
                 />
              </div>

                             {!testMode && (
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Категория (необязательно)
                     </label>
                     <input
                       type="text"
                       value={category}
                       onChange={(e) => setCategory(e.target.value)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm sm:text-base"
                       placeholder="Электроника, Одежда, Дом и сад..."
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Ссылка (необязательно)
                     </label>
                     <input
                       type="url"
                       value={notificationUrl}
                       onChange={(e) => setNotificationUrl(e.target.value)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm sm:text-base"
                       placeholder="https://wedealz.com/deals/123"
                     />
                   </div>
                 </div>
               )}

                             <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0">
                 <button
                   onClick={() => setCurrentStep('setup')}
                   className="flex items-center justify-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 order-2 sm:order-1"
                 >
                   <ArrowLeft className="h-4 w-4" />
                   Назад
                 </button>
                 <button
                   onClick={() => setCurrentStep('send')}
                   disabled={!canSend()}
                   className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
                 >
                   <span className="hidden sm:inline">Просмотр и отправка</span>
                   <span className="sm:hidden">Далее</span>
                   <ArrowRight className="h-4 w-4" />
                 </button>
               </div>
            </div>
          )}

          {/* Step 3: Send */}
          {currentStep === 'send' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {testMode ? 'Отправка тестового уведомления' : 'Отправка массового уведомления'}
                </h2>
                <p className="text-gray-600">
                  Проверьте все данные перед отправкой
                </p>
              </div>

                             {/* Preview */}
               <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                 <h3 className="font-medium text-gray-900 mb-4 text-center">Предварительный просмотр</h3>
                 
                 <div className="bg-white rounded-lg shadow-sm border p-4 max-w-sm mx-auto">
                   <div className="flex items-center gap-2 mb-2">
                     <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                       <Bell className="h-3 w-3 text-white" />
                     </div>
                     <span className="text-xs text-gray-500">WeDealz</span>
                     <span className="text-xs text-gray-400 ml-auto">сейчас</span>
                   </div>
                   <h4 className="font-semibold text-gray-900 text-sm mb-1 break-words">
                     {testMode ? testTitle : massTitle}
                   </h4>
                   <p className="text-gray-700 text-sm break-words">
                     {testMode ? testMessage : massMessage}
                   </p>
                 </div>

                 <div className="mt-4 text-center text-sm text-gray-600 px-2">
                   {testMode ? (
                     <div>
                       <p>Будет отправлено <strong>{selectedUsers.length}</strong> получателям</p>
                       <p className="text-xs mt-1">
                         📱 На <strong>
                           {users.filter(u => selectedUsers.includes(u.id))
                             .reduce((total, user) => total + (user.deviceCount || 1), 0)}
                         </strong> устройств
                       </p>
                       {selectedUsers.length === 1 && selectedUsers[0] === user?.id && (
                         <p className="text-blue-600 font-medium mt-1">Отправка только вам для тестирования</p>
                       )}
                     </div>
                   ) : (
                     <div>
                       <p>Будет отправлено <strong>{getFilteredUsers().length}</strong> пользователям</p>
                       <p className="text-xs mt-1">
                         📱 На <strong>
                           {getFilteredUsers().reduce((total, user) => total + (user.deviceCount || 1), 0)}
                         </strong> устройств
                       </p>
                       {selectedLanguage !== 'all' && (
                         <p className="text-blue-600 font-medium mt-1">
                           Только пользователи с языком: {selectedLanguage}
                         </p>
                       )}
                     </div>
                   )}
                 </div>
               </div>

                             <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0">
                 <button
                   onClick={() => setCurrentStep('compose')}
                   className="flex items-center justify-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 order-2 sm:order-1"
                 >
                   <ArrowLeft className="h-4 w-4" />
                   Редактировать
                 </button>
                 <button
                   onClick={sendNotification}
                   disabled={isLoading}
                   className={`flex items-center justify-center gap-2 px-6 sm:px-8 py-3 rounded-md font-medium order-1 sm:order-2 ${
                     testMode 
                       ? 'bg-blue-500 hover:bg-blue-600 text-white'
                       : 'bg-red-500 hover:bg-red-600 text-white'
                   } disabled:opacity-50 disabled:cursor-not-allowed`}
                 >
                   {isLoading ? (
                     <Loader className="h-4 w-4 animate-spin" />
                   ) : testMode ? (
                     <TestTube className="h-4 w-4" />
                   ) : (
                     <Zap className="h-4 w-4" />
                   )}
                   <span className="text-sm sm:text-base">
                     {isLoading 
                       ? 'Отправляю...' 
                       : testMode 
                         ? 'Отправить тест'
                         : 'ОТПРАВИТЬ ВСЕМ'
                     }
                   </span>
                 </button>
               </div>
            </div>
          )}
                 </div>
       </div>
       </div>
     </div>
   );
 };
 
 export default PushNotificationAdminPage; 