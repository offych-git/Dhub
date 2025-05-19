import React, {useEffect, useMemo, useState} from 'react';
import {useLocation, useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {ArrowLeft, Edit2, ExternalLink, Heart, Share2} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import AdminActions from '../components/admin/AdminActions';
import {supabase} from '../lib/supabase';
import Comment from '../components/comments/Comment';
import CommentInput from '../components/comments/CommentInput';
import {getValidImageUrl, handleImageError} from '../utils/imageUtils';
import {highlightText} from '../utils/highlightText';
import VoteControls from '../components/deals/VoteControls';

const SweepstakesDetailPage: React.FC = () => {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const searchQuery = searchParams.get('q') || '';
    const {user} = useAuth();
    const [newComment, setNewComment] = useState('');
    const [comments, setComments] = useState<any[]>([]);
    const [commentCount, setCommentCount] = useState(0);
    const [isFavorite, setIsFavorite] = useState(false);
    const [sweepstakes, setSweepstakes] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular'>('newest');
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const isExpired = sweepstakes?.expires_at && new Date(sweepstakes.expires_at) < new Date();

    // Получение списка изображений для карусели
    const sweepstakesImages = useMemo(() => {
        if (!sweepstakes) return [];

        // Основное изображение всегда первое
        const images = [sweepstakes.image];

        // Проверяем, есть ли в описании JSON с дополнительными изображениями
        if (sweepstakes.description) {
            const match = sweepstakes.description.match(/<!-- DEAL_IMAGES: (.*?) -->/);
            if (match && match[1]) {
                try {
                    // Пытаемся распарсить JSON с изображениями
                    const allImages = JSON.parse(match[1]);

                    // Если первое изображение в JSON совпадает с основным, не дублируем его
                    if (allImages[0] === sweepstakes.image) {
                        images.push(...allImages.slice(1));
                    } else {
                        // Если не совпадает (это может быть из-за старых данных), добавляем все кроме первого
                        images.push(...allImages.slice(1));
                    }
                } catch (e) {
                    console.error('Ошибка при разборе JSON с изображениями:', e);
                }
            }
        }

        return images;
    }, [sweepstakes]);

    // Функции для навигации по карусели с циклическим переходом
    const goToPreviousImage = () => {
        setCurrentImageIndex((prev) =>
            prev === 0 ? sweepstakesImages.length - 1 : prev - 1
        );
    };

    const goToNextImage = () => {
        setCurrentImageIndex((prev) =>
            prev === sweepstakesImages.length - 1 ? 0 : prev + 1
        );
    };

    // Обработчики свайпов с улучшенной реактивностью
    const handleTouchStart = (e: React.TouchEvent) => {
        // Сохраняем начальную позицию касания
        setTouchStart(e.targetTouches[0].clientX);
        setTouchEnd(null); // Сбрасываем конечную позицию при новом касании
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        // Обновляем позицию при движении пальца
        setTouchEnd(e.targetTouches[0].clientX);

        // Предотвращаем скролл страницы при горизонтальном свайпе
        if (Math.abs((touchStart || 0) - e.targetTouches[0].clientX) > 10) {
            e.preventDefault();
        }
    };

    const handleTouchEnd = () => {
        if (touchStart === null) return;

        // Если touchEnd не был установлен (пользователь просто тапнул), выходим
        if (touchEnd === null) {
            setTouchStart(null);
            return;
        }

        const distance = touchStart - touchEnd;
        const minSwipeDistance = 50; // Минимальное расстояние свайпа для срабатывания

        if (distance > minSwipeDistance) {
            // Свайп влево - следующее изображение
            goToNextImage();
        } else if (distance < -minSwipeDistance) {
            // Свайп вправо - предыдущее изображение
            goToPreviousImage();
        }

        // Сбрасываем состояния касания
        setTouchStart(null);
        setTouchEnd(null);
    };

    useEffect(() => {
        // Прокручиваем страницу вверх при открытии деталей розыгрыша
        window.scrollTo(0, 0);

        if (id) {
            loadSweepstakes();
            loadComments();
            loadFavoriteStatus();
        }
    }, [id, sortBy]);

    const loadSweepstakes = async () => {
        try {
            const {data, error} = await supabase
                .from('deals')
                .select(`
          *,
          profiles!deals_user_id_fkey(id, email, display_name)
        `)
                .eq('id', id)
                .eq('type', 'sweepstakes')
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                setError('Sweepstakes not found');
                return;
            }

            // Add null checks and default values for profile data
            const profileDisplayName = data.profiles?.display_name || (
                data.profiles?.email ? data.profiles.email.split('@')[0] : 'Anonymous'
            );

            // Log для отладки структуры данных
            console.log('Загружены данные розыгрыша:', data);

            setSweepstakes({
                id: data.id,
                title: data.title,
                image: data.image_url,
                description: data.description,
                url: data.deal_url,
                postedAt: new Date(data.created_at).toLocaleDateString(),
                createdAtISO: data.created_at, // Сохраняем оригинальную дату в ISO формате
                expiresAt: data.expires_at ? new Date(data.expires_at).toLocaleDateString() : null,
                postedBy: {
                    id: data.profiles?.id || 'anonymous',
                    name: profileDisplayName,
                    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(profileDisplayName)}&background=random`
                }
            });
        } catch (err: any) {
            console.error('Error loading sweepstakes:', err);
            setError(err.message || 'Failed to load sweepstakes details');
        } finally {
            setLoading(false);
        }
    };

    const loadComments = async () => {
        if (!id) return;

        const {data: comments, error} = await supabase
            .from('deal_comments')
            .select(`
        *,
        profiles:user_id(id, email, display_name)
      `)
            .eq('deal_id', id);

        if (error) {
            console.error('Error loading comments:', error);
            return;
        }

        if (!comments) {
            return;
        }

        // Sort comments before building the tree
        const sortedComments = [...comments].sort((a, b) => {
            switch (sortBy) {
                case 'oldest':
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'popular':
                    return (b.like_count || 0) - (a.like_count || 0);
                case 'newest':
                default:
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
        });

        if (!error && comments) {
            // Build comment tree
            const commentMap = new Map();
            const rootComments = [];

            // First pass: create map of all comments
            comments.forEach(comment => {
                commentMap.set(comment.id, {
                    ...comment,
                    replies: []
                });
            });

            // Second pass: build tree structure
            sortedComments.forEach(comment => {
                const commentWithReplies = commentMap.get(comment.id);
                if (comment.parent_id) {
                    const parent = commentMap.get(comment.parent_id);
                    if (parent) {
                        parent.replies.push(commentWithReplies);
                    }
                } else {
                    rootComments.push(commentWithReplies);
                }
            });

            // Sort replies recursively
            const sortReplies = (comments) => {
                comments.forEach(comment => {
                    if (comment.replies && comment.replies.length > 0) {
                        comment.replies.sort((a, b) => {
                            switch (sortBy) {
                                case 'oldest':
                                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                                case 'popular':
                                    return (b.like_count || 0) - (a.like_count || 0);
                                case 'newest':
                                default:
                                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                            }
                        });
                        sortReplies(comment.replies);
                    }
                });
            };

            sortReplies(rootComments);
            setComments(rootComments);
            setCommentCount(comments.length);
        }
    };

    const loadFavoriteStatus = async () => {
        if (!user || !id) return;

        const {data: favorite} = await supabase
            .from('deal_favorites')
            .select('id')
            .eq('deal_id', id)
            .eq('user_id', user.id)
            .maybeSingle();

        setIsFavorite(!!favorite);
    };

    const toggleFavorite = async () => {
        if (!user) {
            navigate('/auth');
            return;
        }

        if (isFavorite) {
            await supabase
                .from('deal_favorites')
                .delete()
                .eq('deal_id', id)
                .eq('user_id', user.id);
        } else {
            await supabase
                .from('deal_favorites')
                .insert({
                    deal_id: id,
                    user_id: user.id
                });
        }

        setIsFavorite(!isFavorite);
    };

    // Define a type for comment tree nodes
    type CommentTreeNode = {
        id: string;
        content: string;
        created_at: string;
        profiles?: {
            id?: string;
            display_name?: string;
            email?: string;
        };
        reply_count?: number;
        like_count?: number;
        images?: string[]; // Added images property
        replies?: CommentTreeNode[];
    };

    const renderCommentTree = (comment: CommentTreeNode, depth = 0) => (
        <div key={comment.id} style={{marginLeft: depth * 24}}>
            <Comment
                id={comment.id}
                content={comment.content}
                createdAt={comment.created_at}
                images={comment.images || []}
                user={{
                    id: comment.profiles?.id,
                    name: comment.profiles?.display_name || comment.profiles?.email?.split('@')[0] || 'Anonymous',
                    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.profiles?.display_name || comment.profiles?.email || 'Anonymous')}&background=random`
                }}
                replyCount={typeof comment.reply_count === 'number' ? comment.reply_count : 0}
                likeCount={typeof comment.like_count === 'number' ? comment.like_count : 0}
                replies={undefined}
                sourceType="deal_comment"
                sourceId={sweepstakes && sweepstakes.id ? String(sweepstakes.id) : ''}
                onReply={loadComments}
                depth={depth || 0}
            />
            {comment.replies && comment.replies.length > 0 && (
                <div>
                    {comment.replies.map((reply: CommentTreeNode) => renderCommentTree(reply, (depth || 0) + 1))}
                </div>
            )}
        </div>
    );

    useEffect(() => {
        const highlightedCommentId = location.hash ? location.hash.substring(1) : null;

        if (highlightedCommentId) {
            const timer = setTimeout(() => {
        const commentElement = document.getElementById(`comment-${highlightedCommentId}`);
        if (commentElement) {
          // Прокручиваем к комментарию
          commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Добавляем эффект подсветки с плавным переходом
          commentElement.classList.add('bg-orange-500/20');
          setTimeout(() => {
            commentElement.classList.remove('bg-orange-500/20');
            commentElement.classList.add('bg-orange-500/10');
            setTimeout(() => {
              commentElement.classList.remove('bg-orange-500/10');
            }, 1000);
          }, 1000);
        }
      }, 800);

            return () => clearTimeout(timer);
        }
    }, [location.hash]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900">
                <div
                    className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !sweepstakes) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
                <h2 className="text-white text-xl mb-4">{error || 'Sweepstakes not found'}</h2>
                <button
                    onClick={() => navigate('/')}
                    className="bg-orange-500 text-white py-2 px-4 rounded-md flex items-center"
                >
                    <ArrowLeft className="h-4 w-4 mr-2"/>
                    Back to Deals
                </button>
            </div>
        );
    }

    return (
        <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
            <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <button onClick={() => navigate('/sweepstakes')} className="text-white">
                            <ArrowLeft className="h-6 w-6"/>
                        </button>
                        <h1 className="text-white font-medium ml-4 truncate">Sweepstakes Details</h1>
                    </div>
                    <AdminActions
                        type="sweepstakes"
                        id={sweepstakes.id}
                        userId={sweepstakes.postedBy.id}
                        createdAt={sweepstakes.createdAtISO}
                        onAction={() => navigate('/')}
                    />
                </div>
            </div>

            <div
                className="h-64 bg-gray-800 relative overflow-hidden touch-pan-y"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <img
                    src={getValidImageUrl(sweepstakesImages[currentImageIndex] || sweepstakes.image)}
                    alt={sweepstakes.title}
                    className="w-full h-full object-contain cursor-pointer"
                    onError={handleImageError}
                    draggable="false"
                    onClick={(e) => {
                        // Находим текущий элемент img
                        const img = e.target as HTMLImageElement;

                        // Проверяем, есть ли уже модальное окно для этого изображения
                        const existingModal = document.querySelector('.fullscreen-image-modal');
                        if (existingModal) {
                            // Если модальное окно уже открыто, закрываем его
                            document.body.removeChild(existingModal);
                            return;
                        }

                        // Создаем модальное окно для просмотра изображения в полном размере
                        const modal = document.createElement('div');
                        modal.className = 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 fullscreen-image-modal';

                        // Переменная для отслеживания текущего индекса изображения в полноэкранном режиме
                        let currentFullscreenIndex = currentImageIndex;

                        // При клике на фон закрываем модальное окно
                        modal.addEventListener('click', (e) => {
                            if (e.target === modal) {
                                document.body.removeChild(modal);
                            }
                        });

                        // Определяем переменные заранее, чтобы избежать ошибок в ссылках
                        let prevButton, nextButton, counterElement;

                        // Функция для навигации по изображениям с циклическим переходом
                        const goToPrevImage = () => {
                            // Циклическая навигация: если мы на первом изображении, переходим к последнему
                            const newIndex = currentFullscreenIndex > 0
                                ? currentFullscreenIndex - 1
                                : sweepstakesImages.length - 1;
                            updateFullscreenImage(newIndex);
                        };

                        const goToNextImage = () => {
                            // Циклическая навигация: если мы на последнем изображении, переходим к первому
                            const newIndex = currentFullscreenIndex < sweepstakesImages.length - 1
                                ? currentFullscreenIndex + 1
                                : 0;
                            updateFullscreenImage(newIndex);
                        };

                        // Функция для обновления отображаемого изображения в полноэкранном режиме
                        const updateFullscreenImage = (index) => {
                            // Обновляем индекс
                            currentFullscreenIndex = index;

                            // Обновляем источник изображения
                            fullImg.src = getValidImageUrl(sweepstakesImages[index]);

                            // Обновляем активную точку навигации
                            const dots = navContainer.querySelectorAll('button.nav-dot');
                            dots.forEach((d, i) => {
                                d.className = `nav-dot h-2 w-2 rounded-full ${
                                    i === index ? 'bg-orange-500' : 'bg-gray-400'
                                }`;
                            });

                            // Обновляем счетчик изображений
                            if (counterElement) {
                                counterElement.textContent = `${index + 1} / ${sweepstakesImages.length}`;
                            }
                        };

                        const content = document.createElement('div');
                        content.className = 'relative max-w-4xl max-h-[90vh]';

                        // Добавляем кнопку закрытия (крестик) с улучшенной видимостью
                        const closeBtn = document.createElement('button');
                        closeBtn.className = 'absolute top-4 right-4 bg-orange-500 hover:bg-orange-600 text-white text-2xl font-bold rounded-full w-12 h-12 flex items-center justify-center shadow-xl z-10 border-2 border-white';
                        closeBtn.innerHTML = '×';
                        closeBtn.onclick = (e) => {
                            e.stopPropagation();
                            document.body.removeChild(modal);
                        };

                        const fullImg = document.createElement('img');
                        fullImg.src = getValidImageUrl(sweepstakesImages[currentImageIndex] || sweepstakes.image);
                        fullImg.className = 'max-w-full max-h-[90vh] object-contain';
                        fullImg.onError = handleImageError;
                        fullImg.draggable = false; // Отключаем стандартное перетаскивание

                        // Добавляем обработчики событий касания для свайпов
                        let touchStartX = 0;
                        let touchEndX = 0;

                        // Функция обработки начала касания
                        const handleTouchStartModal = (e) => {
                            touchStartX = e.changedTouches[0].screenX;
                        };

                        // Функция обработки движения касания
                        const handleTouchMoveModal = (e) => {
                            // Предотвращаем стандартное поведение браузера при горизонтальном свайпе
                            const currentX = e.changedTouches[0].screenX;
                            const diff = Math.abs(touchStartX - currentX);

                            if (diff > 10) {
                                e.preventDefault();
                            }
                        };

                        // Функция обработки окончания касания
                        const handleTouchEndModal = (e) => {
                            touchEndX = e.changedTouches[0].screenX;

                            // Определяем направление свайпа
                            const diff = touchStartX - touchEndX;
                            const threshold = 50; // Минимальное расстояние для засчитывания свайпа

                            if (Math.abs(diff) > threshold) {
                                if (diff > 0) {
                                    // Свайп влево - следующее изображение
                                    goToNextImage();
                                } else {
                                    // Свайп вправо - предыдущее изображение
                                    goToPrevImage();
                                }
                            }
                        };

                        // Назначаем обработчики событий касания для полноэкранного изображения
                        fullImg.addEventListener('touchstart', handleTouchStartModal, {passive: false});
                        fullImg.addEventListener('touchmove', handleTouchMoveModal, {passive: false});
                        fullImg.addEventListener('touchend', handleTouchEndModal);

                        content.appendChild(closeBtn);

                        // Создаем контейнер для навигационных точек
                        const navContainer = document.createElement('div');
                        navContainer.className = 'absolute bottom-4 left-0 right-0 flex justify-center space-x-2';

                        // Создаем счетчик изображений (только если есть больше одного изображения)
                        if (sweepstakesImages.length > 1) {
                            counterElement = document.createElement('div');
                            counterElement.className = 'absolute top-4 left-4 bg-orange-500 text-white px-2 py-1 rounded-md text-sm font-semibold shadow-lg border border-white/60';
                            counterElement.textContent = `${currentFullscreenIndex + 1} / ${sweepstakesImages.length}`;
                            content.appendChild(counterElement);
                        }

                        // Добавляем кнопки навигации при наличии нескольких изображений
                        if (sweepstakesImages.length > 1) {
                            // Кнопка "Предыдущее изображение"
                            const prevButton = document.createElement('button');
                            prevButton.className = 'absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-3 z-10 shadow-md border border-white/30';
                            prevButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
                            prevButton.onclick = (e) => {
                                e.stopPropagation();
                                goToPrevImage();
                            };
                            // Всегда активно для циклической навигации
                            content.appendChild(prevButton);

                            // Кнопка "Следующее изображение"
                            const nextButton = document.createElement('button');
                            nextButton.className = 'absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-3 z-10 shadow-md border border-white/30';
                            nextButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
                            nextButton.onclick = (e) => {
                                e.stopPropagation();
                                goToNextImage();
                            };
                            // Всегда активно для циклической навигации
                            content.appendChild(nextButton);

                            // Создаем точки для каждого изображения
                            sweepstakesImages.forEach((_, index) => {
                                const dot = document.createElement('button');
                                dot.className = `nav-dot h-2 w-2 rounded-full ${
                                    currentFullscreenIndex === index ? 'bg-orange-500' : 'bg-gray-400'
                                }`;

                                // При клике на точку меняем изображение
                                dot.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    updateFullscreenImage(index);
                                });

                                navContainer.appendChild(dot);
                            });

                            content.appendChild(navContainer);
                        }

                        content.appendChild(fullImg);
                        modal.appendChild(content);
                        document.body.appendChild(modal);

                        // Обработчик клавиатуры для навигации
                        const handleKeyDown = (e) => {
                            if (e.key === 'ArrowLeft') {
                                goToPrevImage();
                            } else if (e.key === 'ArrowRight') {
                                goToNextImage();
                            } else if (e.key === 'Escape') {
                                document.body.removeChild(modal);
                                document.removeEventListener('keydown', handleKeyDown);
                            }
                        };

                        // Добавляем обработчик клавиатуры
                        document.addEventListener('keydown', handleKeyDown);

                        // Удаляем обработчик при закрытии модального окна
                        modal.addEventListener('remove', () => {
                            document.removeEventListener('keydown', handleKeyDown);
                        });
                    }}
                />

                {sweepstakesImages.length > 1 && (
                    <>
                        {/* Кнопка предыдущего изображения */}
                        <button
                            onClick={goToPreviousImage}
                            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-3 z-10 shadow-md border border-white/30"
                            aria-label="Previous image"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                                 fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"
                                 strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>

                        {/* Кнопка следующего изображения */}
                        <button
                            onClick={goToNextImage}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-3 z-10 shadow-md border border-white/30"
                            aria-label="Next image"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                                 fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"
                                 strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>

                        {/* Индикатор текущего изображения */}
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
                            {sweepstakesImages.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentImageIndex(index)}
                                    className={`h-2 w-2 rounded-full ${
                                        index === currentImageIndex ? 'bg-orange-500' : 'bg-gray-400'
                                    }`}
                                    aria-label={`Go to image ${index + 1}`}
                                />
                            ))}
                        </div>

                        {/* Счетчик изображений */}
                        {sweepstakesImages.length > 1 && (
                            <div
                                className="absolute top-3 right-3 bg-orange-500 text-white px-2 py-1 rounded font-medium text-sm shadow-md border border-white/60">
                                {currentImageIndex + 1} / {sweepstakesImages.length}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="p-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-white text-xl font-medium">
                        {searchQuery
                            ? highlightText(sweepstakes.title, searchQuery)
                            : sweepstakes.title
                        }
                    </h2>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => {
                                if (navigator.share) {
                                    // Формируем правильный URL для конкретного розыгрыша
                                    const sweepstakesUrl = `${window.location.origin}/sweepstakes/${sweepstakes.id}`;

                                    // Очищаем HTML-теги из заголовка
                                    const cleanTitle = sweepstakes.title ? sweepstakes.title.replace(/<[^>]*>/g, '') : '';

                                    navigator.share({
                                        title: cleanTitle,
                                        url: sweepstakesUrl
                                    }).catch(console.error);
                                } else {
                                    // Формируем правильный URL для копирования
                                    const sweepstakesUrl = `${window.location.origin}/sweepstakes/${sweepstakes.id}`;
                                    navigator.clipboard.writeText(sweepstakesUrl);
                                    alert('Link copied to clipboard!');
                                }
                            }}
                            className="p-2 rounded-full text-gray-400 hover:text-orange-500"
                        >
                            <Share2 className="h-6 w-6"/>
                        </button>
                        <button
                            onClick={toggleFavorite}
                            className={`p-2 rounded-full ${isFavorite ? 'text-red-500' : 'text-gray-400'}`}
                        >
                            <Heart className="h-6 w-6" fill={isFavorite ? 'currentColor' : 'none'}/>
                        </button>
                        {/* Переместили кнопку редактирования сюда, в конец блока */}
                        {user && user.id === sweepstakes.postedBy.id &&
                            new Date().getTime() - new Date(sweepstakes.createdAtISO).getTime() < 24 * 60 * 60 * 1000 && (
                                <button
                                    onClick={() => navigate(`/edit-sweepstakes/${sweepstakes.id}`)}
                                    className="ml-1 text-orange-500 hover:text-orange-700"
                                >
                                    <Edit2 className="h-5 w-5"/>
                                </button>
                            )}
                    </div>
                </div>

                {sweepstakes.expiresAt && (
                    <div className={`mt-3 flex items-center ${isExpired ? 'text-red-500 bg-red-500/20 px-2 py-0.5 rounded-full' : 'text-gray-300'}`}>
                        {isExpired ? (
                          <>
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Expired
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                              <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5" />
                              <path d="M16 2v4" />
                              <path d="M8 2v4" />
                              <path d="M3 10h18" />
                              <circle cx="18" cy="18" r="4" />
                              <path d="M18 16.5v1.5h1.5" />
                            </svg>
                            {new Date(sweepstakes.expiresAt).toLocaleDateString()}
                          </>
                        )}
                    </div>
                )}

                <div className="mt-2 flex items-center justify-between">
                    <VoteControls dealId={sweepstakes.id}/>
                </div>

                {user ? (
                    <a
                        href={sweepstakes.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 bg-orange-500 text-white py-3 rounded-md flex items-center justify-center font-medium"
                    >
                                <span>Участвовать в розыгрыше</span>
                        <ExternalLink className="h-4 w-4 ml-2"/>
                    </a>
                ) : (
                    <button
                        onClick={() => navigate('/auth')}
                        className="mt-4 bg-gray-500 text-white py-3 rounded-md flex items-center justify-center font-medium w-full cursor-pointer"
                    >
                        <span>Войдите, чтобы участвовать</span>
                        <ExternalLink className="h-4 w-4 ml-2"/>
                    </button>
                )}

                <div className="mt-6">
                    <h3 className="text-white font-medium mb-2">Описание</h3>
                    <pre
                        className="description-text font-sans text-sm bg-transparent overflow-visible whitespace-pre-wrap border-0 p-0 m-0"
                        dangerouslySetInnerHTML={{
                            __html: (() => {
                                // Сначала подготавливаем описание
                                let processedDescription = sweepstakes.description
                                    // Сначала удаляем технический блок с JSON изображений
                                    .replace(/!-- DEAL_IMAGES: .*? -->/g, '')
                                    // Обрабатываем URL в тексте с улучшенным регулярным выражением
                                    .replace(/(https?:\/\/[^\s<>"]+)/g, (match) => {
                                        // Проверяем, заканчивается ли URL специальным символом
                                        const lastChar = match.charAt(match.length - 1);
                                        // Проверяем специальные символы наконце URL
                                        if ([',', '.', ':', ';', '!', '?', ')', ']', '}'].includes(lastChar)) {
                                            // Исключаем последний символ из ссылки (href и текста) и добавляем его после тега </a>
                                            return `<a href="${match.slice(0, -1)}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline">${match.slice(0, -1)}</a>${lastChar}`;
                                        }
                                        // Если URL не заканчивается специальным символом из списка, создаем ссылку как обычно
                                        return `<a href="${match}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline">${match}</a>`;
                                    })
                                    //    // Обрабатываем двойные переносы строк (пустые строки)
                                    .replace(/\n\n/g, '<br><br>')
                                    // Затем обрабатываем обычные переносы строк
                                    .replace(/\n/g, '<br>');

                                // Если есть поисковый запрос, применяем прямую подсветку в HTML строке
                                if (searchQuery) {
                                    const searchRegex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                                    return processedDescription.replace(
                                        searchRegex,
                                        '<span class="bg-orange-500 text-white px-0.5 rounded">$1</span>'
                                    );
                                }

                                return processedDescription;
                            })()
                        }}
                        ref={(element) => {
                            if (element) {
                                const links = element.querySelectorAll('a');
                                links.forEach(link => {
                                    link.setAttribute('target', '_blank');
                                    link.setAttribute('rel', 'noopener noreferrer');
                                });
                            }
                        }}
                    />
                </div>

                <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-white font-medium">Comments ({commentCount})</h3>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'popular')}
                            className="bg-gray-800 text-white text-sm rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none flex-shrink-0"
                        >
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="popular">Popular</option>
                        </select>
                    </div>

                    <div className="mb-4">
                        <CommentInput
                            sourceType="deal_comment"
                            sourceId={sweepstakes.id}
                            onSubmit={loadComments}
                        />
                    </div>

                    {/* Render comments as a tree */}
                    {comments.length > 0 ? (
                        <div className="space-y-4">
                            {comments.map(comment => renderCommentTree(comment))}
                        </div>
                    ) : (
                        <div className="bg-gray-800 rounded-md p-4 text-gray-400 text-center">
                            No comments yet. Be the first to comment!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SweepstakesDetailPage;