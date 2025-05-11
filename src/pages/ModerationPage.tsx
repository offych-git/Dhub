
import React, { useEffect, useState } from 'react';
import { useModeration } from '../contexts/ModerationContext';
import { useAdmin } from '../hooks/useAdmin';
import { CheckCircle, XCircle, MessageSquare, Loader, AlertCircle, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ModerationPage: React.FC = () => {
  const { 
    moderationQueue, 
    isLoading, 
    queueCount,
    loadModerationQueue, 
    approveModerationItem, 
    rejectModerationItem 
  } = useModeration();
  const { role } = useAdmin();
  const [selectedType, setSelectedType] = useState<string>('all');
  const [rejectionComment, setRejectionComment] = useState<string>('');
  const [showCommentInput, setShowCommentInput] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const navigate = useNavigate();

  useEffect(() => {
    loadModerationQueue();
  }, []);

  // Check if user has access to this page
  if (role !== 'admin' && role !== 'moderator' && role !== 'super_admin') {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Доступ запрещен</h1>
        <p className="mb-4">У вас нет прав для доступа к этой странице.</p>
        <button 
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-orange-500 text-white rounded-md"
        >
          Вернуться на главную
        </button>
      </div>
    );
  }

  const filteredQueue = moderationQueue.filter(item => {
    if (selectedType !== 'all' && item.item_type !== selectedType) {
      return false;
    }
    return true;
  });

  const handleApprove = async (itemId: string, itemType: string) => {
    const success = await approveModerationItem(itemId, itemType);
    if (success) {
      alert('Элемент успешно одобрен и опубликован!');
    } else {
      alert('Произошла ошибка при одобрении элемента');
    }
  };

  const handleReject = async (itemId: string, itemType: string) => {
    if (showCommentInput === itemId) {
      const success = await rejectModerationItem(itemId, itemType, rejectionComment);
      if (success) {
        alert('Элемент отклонен');
        setShowCommentInput(null);
        setRejectionComment('');
      } else {
        alert('Произошла ошибка при отклонении элемента');
      }
    } else {
      setShowCommentInput(itemId);
    }
  };

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'deal': return 'Скидка';
      case 'promo': return 'Промокод';
      case 'sweepstake': return 'Розыгрыш';
      default: return type;
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Модерация контента</h1>
        
        {(role === 'admin' || role === 'super_admin') && (
          <button
            onClick={() => navigate('/moderation/settings')}
            className="p-2 bg-gray-200 text-gray-800 rounded-md flex items-center"
            aria-label="Настройки"
          >
            <Settings className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="bg-white rounded-md shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 mb-4">
          <button
            onClick={() => setSelectedType('deal')}
            className={`px-3 py-1 rounded-md ${selectedType === 'deal' ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}
          >
            Скидки
          </button>
          <button
            onClick={() => setSelectedType('promo')}
            className={`px-3 py-1 rounded-md ${selectedType === 'promo' ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}
          >
            Промокоды
          </button>
          <button
            onClick={() => setSelectedType('sweepstake')}
            className={`px-3 py-1 rounded-md ${selectedType === 'sweepstake' ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}
          >
            Розыгрыши
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader className="h-8 w-8 text-orange-500 animate-spin" />
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="bg-white rounded-md shadow p-8 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h2 className="text-xl font-medium mb-2">Очередь модерации пуста</h2>
          <p className="text-gray-600">
            В данный момент нет элементов, ожидающих проверки модератором.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQueue.map((item) => (
            <div key={item.id} className="bg-white rounded-md shadow overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 border-b">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{getItemTypeLabel(item.item_type)}</span>
                  <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                    Ожидает проверки
                  </span>
                </div>
              </div>

              <div className="p-4">
                {item.content ? (
                  <>
                    <h3 className="font-bold text-lg mb-2">{item.content.title}</h3>
                    
                    {item.content.image_url && (
                      <div className="mb-3">
                        <img 
                          src={item.content.image_url} 
                          alt={item.content.title}
                          className="w-full h-40 object-cover rounded-md"
                        />
                      </div>
                    )}
                    
                    <p className="text-gray-700 mb-3 text-sm line-clamp-3">
                      {item.content.description}
                    </p>

                    {item.item_type === 'deal' && (
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="font-bold text-xl text-orange-600">
                          {item.content.current_price}₽
                        </span>
                        {item.content.original_price && (
                          <span className="text-gray-500 line-through">
                            {item.content.original_price}₽
                          </span>
                        )}
                      </div>
                    )}

                    {item.item_type === 'promo' && item.content.code && (
                      <div className="mb-3 bg-gray-100 p-2 rounded text-center font-mono">
                        {item.content.code}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500 italic">
                    Невозможно загрузить содержимое элемента
                  </p>
                )}

                <div className="text-xs text-gray-500 mb-3">
                  Добавлено: {new Date(item.submitted_at).toLocaleString()}
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-shrink-0">
                    <img 
                      src={item.submitted_by_profile?.avatar_url || '/default-avatar.png'} 
                      alt=""
                      className="w-6 h-6 rounded-full"
                    />
                  </div>
                  <span className="text-sm">
                    {item.submitted_by_profile?.username || 'Пользователь'}
                  </span>
                </div>

                {showCommentInput === item.item_id ? (
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
                      Комментарий к отклонению:
                    </label>
                    <textarea
                      className="w-full border rounded-md p-2 text-sm"
                      rows={2}
                      value={rejectionComment}
                      onChange={(e) => setRejectionComment(e.target.value)}
                      placeholder="Укажите причину отклонения..."
                    />
                  </div>
                ) : null}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleApprove(item.item_id, item.item_type)}
                    className="flex-1 bg-green-500 text-white py-2 rounded-md flex items-center justify-center gap-1"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Одобрить
                  </button>
                  <button
                    onClick={() => handleReject(item.item_id, item.item_type)}
                    className={`flex-1 ${showCommentInput === item.item_id ? 'bg-red-700' : 'bg-red-500'} text-white py-2 rounded-md flex items-center justify-center gap-1`}
                  >
                    {showCommentInput === item.item_id ? (
                      <>
                        <XCircle className="h-4 w-4" />
                        Подтвердить
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        Отклонить
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModerationPage;
