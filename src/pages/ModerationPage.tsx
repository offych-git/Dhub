import React, { useEffect, useState } from "react";
import { useModeration } from "../contexts/ModerationContext";
import { useAdmin } from "../hooks/useAdmin";
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  Loader,
  AlertCircle,
  Settings,
  Edit,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const ModerationPage: React.FC = () => {
  const {
    moderationQueue,
    isLoading,
    queueCount, // Хотя не используется напрямую в этом файле, сохраняю для контекста
    loadModerationQueue,
    approveModerationItem,
    rejectModerationItem,
  } = useModeration();
  const { role } = useAdmin();
  const [selectedType, setSelectedType] = useState<string>("deal");
  const [rejectionComment, setRejectionComment] = useState<string>("");
  const [showCommentInput, setShowCommentInput] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("pending"); // Не используется, но сохраняю для контекста
  const navigate = useNavigate();
  // Используем отдельное состояние для отображения очереди, чтобы можно было мгновенно обновлять UI
  const [moderationQueueState, setModerationQueueState] =
    useState(moderationQueue);
  const [isRejectLoading, setIsRejectLoading] = useState(false);

  // Обновляем локальное состояние при изменении глобальной очереди
  useEffect(() => {
    console.log(
      "ModerationPage: moderationQueue изменился в контексте, обновляем локальное состояние.",
    );
    setModerationQueueState(moderationQueue);
  }, [moderationQueue]);

  useEffect(() => {
    console.log(
      "ModerationPage: Компонент монтируется, загружаем очередь модерации.",
    );
    loadModerationQueue();
  }, []);

  // Check if user has access to this page
  if (role !== "admin" && role !== "moderator" && role !== "super_admin") {
    console.warn(
      `ModerationPage: Пользователь с ролью "${role}" пытается получить доступ. Доступ запрещен.`,
    );
    return (
      <div className="p-4 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Доступ запрещен</h1>
        <p className="mb-4">У вас нет прав для доступа к этой странице.</p>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-orange-500 text-white rounded-md"
        >
          Вернуться на главную
        </button>
      </div>
    );
  }

  const filteredQueue = moderationQueueState.filter((item) => {
    // Используем moderationQueueState для фильтрации
    // Фильтруем по типу
    if (selectedType !== "all" && item.item_type !== selectedType) {
      return false;
    }
    // Показываем только элементы со статусом pending
    if (item.status !== "pending") {
      return false;
    }
    // Проверяем статус в контенте, если он доступен
    // Это важно, если контент элемента уже был отклонен или удален на уровне БД,
    // но запись в очереди модерации все еще 'pending'.
    if (
      item.content &&
      (item.content.status === "rejected" || item.content.status === "deleted")
    ) {
      console.log(
        `ModerationPage: Отфильтрован элемент ${item.item_id} (${item.item_type}) со статусом контента "${item.content.status}".`,
      );
      return false;
    }
    return true;
  });

  console.log(
    `ModerationPage: Количество элементов в очереди модерации: ${moderationQueueState.length}`,
  );
  console.log(
    `ModerationPage: Отфильтрованное количество элементов: ${filteredQueue.length} (Тип: ${selectedType})`,
  );

  const handleApprove = async (itemId: string, itemType: string) => {
    console.log(
      `ModerationPage: handleApprove вызван для ID: ${itemId}, Тип: ${itemType}`,
    );
    try {
      console.log(
        `ModerationPage: Начало процесса одобрения элемента ID: ${itemId}, тип: ${itemType}`,
      );

      // Проверка существования элемента перед одобрением
      let tableName = "";
      if (itemType === "deal" || itemType === "sweepstake") {
        tableName = "deals"; // Обе сущности, deal и sweepstake, в вашем случае хранятся в таблице 'deals'
      } else if (itemType === "promo") {
        tableName = "promo_codes";
      }

      if (tableName) {
        console.log(
          `ModerationPage: Проверка существования элемента в таблице "${tableName}" для ID: ${itemId}`,
        );
        const { data, error } = await supabase
          .from(tableName)
          .select("id, status")
          .eq("id", itemId)
          .single();

        if (error) {
          console.error(
            `ModerationPage: Ошибка при проверке элемента перед одобрением (Supabase):`,
            error,
          );
          // Здесь не вызываем alert, так как основная логика одобрения все равно будет вызвана
        } else {
          console.log(
            `ModerationPage: Текущее состояние элемента в БД: ${data?.status}`,
          );
          if (!data) {
            console.warn(
              `ModerationPage: Элемент с ID ${itemId} не найден в таблице ${tableName} перед одобрением.`,
            );
            alert("Элемент не найден или уже был обработан.");
            // Удаляем из UI, если его нет в БД
            setModerationQueueState((prev) =>
              prev.filter(
                (item) =>
                  !(item.item_id === itemId && item.item_type === itemType),
              ),
            );
            return; // Прекращаем выполнение, если элемента нет
          }
        }
      }

      // Вызов функции одобрения из контекста
      console.log(
        `ModerationPage: Вызываем approveModerationItem из контекста для ID: ${itemId}`,
      );
      const success = await approveModerationItem(itemId, itemType);

      if (success) {
        console.log(
          `ModerationPage: Элемент успешно одобрен контекстом, обновляем UI.`,
        );

        // Удаляем элемент из локального состояния для мгновенного обновления UI
        setModerationQueueState((prev) =>
          prev.filter(
            (item) => !(item.item_id === itemId && item.item_type === itemType),
          ),
        );

        alert("Элемент успешно одобрен и опубликован!");
      } else {
        console.error(
          `ModerationPage: approveModerationItem вернул false для элемента ${itemId}.`,
        );
        alert("Произошла ошибка при одобрении элемента");
      }
    } catch (error) {
      console.error(
        "ModerationPage: Неожиданная ошибка в handleApprove:",
        error,
      );
      alert("Произошла неожиданная ошибка при одобрении элемента");
    }
  };

  const handleReject = async (itemId: string, itemType: string) => {
    console.log(
      `ModerationPage: handleReject вызван для ID: ${itemId}, Тип: ${itemType}`,
    );
    if (showCommentInput === itemId) {
      // Если комментарий уже отображается, это значит, что пользователь нажал "Подтвердить"
      console.log(
        `ModerationPage: Подтверждение отклонения для ID: ${itemId} с комментарием: "${rejectionComment}"`,
      );
      try {
        if (isRejectLoading) {
          console.log(
            "ModerationPage: Отклонение уже в процессе, игнорируем повторный клик.",
          );
          return;
        }

        setIsRejectLoading(true); // Устанавливаем флаг загрузки

        // Отладочная информация для проверки правильности данных (для promo)
        if (itemType === "promo") {
          console.log(
            "ModerationPage: Отклонение промокода. Проверяем наличие записи в promo_codes:",
          );
          const { data, error } = await supabase
            .from("promo_codes")
            .select("id, status") // Запрашиваем также статус
            .eq("id", itemId)
            .single();

          if (error) {
            console.error(
              "ModerationPage: Ошибка при проверке промокода перед отклонением:",
              error,
            );
          } else {
            console.log("ModerationPage: Найденный промокод в базе:", data);

            // Если статус уже rejected, не делаем повторный запрос
            if (data && data.status === "rejected") {
              console.warn(
                "ModerationPage: Промокод уже отклонен, пропускаем обновление.",
              );
              setModerationQueueState((prev) =>
                prev.filter(
                  (item) =>
                    !(item.item_id === itemId && item.item_type === itemType),
                ),
              );
              setShowCommentInput(null);
              setRejectionComment("");
              alert("Элемент уже был отклонен.");
              setIsRejectLoading(false);
              return;
            }
          }
        }
        // Добавьте аналогичные проверки для 'deal' и 'sweepstake' в таблице 'deals', если это необходимо.
        // Хотя для 'deal' и 'sweepstake' вы просто проверяете существование в handleApprove,
        // здесь можно добавить проверку статуса, если у них может быть статус 'rejected'.
        else if (itemType === "deal" || itemType === "sweepstake") {
          const { data, error } = await supabase
            .from("deals")
            .select("id, status")
            .eq("id", itemId)
            .single();

          if (error) {
            console.error(
              `ModerationPage: Ошибка при проверке ${itemType} перед отклонением:`,
              error,
            );
          } else {
            if (data && data.status === "rejected") {
              console.warn(
                `ModerationPage: ${itemType} уже отклонен, пропускаем обновление.`,
              );
              setModerationQueueState((prev) =>
                prev.filter(
                  (item) =>
                    !(item.item_id === itemId && item.item_type === itemType),
                ),
              );
              setShowCommentInput(null);
              setRejectionComment("");
              alert("Элемент уже был отклонен.");
              setIsRejectLoading(false);
              return;
            }
          }
        }

        try {
          console.log(
            `ModerationPage: Вызываем rejectModerationItem из контекста для ID: ${itemId}`,
          );
          const success = await rejectModerationItem(
            itemId,
            itemType,
            rejectionComment,
          );

          if (success) {
            console.log(
              `ModerationPage: Успешно отклонен элемент ${itemId} типа ${itemType}.`,
            );

            // Скрываем элемент из локального списка для мгновенного обновления UI
            setModerationQueueState((prev) =>
              prev.filter(
                (item) =>
                  !(item.item_id === itemId && item.item_type === itemType),
              ),
            );

            // Сбрасываем состояние ввода
            setShowCommentInput(null);
            setRejectionComment("");

            alert("Элемент успешно отклонен и скрыт со страницы.");
          } else {
            console.error(
              `ModerationPage: rejectModerationItem вернул false для элемента ${itemId}.`,
            );
            alert("Произошла ошибка при отклонении элемента.");
          }
        } catch (rejectError) {
          console.error(
            "ModerationPage: Ошибка при выполнении rejectModerationItem:",
            rejectError,
          );
          // Скрываем технические детали ошибки от пользователя
          alert("Произошла ошибка при отклонении элемента.");
        }
      } catch (error) {
        console.error(
          "ModerationPage: Неожиданная ошибка в handleReject (на этапе проверки или внешнего вызова):",
          error,
        );
        alert("Произошла ошибка при отклонении элемента.");
      } finally {
        setIsRejectLoading(false); // Сбрасываем флаг загрузки в любом случае
        console.log("ModerationPage: isRejectLoading установлен в false.");
      }
    } else {
      // Если комментарий не отображается, показываем его
      console.log(
        `ModerationPage: Запрашиваем комментарий для отклонения элемента ID: ${itemId}`,
      );
      setShowCommentInput(itemId);
      setRejectionComment(""); // Очищаем предыдущий комментарий
    }
  };

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case "deal":
        return "Скидка";
      case "promo":
        return "Промокод";
      case "sweepstake":
        return "Розыгрыш";
      default:
        return type;
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Модерация контента</h1>
          <p className="text-gray-600 text-sm">
            Элементов в очереди: {filteredQueue.length}
          </p>
        </div>

        {(role === "admin" || role === "super_admin") && (
          <button
            onClick={() => {
              console.log(
                "ModerationPage: Переход на страницу настроек модерации.",
              );
              navigate("/moderation/settings");
            }}
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
            onClick={() => {
              setSelectedType("deal");
              console.log("ModerationPage: Выбран тип: Скидки");
            }}
            className={`px-3 py-1 rounded-md ${selectedType === "deal" ? "bg-orange-500 text-white" : "bg-gray-200"}`}
          >
            Скидки (
            {
              moderationQueueState.filter(
                (item) =>
                  item.item_type === "deal" && item.status === "pending",
              ).length
            }
            )
          </button>
          <button
            onClick={() => {
              setSelectedType("promo");
              console.log("ModerationPage: Выбран тип: Промокоды");
            }}
            className={`px-3 py-1 rounded-md ${selectedType === "promo" ? "bg-orange-500 text-white" : "bg-gray-200"}`}
          >
            Промокоды (
            {
              moderationQueueState.filter(
                (item) =>
                  item.item_type === "promo" && item.status === "pending",
              ).length
            }
            )
          </button>
          <button
            onClick={() => {
              setSelectedType("sweepstake");
              console.log("ModerationPage: Выбран тип: Розыгрыши");
            }}
            className={`px-3 py-1 rounded-md ${selectedType === "sweepstake" ? "bg-orange-500 text-white" : "bg-gray-200"}`}
          >
            Розыгрыши (
            {
              moderationQueueState.filter(
                (item) =>
                  item.item_type === "sweepstake" && item.status === "pending",
              ).length
            }
            )
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader className="h-8 w-8 text-orange-500 animate-spin" />
          <p className="ml-2 text-gray-600">Загрузка очереди модерации...</p>
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
            <div
              key={item.id}
              className="bg-white rounded-md shadow overflow-hidden"
            >
              <div className="bg-gray-100 px-4 py-3 border-b">
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {getItemTypeLabel(item.item_type)}
                  </span>
                  <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                    Ожидает проверки
                  </span>
                </div>
              </div>

              <div className="p-4">
                {item.content ? (
                  <>
                    <h3 className="font-bold text-lg mb-2">
                      {item.content.title}
                    </h3>

                    {item.content.image_url && (
                      <div className="mb-3">
                        <img
                          src={item.content.image_url}
                          alt={item.content.title}
                          className="w-full h-40 object-cover rounded-md"
                        />
                      </div>
                    )}

                    <div className="text-gray-700 mb-3 text-sm line-clamp-3 overflow-hidden">
                      {typeof item.content.description === "string"
                        ? item.content.description.replace(/<[^>]*>/g, "")
                        : ""}
                    </div>

                    {item.item_type === "deal" && (
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="font-bold text-xl text-orange-600">
                          ${item.content.current_price}
                        </span>
                        {item.content.original_price && (
                          <span className="text-gray-500 line-through">
                            ${item.content.original_price}
                          </span>
                        )}
                      </div>
                    )}

                    {item.item_type === "promo" && item.content.code && (
                      <div className="mb-3 bg-gray-100 p-2 rounded text-center font-mono">
                        {item.content.code}
                      </div>
                    )}
                    {item.item_type === "sweepstake" &&
                      item.content.draw_date && (
                        <div className="mb-3">
                          <p className="text-sm text-gray-700">
                            Дата розыгрыша:{" "}
                            {new Date(
                              item.content.draw_date,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                  </>
                ) : (
                  <p className="text-gray-500 italic">
                    Невозможно загрузить содержимое элемента. Возможно, данные
                    были удалены или повреждены. ID: {item.item_id}
                  </p>
                )}

                <div className="text-xs text-gray-500 mb-3">
                  Добавлено: {new Date(item.submitted_at).toLocaleString()}
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs text-gray-700">
                      {item.submitted_by_profile?.display_name?.[0]?.toUpperCase() ||
                        "U"}
                    </div>
                  </div>
                  <span className="text-sm">
                    {item.submitted_by_profile?.display_name || "Пользователь"}
                  </span>
                </div>

                {showCommentInput === item.item_id ? (
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
                      Комментарий к отклонению:
                    </label>
                    <textarea
                      className="w-full border rounded-md p-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                      rows={2}
                      value={rejectionComment}
                      onChange={(e) => setRejectionComment(e.target.value)}
                      placeholder="Укажите причину отклонения..."
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    onClick={() => handleApprove(item.item_id, item.item_type)}
                    className="flex-1 bg-green-500 text-white py-2 rounded-md flex items-center justify-center gap-1 hover:bg-green-600 transition-colors"
                    disabled={isLoading} // Отключаем кнопку при загрузке
                  >
                    <CheckCircle className="h-4 w-4" />
                    Одобрить
                  </button>
                  <button
                    onClick={() => handleReject(item.item_id, item.item_type)}
                    className={`flex-1 ${showCommentInput === item.item_id ? "bg-red-700" : "bg-red-500"} text-white py-2 rounded-md flex items-center justify-center gap-1 hover:bg-red-600 transition-colors`}
                    disabled={isRejectLoading} // Отключаем кнопку при загрузке отклонения
                  >
                    {isRejectLoading ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : showCommentInput === item.item_id ? (
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
                  {(role === "admin" ||
                    role === "moderator" ||
                    role === "super_admin") && (
                    <button
                      onClick={() => {
                        console.log(
                          `ModerationPage: Переход к редактированию элемента ID: ${item.item_id}, Тип: ${item.item_type}`,
                        );
                        if (item.item_type === "promo") {
                          navigate(
                            `/promos/${item.item_id}/edit?from=moderation`,
                          );
                        } else if (item.item_type === "deal") {
                          navigate(
                            `/edit-deal/${item.item_id}?from=moderation`,
                          );
                        } else if (item.item_type === "sweepstake") {
                          navigate(
                            `/edit-sweepstakes/${item.item_id}?from=moderation`,
                          );
                        }
                      }}
                      className="w-full mt-2 bg-blue-500 text-white py-2 rounded-md flex items-center justify-center gap-1 hover:bg-blue-600 transition-colors"
                      disabled={isLoading || isRejectLoading} // Отключаем, если уже идет какая-то операция
                    >
                      <Edit className="h-4 w-4" />
                      Изменить
                    </button>
                  )}
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
