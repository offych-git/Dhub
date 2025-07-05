import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Info, ChevronDown, RefreshCcw } from "lucide-react";
import { categories, categoryIcons } from "../data/mockData";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import CategorySimpleBottomSheet from "../components/deals/CategorySimpleBottomSheet";
import { useLanguage } from "../contexts/LanguageContext";
import { useGlobalState } from "../contexts/GlobalStateContext";
import { useAdmin } from "../hooks/useAdmin";
import { useModeration } from "../contexts/ModerationContext";
import { translateAfterSave, translateTextOnly } from "../utils/autoTranslate";

interface PromoData {
  id: string;
  code: string;
  title: string;
  description: string;
  category_id: string;
  discount_url: string;
  expires_at: string | null;
  // Многоязычные поля
  title_en?: string;
  title_es?: string;
  description_en?: string;
  description_es?: string;
}

interface AddPromoPageProps {
  isEditing?: boolean;
  promoData?: PromoData;
  autoApprove?: boolean;
}

const AddPromoPage: React.FC<AddPromoPageProps> = ({
  isEditing = false,
  promoData,
  autoApprove = false,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { dispatch } = useGlobalState();
  const { isAdmin, isModerator } = useAdmin();
  const { addToModerationQueue } = useModeration();

  useEffect(() => {
    const pageTitle = "Add New Promo Code";

    console.log(
      `[Add New Promo Code Web] INFO: useEffect для отправки заголовка "${pageTitle}" запущен (с небольшой задержкой).`,
    );

    const timerId = setTimeout(() => {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        console.log(
          `[Add New Promo Code Web] INFO: Отправляю заголовок "${pageTitle}" в React Native после задержки.`,
        );
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "SET_NATIVE_HEADER_TITLE",
            title: pageTitle,
          }),
        );
      } else {
        console.warn(
          `[Add New Promo Code Web] WARN: ReactNativeWebView.postMessage НЕ ДОСТУПЕН (после задержки). Возможно, страница открыта не в WebView React Native.`,
        );
      }
    }, 50);

    return () => clearTimeout(timerId);
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [formData, setFormData] = useState({
    promoCode: "",
    title: "",
    description: "",
    category: "",
    discountUrl: "",
    expiryDate: "",
    // Многоязычные поля
    title_en: "",
    title_es: "",
    description_en: "",
    description_es: "",
  });

  useEffect(() => {
    if (isEditing && promoData) {
      setFormData({
        promoCode: promoData.code || "",
        title: promoData.title || "",
        description: promoData.description || "",
        category: promoData.category_id || "",
        discountUrl: promoData.discount_url || "",
        // ИСПРАВЛЕНО: Логика инициализации expiryDate для отображения в календарике
        expiryDate: promoData.expires_at
          ? (() => {
              const expiresAtDate = new Date(promoData.expires_at);
              const year = expiresAtDate.getFullYear();
              const month = (expiresAtDate.getMonth() + 1).toString().padStart(2, '0');
              const day = expiresAtDate.getDate().toString().padStart(2, '0');
              return `${year}-${month}-${day}`;
            })()
          : "",
        // Многоязычные поля
        title_en: promoData.title_en || "",
        title_es: promoData.title_es || "",
        description_en: promoData.description_en || "",
        description_es: promoData.description_es || "",
      });
    }
  }, [isEditing, promoData]);

  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  const [showTranslations, setShowTranslations] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  useEffect(() => {
    const isFormValid =
      formData.promoCode.trim() !== "" &&
      formData.title.trim() !== "" &&
      formData.description.trim() !== "" &&
      formData.category !== "" &&
      formData.discountUrl.trim() !== "" &&
      (!formData.expiryDate || new Date(formData.expiryDate) > new Date());

    setIsValid(isFormValid);
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditing && promoData) {
        // Update existing promo
        const updateData: any = {
          code: formData.promoCode,
          title: formData.title,
          description: formData.description,
          // Многоязычные поля
          title_en: formData.title_en || null,
          title_es: formData.title_es || null,
          description_en: formData.description_en || null,
          description_es: formData.description_es || null,
          category_id: formData.category,
          discount_url: formData.discountUrl,
          // ИСПРАВЛЕНО: Логика сохранения expires_at для AddPromoPage
          expires_at: formData.expiryDate
            ? (() => {
                const selectedDate = new Date(formData.expiryDate); // 'YYYY-MM-DD' в локальном времени
                selectedDate.setHours(23, 59, 59, 999); // Устанавливаем конец дня в локальном времени
                return selectedDate.toISOString(); // Преобразуем в UTC ISO-строку
              })()
            : null,
          updated_at: new Date().toISOString(),
        };

        console.log("Updating promo with autoApprove:", autoApprove);
        console.log("Promo ID для обновления:", promoData.id);
        console.log("Данные для обновления:", updateData);

        // If autoApprove is true, update the status to approved and add moderator info
        if (autoApprove) {
          updateData.status = "approved";
          updateData.moderator_id = user.id;
          updateData.moderated_at = new Date().toISOString();

          // Also update the moderation queue if coming from moderation
          const { error: queueError } = await supabase
            .from("moderation_queue")
            .update({
              status: "approved",
              moderator_id: user.id,
              moderated_at: new Date().toISOString(),
            })
            .eq("item_id", promoData.id)
            .eq("item_type", "promo");

          if (queueError) {
            console.error("Error updating moderation queue:", queueError);
          }
        }

        // Импортируем функцию executeWithRetry
        // Импорт не нужен, так как это в рамках одного компонента
        console.log(
          "Обновляем промокод через RPC для обхода ограничений политик безопасности",
        );

        // Сначала обновляем данные промокода напрямую
        console.log("Выполняем прямое обновление данных промокода");
        const { data: updatedData, error } = await supabase
          .from("promo_codes")
          .update(updateData)
          .eq("id", promoData.id)
          .select("*"); // Явно запрашиваем все поля

        if (error) {
          console.error("Ошибка при прямом обновлении промокода:", error);
          throw error;
        }

        console.log("Результат прямого обновления промокода:", updatedData);

        // Если требуется автоматическое одобрение, используем существующую RPC-функцию
        if (autoApprove) {
          console.log(
            "Обновляем статус промокода через RPC-функцию update_promo_status",
          );
          try {
            const { data: statusResult, error: statusError } =
              await supabase.rpc("update_promo_status", {
                promo_id: promoData.id,
                new_status: "approved",
                moderator_user_id: user.id,
                new_moderation_note: "Approved from moderation page",
              });

            console.log(
              "Результат обновления статуса через RPC:",
              statusResult,
            );

            if (statusError) {
              console.error(
                "Ошибка RPC вызова update_promo_status:",
                statusError,
              );
              console.error("Параметры вызова:", {
                promo_id: promoData.id,
                new_status: "approved",
                moderator_user_id: user.id,
              });
              // Продолжаем выполнение, так как основные данные уже обновлены
            } else {
              console.log("Успешное обновление статуса через RPC-функцию");
            }
          } catch (rpcErr) {
            console.error(
              "Ошибка при вызове RPC-функции update_promo_status:",
              rpcErr,
            );
            // Попробуем обновить статус напрямую

            console.log(
              "Дополнительное обновление статуса промокода на approved напрямую",
            );
            try {
              const { error: statusError } = await supabase
                .from("promo_codes")
                .update({
                  status: "approved",
                  moderator_id: user.id,
                  moderated_at: new Date().toISOString(),
                })
                .eq("id", promoData.id);

              if (statusError) {
                console.error(
                  "Ошибка при обновлении статуса промокода:",
                  statusError,
                );
              } else {
                console.log("Статус промокода успешно обновлен на approved");
              }
            } catch (statusErr) {
              console.error("Исключение при обновлении статуса:", statusErr);
            }
          }
        }

        // Также обновляем статус модерации в очереди независимо от результата
        if (autoApprove) {
          try {
            console.log("Обновляем статус в очереди модерации");
            const { error: queueUpdateError } = await supabase
              .from("moderation_queue")
              .update({
                status: "approved",
                moderator_id: user.id,
                moderated_at: new Date().toISOString(),
              })
              .eq("item_id", promoData.id)
              .eq("item_type", "promo");

            if (queueUpdateError) {
              console.error(
                "Ошибка при обновлении статуса в очереди модерации:",
                queueUpdateError,
              );
            } else {
              console.log("Статус в очереди модерации успешно обновлен");
            }
          } catch (queueErr) {
            console.error(
              "Исключение при обновлении очереди модерации:",
              queueErr,
            );
          }
        }

        // Fetch the updated record separately
        const { data: updatedPromo, error: fetchError } = await supabase
          .from("promo_codes")
          .select("*")
          .eq("id", promoData.id)
          .maybeSingle();

        if (fetchError) throw fetchError;



        // Dispatch update to global state
        dispatch({
          type: "UPDATE_PROMO",
          payload: updatedPromo,
        });

        // If we came from moderation, go back to moderation queue
        if (autoApprove) {
          setSuccess("Promo code updated and approved successfully");
          setTimeout(() => navigate("/moderation"), 1000);
        } else {
          navigate("/promos");
        }
      } else {
        // Используем значения из хука useAdmin
        const isAdminOrModerator = isAdmin || isModerator;

        // Проверяем настройки модерации
        const { data: settings } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "moderation_enabled")
          .single();

        const moderationEnabled =
          settings?.value?.enabled && settings?.value?.types?.includes("promo");

        // Используем только допустимые значения: 'pending', 'approved', 'rejected'
        // В соответствии с ограничением в базе данных
        const moderationStatus =
          isAdminOrModerator || !moderationEnabled ? "approved" : "pending";

        const { data: promo, error: promoError } = await supabase
          .from("promo_codes")
          .insert({
            code: formData.promoCode,
            title: formData.title,
            description: formData.description,
            // Многоязычные поля
            title_en: formData.title_en || null,
            title_es: formData.title_es || null,
            description_en: formData.description_en || null,
            description_es: formData.description_es || null,
            category_id: formData.category,
            discount_url: formData.discountUrl,
            // ИСПРАВЛЕНО: Логика сохранения expires_at для AddPromoPage
            expires_at: formData.expiryDate
              ? (() => {
                  const selectedDate = new Date(formData.expiryDate); // 'YYYY-MM-DD' в локальном времени
                  selectedDate.setHours(23, 59, 59, 999); // Устанавливаем конец дня в локальном времени
                  return selectedDate.toISOString(); // Преобразуем в UTC ISO-строку
                })()
              : null,
            user_id: user?.id,
            status: moderationStatus,
          })
          .select()
          .maybeSingle();

        if (promoError) throw promoError;



        // Если требуется модерация, то добавляем в очередь модерации
        if (moderationStatus === "pending") {
          const { error: queueError } = await supabase
            .from("moderation_queue")
            .insert({
              item_id: promo.id,
              item_type: "promo",
              submitted_by: user?.id,
              submitted_at: new Date().toISOString(),
              status: "pending",
            });

          // Use the moderation context to add to the queue
          if (addToModerationQueue) {
            try {
              await addToModerationQueue(promo.id, "promo");
              console.log("Промокод успешно добавлен в очередь модерации");
            } catch (error) {
              console.error(
                "Ошибка при добавлении промокода в очередь модерации:",
                error,
              );
            }
          }

          if (queueError)
            console.error("Error adding to moderation queue:", queueError);

          // Показываем пользователю сообщение о модерации
          setSuccess("Промокод отправлен на модерацию");
          setTimeout(() => navigate("/promos"), 2000);
        } else {
          navigate("/promos");
        }
      }
    } catch (err: any) {
      console.error("Error saving promo:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (selectedCategoryId: string) => {
    setFormData({ ...formData, category: selectedCategoryId });
    setIsCategorySheetOpen(false);
  };

  // Функция для перевода текста
  const handleTranslate = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      alert("Заполните заголовок и описание на русском языке для перевода");
      return;
    }

    setIsTranslating(true);
    try {
      const result = await translateTextOnly(formData.title, formData.description);
      
      if (result.success) {
        // Заполняем поля переводами
        setFormData(prev => ({
          ...prev,
          title_en: result.translations.title_en,
          title_es: result.translations.title_es,
          description_en: result.translations.description_en,
          description_es: result.translations.description_es,
        }));

        alert("Перевод выполнен успешно!");
      } else {
        alert("Ошибка перевода: " + result.message);
      }
    } catch (error) {
      console.error("Ошибка перевода:", error);
      alert("Ошибка при переводе. Попробуйте еще раз.");
    } finally {
      setIsTranslating(false);
    }
  };

  // Новая функция: показать переводы И сразу перевести
  const handleShowAndTranslate = async () => {
    if (!showTranslations) {
      // Если переводы скрыты, показываем их и сразу переводим
      setShowTranslations(true);
      // Небольшая задержка, чтобы поля успели отрендериться
      setTimeout(() => {
        handleTranslate();
      }, 100);
    } else {
      // Если переводы уже показаны, просто скрываем
      setShowTranslations(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="web-page-header fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white text-lg font-medium ml-4">
              {isEditing ? "Edit Promo Code" : "Add New Promo Code"}
            </h1>
          </div>
          <button className="text-white">
            <Info className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto pt-4 pb-24">
        <div className="main-content-area px-4 pt-6">
          {error && (
            <div className="bg-red-500 text-white px-4 py-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500 text-white px-4 py-3 rounded-md mb-4">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="url"
                placeholder="Discount URL *"
                className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 ${!error && formData.discountUrl !== "" ? "border border-yellow-500" : ""}`}
                value={formData.discountUrl}
                onChange={(e) =>
                  setFormData({ ...formData, discountUrl: e.target.value })
                }
              />
              <p className="text-orange-500 text-xs mt-1">
                Add a link where users can find more information.
              </p>
            </div>

            <div>
              <input
                type="text"
                placeholder="Promo Code *"
                className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 ${!error && formData.promoCode !== "" ? "border border-red-500" : ""}`}
                value={formData.promoCode}
                onChange={(e) =>
                  setFormData({ ...formData, promoCode: e.target.value })
                }
              />
            </div>

            <div>
              <input
                type="text"
                placeholder="Title (Russian) *"
                className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 ${!error && formData.title !== "" ? "border border-red-500" : ""}`}
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>

            <div>
              <textarea
                placeholder="Description (Russian) *"
                rows={4}
                className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 resize-none ${!error && formData.description !== "" ? "border border-red-500" : ""}`}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
              
              <div className="flex items-center gap-2 mt-6">
                <button
                  type="button"
                  onClick={handleShowAndTranslate}
                  className="px-4 py-2 rounded border border-gray-400 bg-white text-gray-800 hover:bg-gray-100 transition"
                  disabled={!formData.title.trim() || !formData.description.trim()}
                >
                  {showTranslations ? "Скрыть переводы" : "Показать и перевести"}
                </button>
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={isTranslating || !formData.title.trim() || !formData.description.trim() || !showTranslations}
                  className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition disabled:bg-gray-100 disabled:text-gray-400"
                  title="Обновить переводы"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  {isTranslating ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <RefreshCcw className="h-5 w-5" />
                  )}
                </button>
              </div>
              {translateError && (
                <div className="text-red-500 text-xs mt-1">{translateError}</div>
              )}
            </div>

            {/* Многоязычные поля для заголовка */}
            {showTranslations && (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 mb-2 text-sm font-medium">
                    Заголовок (English)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter English title"
                    className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 ${!error && formData.title_en !== "" ? "border border-red-500" : ""}`}
                    value={formData.title_en}
                    onChange={(e) =>
                      setFormData({ ...formData, title_en: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-2 text-sm font-medium">
                    Заголовок (Spanish)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Spanish title"
                    className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 ${!error && formData.title_es !== "" ? "border border-red-500" : ""}`}
                    value={formData.title_es}
                    onChange={(e) =>
                      setFormData({ ...formData, title_es: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            {/* Многоязычные поля для описания */}
            {showTranslations && (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 mb-2 text-sm font-medium">
                    Описание (English)
                  </label>
                  <textarea
                    placeholder="Enter English description"
                    rows={4}
                    className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 resize-none ${!error && formData.description_en !== "" ? "border border-red-500" : ""}`}
                    value={formData.description_en}
                    onChange={(e) =>
                      setFormData({ ...formData, description_en: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-2 text-sm font-medium">
                    Описание (Spanish)
                  </label>
                  <textarea
                    placeholder="Enter Spanish description"
                    rows={4}
                    className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 resize-none ${!error && formData.description_es !== "" ? "border border-red-500" : ""}`}
                    value={formData.description_es}
                    onChange={(e) =>
                      setFormData({ ...formData, description_es: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            <div>
              <button
                type="button"
                className="w-full bg-gray-800 text-white rounded-md px-4 py-3 flex items-center justify-between"
                onClick={() => setIsCategorySheetOpen(true)}
              >
                <span>
                  {formData.category
                    ? language === "ru"
                      ? categories.find((c) => c.id === formData.category)?.name
                      : t(formData.category)
                    : language === "ru"
                      ? "Выберите категорию"
                      : "Select Category"}
                </span>
                <ChevronDown className="h-5 w-5" />
              </button>
              <CategorySimpleBottomSheet
                isOpen={isCategorySheetOpen}
                onClose={() => setIsCategorySheetOpen(false)}
                categories={categories}
                categoryIcons={categoryIcons}
                selectedCategory={formData.category}
                onCategorySelect={handleCategorySelect}
              />
            </div>

            <div>
              <input
                type="date"
                className={`w-full bg-gray-800 text-white rounded-md px-4 py-3 ${!error && formData.expiryDate !== "" ? "border border-red-500" : ""}`}
                value={formData.expiryDate}
                onChange={(e) =>
                  setFormData({ ...formData, expiryDate: e.target.value })
                }
              />
              <p className="text-orange-500 text-xs mt-1">
                Expired date (optional) - must be in the future
              </p>
            </div>

            {/* Preview */}
            <div className="bg-gray-800 rounded-md p-4">
              <h3 className="text-white font-medium mb-2">Preview</h3>
              <div className="bg-gray-900 rounded-md p-4">
                {formData.title && (
                  <h4 className="text-white font-medium">{formData.title}</h4>
                )}
                {formData.promoCode && (
                  <div className="mt-2 inline-block bg-gray-800 px-3 py-1 rounded border border-gray-700">
                    <span className="text-orange-500 font-mono">
                      {formData.promoCode}
                    </span>
                  </div>
                )}
                {formData.description && (
                  <p className="text-gray-300 mt-2">{formData.description}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !isValid}
                className={`w-full mt-4 py-3 rounded-md font-medium flex items-center justify-center ${
                  isValid
                    ? "bg-orange-500 text-white"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : isEditing ? (
                  "Update Promo Code"
                ) : (
                  "Post Promo Code"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddPromoPage;