import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Smartphone, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  Calendar,
  Users,
  Code,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock
} from 'lucide-react';

interface MobileAnnouncement {
  id: string;
  title: string;
  html_content: string;
  is_active: boolean;
  show_after_login: boolean;
  show_frequency: string;
  target_users: string[];
  priority: number;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
  created_by: string;
  trigger_actions?: string[];
  test_mode?: boolean;
  test_emails?: string[];
  user_segments?: string[];
}

// Новое: интерфейс для состояния формы
interface AnnouncementFormData {
  title: string;
  html_content: string;
  is_active: boolean;
  show_after_login: boolean;
  show_frequency: string;
  target_users: string[];
  priority: number;
  starts_at: string;
  expires_at: string;
  trigger_actions: string[];
  test_mode: boolean;
  test_emails: string[];
  user_segments: string[];
}

const MobileAnnouncementsAdminPage: React.FC = () => {
  const { role, isAdmin, loading } = useAdmin();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // States
  const [announcements, setAnnouncements] = useState<MobileAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<MobileAnnouncement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState<AnnouncementFormData>({
    title: '',
    html_content: '',
    is_active: false,
    show_after_login: true,
    show_frequency: 'once',
    target_users: ['all'],
    priority: 0,
    starts_at: '',
    expires_at: '',
    trigger_actions: [],
    test_mode: false,
    test_emails: [],
    user_segments: []
  });
  const [actionInput, setActionInput] = useState('');
  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    if (loading) return;
    
    if (!isAdmin) {
      navigate('/');
      return;
    }
    
    fetchAnnouncements();
  }, [isAdmin, loading, navigate]);

  const fetchAnnouncements = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('app_announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err: any) {
      setError('Ошибка загрузки анонсов: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAnnouncement = async () => {
    try {
      const { error } = await supabase
        .from('app_announcements')
        .insert([{
          ...formData,
          created_by: user?.id,
          starts_at: formData.starts_at || null,
          expires_at: formData.expires_at || null,
          trigger_actions: formData.trigger_actions,
          test_mode: formData.test_mode,
          test_emails: formData.test_emails,
          user_segments: formData.user_segments
        }]);

      if (error) throw error;
      
      setSuccess('Анонс успешно создан!');
      setShowCreateForm(false);
      resetForm();
      fetchAnnouncements();
    } catch (err: any) {
      setError('Ошибка создания анонса: ' + err.message);
    }
  };

  const handleUpdateAnnouncement = async () => {
    if (!editingAnnouncement) return;

    try {
      const { error } = await supabase
        .from('app_announcements')
        .update({
          ...formData,
          starts_at: formData.starts_at || null,
          expires_at: formData.expires_at || null,
          trigger_actions: formData.trigger_actions,
          test_mode: formData.test_mode,
          test_emails: formData.test_emails,
          user_segments: formData.user_segments
        })
        .eq('id', editingAnnouncement.id);

      if (error) throw error;
      
      setSuccess('Анонс успешно обновлён!');
      setEditingAnnouncement(null);
      resetForm();
      fetchAnnouncements();
    } catch (err: any) {
      setError('Ошибка обновления анонса: ' + err.message);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот анонс?')) return;

    try {
      const { error } = await supabase
        .from('app_announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setSuccess('Анонс успешно удалён!');
      fetchAnnouncements();
    } catch (err: any) {
      setError('Ошибка удаления анонса: ' + err.message);
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('app_announcements')
        .update({ is_active: !currentState })
        .eq('id', id);

      if (error) throw error;
      
      setSuccess(`Анонс ${!currentState ? 'активирован' : 'деактивирован'}!`);
      fetchAnnouncements();
    } catch (err: any) {
      setError('Ошибка изменения статуса: ' + err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      html_content: '',
      is_active: false,
      show_after_login: true,
      show_frequency: 'once',
      target_users: ['all'],
      priority: 0,
      starts_at: '',
      expires_at: '',
      trigger_actions: [],
      test_mode: false,
      test_emails: [],
      user_segments: []
    });
  };

  const startEdit = (announcement: MobileAnnouncement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      html_content: announcement.html_content,
      is_active: announcement.is_active,
      show_after_login: announcement.show_after_login,
      show_frequency: announcement.show_frequency,
      target_users: announcement.target_users,
      priority: announcement.priority,
      starts_at: announcement.starts_at ? announcement.starts_at.split('T')[0] : '',
      expires_at: announcement.expires_at ? announcement.expires_at.split('T')[0] : '',
      trigger_actions: announcement.trigger_actions || [],
      test_mode: announcement.test_mode || false,
      test_emails: announcement.test_emails || [],
      user_segments: announcement.user_segments || []
    });
    setShowCreateForm(true);
  };

  const cancelEdit = () => {
    setEditingAnnouncement(null);
    setShowCreateForm(false);
    resetForm();
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Mobile-Optimized Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div className="flex items-center space-x-3">
              <Smartphone className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Мобильные анонсы</h1>
                <p className="text-sm text-gray-600">Управление объявлениями в приложении</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2 w-full sm:w-auto touch-manipulation"
            >
              <Plus className="h-5 w-5" />
              <span className="font-medium">Создать анонс</span>
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 sm:mb-6 flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span className="text-green-700 text-sm">{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto">
              <X className="h-4 w-4 text-green-500" />
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 sm:mb-6 flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4 text-red-500" />
            </button>
          </div>
        )}

        {/* Mobile-Optimized Create/Edit Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                {editingAnnouncement ? 'Редактировать анонс' : 'Создать новый анонс'}
              </h2>
              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4 sm:space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Заголовок
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base"
                  placeholder="Введите заголовок анонса"
                />
              </div>

              {/* Settings Grid - Mobile Responsive */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Частота показа
                  </label>
                  <select
                    value={formData.show_frequency}
                    onChange={(e) => setFormData({...formData, show_frequency: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base"
                  >
                    <option value="once">Один раз</option>
                    <option value="daily">Каждый день</option>
                    <option value="session">Каждую сессию</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Приоритет
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base"
                    min="0"
                  />
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Начало показа
                  </label>
                  <input
                    type="date"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({...formData, starts_at: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Окончание показа
                  </label>
                  <input
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({...formData, expires_at: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base"
                  />
                </div>
              </div>

              {/* Checkboxes - Mobile Friendly */}
              <div className="space-y-3">
                <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    className="h-5 w-5 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <div className="flex items-center space-x-2">
                    <Eye className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-gray-700">Активен</span>
                  </div>
                </label>
                <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={formData.show_after_login}
                    onChange={(e) => setFormData({...formData, show_after_login: e.target.checked})}
                    className="h-5 w-5 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-700">Показывать после входа</span>
                  </div>
                </label>
              </div>

              {/* HTML Editor - Mobile Optimized */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Code className="inline h-4 w-4 mr-1" />
                  HTML код баннера
                </label>
                <textarea
                  value={formData.html_content}
                  onChange={(e) => setFormData({...formData, html_content: e.target.value})}
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono text-sm resize-y"
                  placeholder="Введите HTML код для баннера..."
                />
                <p className="text-xs text-gray-500 mt-2">
                  💡 Используйте HTML и CSS для создания красивого баннера
                </p>
              </div>

              {/* Триггеры показа */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Триггеры показа</h3>
                {/* Actions */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">События/действия пользователя</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.trigger_actions.map((action, idx) => (
                      <span key={idx} className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                        {action}
                        <button type="button" className="ml-1 text-blue-500 hover:text-blue-700" onClick={() => setFormData({...formData, trigger_actions: formData.trigger_actions.filter((_, i) => i !== idx)})}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex">
                    <input
                      type="text"
                      value={actionInput}
                      onChange={e => setActionInput(e.target.value)}
                      onKeyDown={e => {
                        if ((e.key === 'Enter' || e.key === ',') && actionInput.trim()) {
                          e.preventDefault();
                          if (!formData.trigger_actions.includes(actionInput.trim())) {
                            setFormData({...formData, trigger_actions: [...formData.trigger_actions, actionInput.trim()]});
                          }
                          setActionInput('');
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg text-sm focus:ring-1 focus:ring-orange-500"
                      placeholder="Добавить действие (например, open_deal, click_banner)"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (actionInput.trim() && !formData.trigger_actions.includes(actionInput.trim())) {
                          setFormData({...formData, trigger_actions: [...formData.trigger_actions, actionInput.trim()]});
                        }
                        setActionInput('');
                      }}
                      className="px-3 py-2 bg-orange-500 text-white rounded-r-lg text-sm hover:bg-orange-600"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Баннер будет показан только после указанных действий пользователя</p>
                </div>
                {/* Test mode */}
                <div className="mb-3 flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.test_mode}
                    onChange={e => setFormData({...formData, test_mode: e.target.checked})}
                    className="h-4 w-4 text-orange-600 border-gray-300 rounded mr-2"
                  />
                  <span className="text-xs text-gray-700">Тестовый режим (видно только тестировщикам из списка ниже)</span>
                </div>
                {/* Test emails */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email тестировщиков</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.test_emails.map((email, idx) => (
                      <span key={idx} className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                        {email}
                        <button type="button" className="ml-1 text-purple-500 hover:text-purple-700" onClick={() => setFormData({...formData, test_emails: formData.test_emails.filter((_, i) => i !== idx)})}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      onKeyDown={e => {
                        if ((e.key === 'Enter' || e.key === ',') && emailInput.trim()) {
                          e.preventDefault();
                          if (!formData.test_emails.includes(emailInput.trim())) {
                            setFormData({...formData, test_emails: [...formData.test_emails, emailInput.trim()]});
                          }
                          setEmailInput('');
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg text-sm focus:ring-1 focus:ring-orange-500"
                      placeholder="Добавить email тестировщика"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (emailInput.trim() && !formData.test_emails.includes(emailInput.trim())) {
                          setFormData({...formData, test_emails: [...formData.test_emails, emailInput.trim()]});
                        }
                        setEmailInput('');
                      }}
                      className="px-3 py-2 bg-orange-500 text-white rounded-r-lg text-sm hover:bg-orange-600"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Укажите email-адреса тестировщиков через Enter или запятую</p>
                </div>
                {/* User segments */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Сегменты пользователей</label>
                  <select
                    multiple
                    value={formData.user_segments}
                    onChange={e => {
                      const options = Array.from(e.target.selectedOptions).map(o => o.value);
                      setFormData({...formData, user_segments: options});
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-orange-500"
                  >
                    <option value="all">Все пользователи</option>
                    <option value="new">Новые пользователи</option>
                    <option value="active">Активные пользователи</option>
                    <option value="admin">Администраторы</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Выберите один или несколько сегментов</p>
                  <ul className="text-xs text-gray-400 mt-1 list-disc pl-4">
                    <li><b>Новые</b> — недавно зарегистрированные пользователи (например, &lt; 7 дней).</li>
                    <li><b>Активные</b> — пользователи, регулярно использующие приложение.</li>
                    <li><b>Администраторы</b> — сотрудники или владельцы, имеющие доступ к админке.</li>
                  </ul>
                </div>
              </div>

              {/* Action Buttons - Mobile Optimized */}
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
                <button
                  onClick={cancelEdit}
                  className="w-full sm:w-auto px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium touch-manipulation"
                >
                  Отмена
                </button>
                <button
                  onClick={editingAnnouncement ? handleUpdateAnnouncement : handleCreateAnnouncement}
                  className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg flex items-center justify-center space-x-2 font-medium touch-manipulation"
                >
                  <Save className="h-5 w-5" />
                  <span>{editingAnnouncement ? 'Обновить' : 'Создать'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile-Optimized Announcements List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Список анонсов ({announcements.length})</h2>
          </div>

          {announcements.length === 0 ? (
            <div className="p-8 text-center">
              <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Анонсов пока нет</p>
              <p className="text-sm text-gray-400 mt-1">Создайте первый анонс для мобильного приложения</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="p-4 sm:p-6">
                  {/* Card Header - Always Visible */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-base font-medium text-gray-900 truncate">
                          {announcement.title}
                        </h3>
                        <button
                          onClick={() => handleToggleActive(announcement.id, announcement.is_active)}
                          className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium touch-manipulation ${
                            announcement.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {announcement.is_active ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                          <span>{announcement.is_active ? 'Активен' : 'Неактивен'}</span>
                        </button>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(announcement.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>{announcement.show_frequency}</span>
                        </div>
                      </div>

                      {/* Quick Info */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Приоритет: {announcement.priority}
                        </span>
                        {announcement.show_after_login && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            После входа
                          </span>
                        )}
                        {announcement.expires_at && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            До: {new Date(announcement.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {/* Триггеры показа */}
                      <div className="mt-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Триггеры показа:</h4>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {announcement.trigger_actions && announcement.trigger_actions.length > 0 && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Действия: {announcement.trigger_actions.join(', ')}</span>
                          )}
                          {announcement.test_mode && (
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full">Тестовый режим</span>
                          )}
                          {announcement.test_emails && announcement.test_emails.length > 0 && (
                            <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-full">Email: {announcement.test_emails.join(', ')}</span>
                          )}
                          {announcement.user_segments && announcement.user_segments.length > 0 && (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">Сегменты: {announcement.user_segments.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => setExpandedCard(expandedCard === announcement.id ? null : announcement.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 touch-manipulation"
                      >
                        {expandedCard === announcement.id ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => startEdit(announcement)}
                        className="p-2 text-orange-600 hover:text-orange-900 touch-manipulation"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        className="p-2 text-red-600 hover:text-red-900 touch-manipulation"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Content */}
                  {expandedCard === announcement.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">HTML код:</h4>
                          <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                              {announcement.html_content}
                            </pre>
                          </div>
                        </div>
                        
                        {(announcement.starts_at || announcement.expires_at) && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Период показа:</h4>
                            <div className="text-sm text-gray-600">
                              {announcement.starts_at && (
                                <div>С: {new Date(announcement.starts_at).toLocaleDateString()}</div>
                              )}
                              {announcement.expires_at && (
                                <div>До: {new Date(announcement.expires_at).toLocaleDateString()}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileAnnouncementsAdminPage;
