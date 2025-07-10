import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  Image as ImageIcon,
  Link as LinkIcon,
  Info,
  ChevronDown,
  X,
  Plus,
  ArrowLeftCircle,
  ArrowRightCircle,
  RefreshCcw,
} from "lucide-react";
import { categories, stores, categoryIcons } from "../data/mockData";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useAdmin } from "../hooks/useAdmin";
import { supabase } from "../lib/supabase";
import ImageUploader from "../components/deals/ImageUploader";
import imageCompression from "browser-image-compression";
import { createPortal } from "react-dom";
import CategorySimpleBottomSheet from "../components/deals/CategorySimpleBottomSheet";
import StoreBottomSheet from "../components/deals/StoreBottomSheet";
import { useGlobalState } from "../contexts/GlobalStateContext"; // Import useGlobalState
import { useModeration } from "../contexts/ModerationContext";
import { translateAfterSave, translateTextOnly } from "../utils/autoTranslate";

interface ImageWithId {
  file: File;
  id: string;
  publicUrl: string;
}

interface AddDealPageNewProps {
  isEditing?: boolean;
  dealId?: string;
  initialData?: any;
  customHeaderComponent?: React.ReactNode; // Added custom header prop
  allowHotToggle?: boolean;
  autoApprove?: boolean; // Add autoApprove prop
  labelOverrides?: {
    expiryDate?: string;
  };
}

const AddDealPageNew: React.FC<AddDealPageNewProps> = ({
  isEditing = false,
  dealId,
  initialData,
  customHeaderComponent,
  allowHotToggle,
  autoApprove,
  labelOverrides = {},
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { dispatch } = useGlobalState(); // Added dispatch
  const { role } = useAdmin();
  const { t, language } = useLanguage();
  const canMarkHot = role === "admin" || role === "moderator";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [isStoreSheetOpen, setIsStoreSheetOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const selectedStoreName =
    stores.find((store) => store.id === selectedStoreId)?.name || "";

  // Images for carousel
  const [dealImages, setDealImages] = useState<ImageWithId[]>([]);
  // В новой системе нам не нужен активный индекс, так как первое изображение всегда главное
  const [mainImageIndex, setMainImageIndex] = useState(0); // Оставляем для совместимости с существующим кодом
  const { addToModerationQueue } = useModeration();
  const [isDragActive, setIsDragActive] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  useEffect(() => {
    const pageTitle = "Add New Deal"; // Или ваш динамический заголовок

    console.log(
      `[Add New Deal Web] INFO: useEffect для отправки заголовка "${pageTitle}" запущен (с небольшой задержкой).`,
    );

    const timerId = setTimeout(() => {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        console.log(
          `[Add New Deal Web] INFO: Отправляю заголовок "${pageTitle}" в React Native после задержки.`,
        );
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "SET_NATIVE_HEADER_TITLE",
            title: pageTitle,
          }),
        );
      } else {
        console.warn(
          `[Add New Deal Web] WARN: ReactNativeWebView.postMessage НЕ ДОСТУПЕН (после задержки). Возможно, страница открыта не в WebView React Native.`,
        );
      }
    }, 50);

    return () => clearTimeout(timerId);
  }, []);

  // Загрузка существующих изображений при редактировании
  useEffect(() => {
    if (
      isEditing &&
      initialData?.imageUrls &&
      initialData.imageUrls.length > 0
    ) {
      const existingImages: ImageWithId[] = initialData.imageUrls.map(
        (url: string, index: number) => ({
          publicUrl: url,
          id: `existing-${index}`,
          file: new File([], `image-${index}.jpg`),
        }),
      );
      setDealImages(existingImages);
      console.log("Initialized carousel with images:", existingImages.length);
    }
  }, [isEditing, initialData]);

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    currentPrice: initialData?.current_price || "",
    originalPrice: initialData?.original_price || "",
    description: initialData?.description || "",
    category: initialData?.category || "",
    dealUrl: initialData?.deal_url || "",
    expiryDate: initialData?.expiry_date || initialData?.expires_at || "",
    isHot: initialData?.is_hot || false,
    // Многоязычные поля
    title_en: initialData?.title_en || "",
    title_es: initialData?.title_es || "",
    description_en: initialData?.description_en || "",
    description_es: initialData?.description_es || "",
  });

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.2,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: "image/jpeg",
      initialQuality: 0.8,
    };

    try {
      return await imageCompression(file, options);
    } catch (error) {
      console.error("Error compressing image:", error);
      return file;
    }
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError("Title is required");
      return false;
    }

    if (!formData.description.trim()) {
      setError("Description is required");
      return false;
    }

    if (!formData.currentPrice || isNaN(Number(formData.currentPrice))) {
      setError("Current price is required and must be a number");
      return false;
    }

    if (formData.originalPrice && isNaN(Number(formData.originalPrice))) {
      setError("Original price must be a number");
      return false;
    }

    if (Number(formData.currentPrice) > Number(formData.originalPrice)) {
      setError("Current price cannot be higher than original price");
      return false;
    }

    if (!formData.category) {
      setError("Please select a category");
      return false;
    }

    if (dealImages.length === 0) {
      setError("At least one image is required");
      return false;
    }

    if (!formData.dealUrl) {
      setError("Deal URL is required");
      return false;
    }

    // Более гибкая проверка URL, которая принимает query-параметры и фрагменты
    const urlRegex =
      /^(https?:\/\/)?([a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\/[^\s]*)?$/;
    if (!urlRegex.test(formData.dealUrl)) {
      setError("Please enter a valid URL starting with http:// or https://");
      return false;
    }

    if (
      !formData.dealUrl.startsWith("http://") &&
      !formData.dealUrl.startsWith("https://")
    ) {
      setFormData((prev) => ({
        ...prev,
        dealUrl: `https://${prev.dealUrl}`,
      }));
    }

    return true;
  };

  // Создаем редактор
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          HTMLAttributes: {
            class: "list-disc pl-4",
          },
        },
        paragraph: {
          HTMLAttributes: {
            class: "mb-3",
          },
        },
        hardBreak: {
          keepMarks: true,
          HTMLAttributes: {
            class: "inline-block",
          },
        },
      }),
      Underline,
      Image,
    ],
    content: formData.description || "",
    parseOptions: {
      preserveWhitespace: "full",
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[200px]",
      },
      handleKeyDown: (view, event) => {
        if (event.key === "Enter") {
          view.dispatch(
            view.state.tr
              .replaceSelectionWith(view.state.schema.nodes.hardBreak.create())
              .scrollIntoView(),
          );
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setFormData((prev) => ({
        ...prev,
        description: html,
      }));
    },
  });

  // Создаем редакторы для переводов
  const editorEn = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          HTMLAttributes: {
            class: "list-disc pl-4",
          },
        },
        paragraph: {
          HTMLAttributes: {
            class: "mb-3",
          },
        },
        hardBreak: {
          keepMarks: true,
          HTMLAttributes: {
            class: "inline-block",
          },
        },
      }),
      Underline,
    ],
    content: formData.description_en || "",
    parseOptions: {
      preserveWhitespace: "full",
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[150px]",
      },
      handleKeyDown: (view, event) => {
        if (event.key === "Enter") {
          view.dispatch(
            view.state.tr
              .replaceSelectionWith(view.state.schema.nodes.hardBreak.create())
              .scrollIntoView(),
          );
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setFormData((prev) => ({
        ...prev,
        description_en: html,
      }));
    },
  });

  const editorEs = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          HTMLAttributes: {
            class: "list-disc pl-4",
          },
        },
        paragraph: {
          HTMLAttributes: {
            class: "mb-3",
          },
        },
        hardBreak: {
          keepMarks: true,
          HTMLAttributes: {
            class: "inline-block",
          },
        },
      }),
      Underline,
    ],
    content: formData.description_es || "",
    parseOptions: {
      preserveWhitespace: "full",
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[150px]",
      },
      handleKeyDown: (view, event) => {
        if (event.key === "Enter") {
          view.dispatch(
            view.state.tr
              .replaceSelectionWith(view.state.schema.nodes.hardBreak.create())
              .scrollIntoView(),
          );
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setFormData((prev) => ({
        ...prev,
        description_es: html,
      }));
    },
  });

  // Устанавливаем содержимое редактора при загрузке существующих данных
  useEffect(() => {
    if (isEditing && initialData?.description && editor) {
      editor.commands.setContent(initialData.description);
      console.log("Set editor content from initial data");
    }
  }, [isEditing, initialData, editor]);

  // Отслеживаем состояние валидации каждого поля отдельно
  const [validationState, setValidationState] = useState({
    title: true,
    description: true,
    currentPrice: true,
    originalPrice: true,
    category: true,
    dealImages: true,
    dealUrl: true,
  });

  useEffect(() => {
    // Проверяем каждое обязательное поле отдельно
    const titleValid = formData.title.trim() !== "";
    const descriptionValid = formData.description.trim() !== "";
    const currentPriceValid =
      formData.currentPrice !== "" && !isNaN(Number(formData.currentPrice));
    const originalPriceValid =
      !formData.originalPrice ||
      (Number(formData.currentPrice) <= Number(formData.originalPrice) &&
        !isNaN(Number(formData.originalPrice)));
    const categoryValid = formData.category !== "";
    const imagesValid = dealImages.length > 0;
    const urlValid = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(
      formData.dealUrl,
    );

    // Обновляем состояние валидации
    setValidationState({
      title: titleValid,
      description: descriptionValid,
      currentPrice: currentPriceValid,
      originalPrice: originalPriceValid,
      category: categoryValid,
      dealImages: imagesValid,
      dealUrl: urlValid,
    });

    // Общая проверка формы
    const isFormValid =
      titleValid &&
      descriptionValid &&
      currentPriceValid &&
      originalPriceValid &&
      categoryValid &&
      imagesValid &&
      urlValid;

    setIsValid(isFormValid);
    console.log("Form validation:", {
      titleValid,
      descriptionValid,
      currentPriceValid,
      originalPriceValid,
      categoryValid,
      imagesValid: dealImages.length,
      urlValid,
    });
  }, [formData, dealImages]);

  const handleDealImageUpload = async (files: FileList | null) => {
    if (!files || !files.length) {
      return;
    }

    setIsUploadingImage(true);
    try {
      const newImages: ImageWithId[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!file.type.startsWith("image/")) {
          throw new Error("Please select only image files");
        }

        const compressedImage = await compressImage(file);
        const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const fileExt = compressedImage.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user?.id}/deal-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("deal-images")
          .upload(filePath, compressedImage, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Error uploading deal image:", uploadError);
          throw new Error("Failed to upload deal image");
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("deal-images").getPublicUrl(filePath);

        newImages.push({
          file: compressedImage,
          id: imageId,
          publicUrl: publicUrl,
        });
      }

      setDealImages((prev) => [...prev, ...newImages]);
    } catch (error) {
      console.error("Error in image upload process:", error);
      alert(
        `Failed to process images: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = (imageId: string) => {
    setDealImages((prev) => {
      const newImages = prev.filter((img) => img.id !== imageId);
      // В новой системе первое изображение всегда главное
      setMainImageIndex(0);
      return newImages;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    console.log("Значение autoApprove при handleSubmit:", autoApprove);
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (dealImages.length === 0)
        throw new Error("At least one image is required");

      // Убедимся, что у нас есть актуальное содержимое из редактора
      const currentDescription = editor
        ? editor.getHTML()
        : formData.description;

      // В новой системе, первое изображение в массиве всегда главное
      const mainImageUrl = dealImages[0].publicUrl;

      // Добавим все URL изображений в описание в специальном JSON-формате
      // Это позволит нам хранить дополнительные изображения без изменения структуры БД
      let enhancedDescription = currentDescription;

      // Если есть дополнительные изображения, добавим их в описание в формате JSON
      if (dealImages.length > 1) {
        const allImagesJson = JSON.stringify(
          dealImages.map((img) => img.publicUrl),
        );
        // Добавляем JSON с изображениями в конец описания в специальном формате
        // который можно будет распознать в DealDetailPage
        enhancedDescription += `\n\n<!-- DEAL_IMAGES: ${allImagesJson} -->`;
      }

      console.log("Saving description:", enhancedDescription);

      // Получаем HTML из редакторов переводов
      const descriptionEn = editorEn ? editorEn.getHTML() : formData.description_en;
      const descriptionEs = editorEs ? editorEs.getHTML() : formData.description_es;

      const dealData = {
        title: formData.title,
        description: enhancedDescription,
        // Многоязычные поля
        title_en: formData.title_en || null,
        title_es: formData.title_es || null,
        description_en: descriptionEn || null,
        description_es: descriptionEs || null,
        current_price: Number(formData.currentPrice),
        original_price: formData.originalPrice
          ? Number(formData.originalPrice)
          : null,
        store_id: selectedStoreId,
        category_id: formData.category,
        image_url: mainImageUrl,
        deal_url: formData.dealUrl,
        expires_at: formData.expiryDate
          ? `${formData.expiryDate}T23:59:59.999Z`
          : null,
        is_hot: formData.isHot,
      };

      // Проверяем режим - создание или редактирование
      if (isEditing && dealId) {
        // Обновление существующей скидки
        console.log("Updating existing deal:", dealId);

        // Отмечаем все сделки как устаревшие для последующей перезагрузки
        try {
          if (dispatch) {
            dispatch({ type: "MARK_DEALS_STALE" });
          } else {
            console.warn("dispatch is undefined, cannot mark deals as stale");
          }
        } catch (dispatchError) {
          console.error("Error dispatching MARK_DEALS_STALE:", dispatchError);
        }

        // Подготовьте объект данных для обновления
        const dealDataToUpdate = {
          // Включите сюда все поля из формы, которые нужно обновить
          title: formData.title,
          description: enhancedDescription,
          // Многоязычные поля
          title_en: formData.title_en || null,
          title_es: formData.title_es || null,
          description_en: descriptionEn || null,
          description_es: descriptionEs || null,
          current_price: Number(formData.currentPrice),
          original_price: formData.originalPrice
            ? Number(formData.originalPrice)
            : null,
          store_id: selectedStoreId,
          category_id: formData.category,
          image_url: mainImageUrl,
          deal_url: formData.dealUrl,
          expires_at: formData.expiryDate
            ? `${formData.expiryDate}T23:59:59.999Z`
            : null,
          is_hot: formData.isHot,

          // --- ЛОГИКА ПУБЛИКАЦИИ ПРИ РЕДАКТИРОВАНИИ ИЗ МОДЕРАЦИИ ---
          // Если autoApprove = true (редактирование из модерации), устанавливаем статус 'approved' и данные модератора
          ...(autoApprove
            ? {
                status: "approved",
                moderator_id: user?.id,
                moderated_at: new Date().toISOString(),
              }
            : {}),
        };

        // Проверяем текущий статус скидки перед обновлением
        const { data: currentDeal, error: currentDealError } = await supabase
          .from("deals")
          .select("status, user_id")
          .eq("id", dealId)
          .single();

        if (currentDealError) {
          console.error(
            "Ошибка при получении текущего статуса скидки:",
            currentDealError,
          );
          throw new Error(currentDealError.message);
        }

        console.log(
          "AddDealPageNew - Текущий статус скидки перед обновлением:",
          currentDeal.status,
        );
        console.log("AddDealPageNew - autoApprove:", autoApprove);

        // Если скидка уже одобрена/опубликована и это не автоматическое одобрение,
        // то всегда изменяем статус на "pending" для повторной модерации
        if (
          (currentDeal.status === "approved" ||
            currentDeal.status === "published") &&
          !autoApprove
        ) {
          console.log(
            "AddDealPageNew - Изменяем статус скидки на pending для повторной модерации",
          );
          dealDataToUpdate.status = "pending";
        }

        // 1. Обновление данных сделки в таблице 'deals' и получение обновленной записи
        const { data: updatedDeal, error: updateError } = await supabase
          .from("deals")
          .update(dealDataToUpdate) // Используйте объект с условным статусом
          .eq("id", dealId)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating deal:", updateError);
          throw new Error("Failed to update deal");
        }

        // Проверяем статус сделки после обновления (для отладки)
        const { data: dealAfterUpdate, error: dealUpdateCheckError } =
          await supabase
            .from("deals")
            .select("id, status")
            .eq("id", dealId)
            .single();

        console.log(
          "AddDealPageNew - Deal status after update:",
          dealAfterUpdate,
          "Error:",
          dealUpdateCheckError,
        );

        // --- ЛОГИКА ОЧЕРЕДИ МОДЕРАЦИИ ---
        if (autoApprove) {
          // Если это обновление из модерации (autoApprove = true), удаляем из очереди модерации
          console.log(
            "Updating deal from moderation, auto-approving and removing from queue",
          );
          const { error: deleteQueueError } = await supabase
            .from("moderation_queue")
            .delete()
            .eq("item_id", dealId)
            .eq("item_type", "deal");

          if (deleteQueueError) {
            console.error(
              "Error removing from moderation queue:",
              deleteQueueError,
            );
          }
        } else if (updatedDeal && updatedDeal.status === "pending") {
          // Если статус в обновленной записи равен 'pending', добавляем в очередь модерации
          console.log(
            "AddDealPageNew - Добавляем скидку в очередь модерации, статус:",
            updatedDeal.status,
          );

          // Используем контекст модерации для добавления в очередь
          if (addToModerationQueue) {
            try {
              await addToModerationQueue(dealId, "deal");
              console.log(
                "AddDealPageNew - Скидка успешно добавлена в очередь модерации",
              );
            } catch (error) {
              console.error(
                "AddDealPageNew - Ошибка при добавлении в очередь модерации:",
                error,
              );
            }
          } else {
            console.error("AddDealPageNew - addToModerationQueue не определен");
          }
        } else {
          console.log(
            "AddDealPageNew - Статус сделки после обновления:",
            updatedDeal?.status,
            "- не требует добавления в очередь модерации",
          );
        }



        // Если редактирование из модерации, перенаправляем обратно на страницу модерации,
        // в противном случае - на страницу деталей
        if (autoApprove) {
          console.log(
            "AddDealPageNew - Redirecting to moderation page after successful auto-approval",
          );
          navigate("/moderation");
          // Показываем уведомление об успешном одобрении
          alert("Сделка успешно отредактирована и одобрена");
        } else {
          console.log("AddDealPageNew - Redirecting to deal detail page");
          navigate(`/deals/${dealId}`);
        }
      } else {
        // Создание новой скидки
        // Добавляем ID пользователя только при создании
        const { data: deal, error: dealError } = await supabase
          .from("deals")
          .insert({
            ...dealData,
            user_id: user?.id,
          })
          .select()
          .single();

        if (dealError) {
          console.error("Error creating deal:", dealError);
          console.error("Deal data that failed:", dealData);
          throw new Error(`Failed to create deal: ${dealError.message || dealError.details || 'Unknown error'}`);
        }

        // Отмечаем все сделки как устаревшие, если есть dispatch
        try {
          if (dispatch) {
            dispatch({ type: "MARK_DEALS_STALE" });
          } else {
            console.warn(
              "dispatch is undefined in create flow, cannot mark deals as stale",
            );
          }
        } catch (dispatchError) {
          console.error(
            "Error dispatching MARK_DEALS_STALE in create flow:",
            dispatchError,
          );
        }



        navigate(`/deals/${deal.id}`);
        // Добавляем новую сделку в очередь модерации
        if (deal && deal.id) {
          console.log("Добавляем сделку в очередь модерации:", deal.id);
          await addToModerationQueue(deal.id, "deal");
        }
      }
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      console.error("Full error object:", JSON.stringify(error, null, 2));
      setError(
        error instanceof Error
          ? error.message
          : `Failed to ${isEditing ? "update" : "create"} deal: ${String(error)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const calculateDiscount = useCallback(() => {
    if (formData.currentPrice && formData.originalPrice) {
      const current = Number(formData.currentPrice);
      const original = Number(formData.originalPrice);
      if (current && original && current <= original) {
        return Math.round(((original - current) / original) * 100);
      }
    }
    return null;
  }, [formData.currentPrice, formData.originalPrice]);

  const handleCategorySelect = (categoryId: string) => {
    setFormData((prev) => ({ ...prev, category: categoryId }));
    setIsCategorySheetOpen(false);
  };

  const handleStoreSelect = (storeId: string | null) => {
    setSelectedStoreId(storeId);
    setIsStoreSheetOpen(false);
  };

  // Упрощенная обработка URL, без автоматического извлечения данных
  const handleUrlInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setFormData((prev) => ({ ...prev, dealUrl: url }));
  };

  // Функция для перевода текста
  const handleTranslate = async () => {
    setTranslateError(null);
    if (!formData.title.trim() || !formData.description.trim()) {
      setTranslateError("Заполните заголовок и описание на русском языке для перевода");
      return;
    }
    setIsTranslating(true);
    try {
      const currentDescription = editor ? editor.getHTML() : formData.description;
      const result = await translateTextOnly(formData.title, currentDescription);
      if (result.success) {
        setFormData(prev => ({
          ...prev,
          title_en: result.translations.title_en,
          title_es: result.translations.title_es,
          description_en: result.translations.description_en,
          description_es: result.translations.description_es,
        }));
        // Сохраняем html/форматирование в редакторах переводов
        if (editorEn) {
          editorEn.commands.setContent(result.translations.description_en);
        }
        if (editorEs) {
          editorEs.commands.setContent(result.translations.description_es);
        }
      } else {
        setTranslateError(result.message || "Ошибка перевода");
      }
    } catch (error) {
      setTranslateError("Ошибка при переводе. Попробуйте еще раз.");
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



  // Автоматически показываем переводы, если они есть
  useEffect(() => {
    if (
      (formData.title_en && formData.title_en.trim() !== "") ||
      (formData.description_en && formData.description_en.trim() !== "") ||
      (formData.title_es && formData.title_es.trim() !== "") ||
      (formData.description_es && formData.description_es.trim() !== "")
    ) {
      setShowTranslations(true);
    }
  }, [formData.title_en, formData.description_en, formData.title_es, formData.description_es]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="web-page-header fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          {customHeaderComponent ? (
            customHeaderComponent
          ) : (
            <div className="flex items-center">
              <button onClick={() => navigate(-1)} className="text-white">
                <ArrowLeft className="h-6 w-6" />
              </button>
              <h1 className="text-white text-lg font-medium ml-4">
                {isEditing ? "Edit Deal" : "Add New Deal"}
              </h1>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-4 pb-24">
        <div className="main-content-area px-4 pt-6">
          {error && (
            <div className="bg-red-500 text-white px-4 py-3 rounded-md mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Title (Russian) *"
                  className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 ${
                    !validationState.title && formData.title !== ""
                      ? "border border-red-500"
                      : !validationState.title
                        ? "border border-yellow-500"
                        : ""
                  }`}
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
                {validationState.title && formData.title && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-green-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
              {!validationState.title && (
                <p className="text-orange-500 text-xs mt-1">
                  Title is required
                </p>
              )}
            </div>

            {/* Price Fields */}
            <div className="flex items-start gap-4">
              <div className="flex-1">
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Current Price *"
                    className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 border transition-all duration-100 text-center
                      ${!validationState.currentPrice && formData.currentPrice !== ""
                        ? "border-yellow-500"
                        : "border-gray-700"
                  }`}
                  value={formData.currentPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, currentPrice: e.target.value })
                  }
                  required
                />
                {validationState.currentPrice && formData.currentPrice && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-green-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
                </div>
                <div style={{ minHeight: !validationState.currentPrice ? 20 : 0 }}>
                {!validationState.currentPrice && (
                  <p className="text-orange-500 text-xs mt-1">
                      Current price is required
                  </p>
                )}
              </div>
              </div>
              <div className="flex-1">
                <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                    placeholder="Original Price (optional)"
                    className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 border border-gray-700 text-center transition-all duration-100"
                  value={formData.originalPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, originalPrice: e.target.value })
                  }
                />
                </div>
                <div style={{ minHeight: !validationState.originalPrice && formData.originalPrice ? 20 : 0 }}>
                  {!validationState.originalPrice && formData.originalPrice && (
                    <p className="text-orange-500 text-xs mt-1">
                      Original price must be a number
                    </p>
                  )}
                </div>
              </div>
            </div>
            {/* Discount percent display */}
            {calculateDiscount() !== null && calculateDiscount() > 0 && (
              <div className="mt-0.5 mb-1 text-green-500 font-semibold text-sm leading-tight">
                -{calculateDiscount()}%
              </div>
            )}

            <div className="relative">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={`formatting-button p-2 rounded ${editor?.isActive("bold") ? "bg-gray-700 text-white active" : "text-gray-400 hover:text-white"}`}
                >
                  <Bold className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={`formatting-button p-2 rounded ${editor?.isActive("italic") ? "bg-gray-700 text-white active" : "text-gray-400 hover:text-white"}`}
                >
                  <Italic className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    editor?.chain().focus().toggleUnderline().run()
                  }
                  className={`formatting-button p-2 rounded ${editor?.isActive("underline") ? "bg-gray-700 text-white active" : "text-gray-400 hover:text-white"}`}
                >
                  <UnderlineIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    editor?.chain().focus().toggleBulletList().run()
                  }
                  className={`formatting-button p-2 rounded ${editor?.isActive("bulletList") ? "bg-gray-700 text-white active" : "text-gray-400 hover:text-white"}`}
                >
                  <List className="h-5 w-5" />
                </button>
              </div>
              <div
                className={`bg-gray-800 rounded-lg p-4 min-h-[200px] ${
                  !validationState.description ? "border border-yellow-500" : ""
                }`}
              >
                {!editor?.getText() && (
                  <div className="absolute text-gray-500 pointer-events-none p-1">
                    Description (Russian) *
                  </div>
                )}
                <EditorContent editor={editor} />
              </div>
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

            {/* Translation Fields */}
            {showTranslations && (
              <div className="space-y-4 mt-4">
                <div>
                  <input
                    type="text"
                    placeholder="Title (English)"
                    className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                    value={formData.title_en}
                    onChange={(e) =>
                      setFormData({ ...formData, title_en: e.target.value })
                    }
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Title (Spanish)"
                    className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                    value={formData.title_es}
                    onChange={(e) =>
                      setFormData({ ...formData, title_es: e.target.value })
                    }
                  />
                </div>
                <div>
                  <div className="relative">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => editorEn?.chain().focus().toggleBold().run()}
                        className={`formatting-button p-2 rounded ${editorEn?.isActive("bold") ? "bg-gray-700 text-white active" : "text-gray-400 hover:text-white"}`}
                      >
                        <Bold className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => editorEn?.chain().focus().toggleItalic().run()}
                        className={`formatting-button p-2 rounded ${editorEn?.isActive("italic") ? "bg-gray-700 text-white active" : "text-gray-400 hover:text-white"}`}
                      >
                        <Italic className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => editorEn?.chain().focus().toggleUnderline().run()}
                        className={`formatting-button p-2 rounded ${editorEn?.isActive("underline") ? "bg-gray-700 text-white active" : "text-gray-400 hover:text-white"}`}
                      >
                        <UnderlineIcon className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => editorEn?.chain().focus().toggleBulletList().run()}
                        className={`formatting-button p-2 rounded ${editorEn?.isActive("bulletList") ? "bg-gray-700 text-white active" : "text-gray-400 hover:text-white"}`}
                      >
                        <List className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 min-h-[100px]">
                      {!editorEn?.getText() && (
                        <div className="absolute text-gray-500 pointer-events-none p-1">
                          Description (English)
                        </div>
                      )}
                      <EditorContent editor={editorEn} />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="relative">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => editorEs?.chain().focus().toggleBold().run()}
                        className={`formatting-button p-2 rounded ${editorEs?.isActive("bold") ? "bg-gray-700 text-white active" : "text-gray-400 hover:text-white"}`}
                      >
                        <Bold className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => editorEs?.chain().focus().toggleItalic().run()}
                        className={`formatting-button p-2 rounded ${editorEs?.isActive("italic") ? "bg-gray-700 text-white active" : "text-gray-400 hover:text-white"}`}
                      >
                        <Italic className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => editorEs?.chain().focus().toggleUnderline().run()}
                        className={`formatting-button p-2 rounded ${editorEs?.isActive("underline") ? "bg-gray-700 text-white active" : "text-gray-400 hover:text-white"}`}
                      >
                        <UnderlineIcon className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => editorEs?.chain().focus().toggleBulletList().run()}
                        className={`formatting-button p-2 rounded ${editorEs?.isActive("bulletList") ? "bg-gray-700 text-white active" : "text-gray-400 hover:text-white"}`}
                      >
                        <List className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 min-h-[100px]">
                      {!editorEs?.getText() && (
                        <div className="absolute text-gray-500 pointer-events-none p-1">
                          Description (Spanish)
                        </div>
                      )}
                      <EditorContent editor={editorEs} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCategorySheetOpen(true)}
                  className={`w-full bg-gray-800 text-white rounded-md px-4 py-3 flex items-center justify-between ${
                    formData.category ? "text-white" : "text-gray-500"
                  } ${
                    !validationState.category ? "border border-yellow-500" : ""
                  }`}
                >
                  <span>
                    {formData.category
                      ? language === "ru"
                        ? categories.find((cat) => cat.id === formData.category)
                            ?.name
                        : t(formData.category)
                      : "Select Category *"}
                  </span>
                  <div className="flex items-center">
                    {validationState.category && formData.category && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-green-500 mr-2"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    )}
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  </div>
                </button>
              </div>
              {!validationState.category && (
                <p className="text-orange-500 text-xs mt-1">
                  Category selection is required
                  </p>
                )}
            </div>

            {/* Deal Images */}
            <div>
              <label className="block text-gray-400 mb-2">
                Deal Images * ({dealImages.length}/4)
              </label>

              <div
                onDragOver={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragActive(true);
                }}
                onDragEnter={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragActive(true);
                }}
                onDragLeave={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragActive(false);
                }}
                onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    // Ограничиваем до 4-х файлов
                    const files = Array.from(e.dataTransfer.files).slice(0, 4 - dealImages.length);
                    if (files.length > 0) {
                      // Преобразуем обратно в FileList-подобный объект
                      const dt = new DataTransfer();
                      files.forEach(f => dt.items.add(f));
                      handleDealImageUpload(dt.files);
                    }
                  }
                }}
                className={
                  dealImages.length === 0
                    ? `border-2 border-dashed rounded-lg p-4 text-center ` +
                      (isUploadingImage
                        ? "border-orange-500 bg-orange-500/10"
                        : !validationState.dealImages
                          ? "border-yellow-500"
                          : isDragActive
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-gray-700")
                    : undefined
                }
                style={{ position: dealImages.length === 0 ? "relative" : undefined, transition: "border-color 0.2s, background 0.2s" }}
              >
                {dealImages.length > 0 && (
                  <div className="mb-4">
                    {/* Отображение главного изображения */}
                    <div className="relative h-48 bg-gray-800 rounded-lg overflow-hidden main-image-container">
                      <img
                        key={dealImages[0]?.id}
                        src={dealImages[0]?.publicUrl}
                        alt="Main deal image"
                        className="w-full h-full object-contain main-image"
                      />

                      {dealImages.length > 1 && (
                        <div className="absolute bottom-2 left-2 bg-green-500/80 text-white font-semibold text-xs px-2 py-1 rounded-md">
                          Главное изображение
                        </div>
                      )}

                      <div className="absolute top-2 right-2 bg-gray-900/70 text-white font-medium text-xs px-2 py-1 rounded-md">
                        {`${dealImages.length}/4 изображений`}
                      </div>
                    </div>

                    {/* Миниатюры с улучшенным интерфейсом управления порядком */}
                    {dealImages.length > 1 && (
                      <div className="mt-4">
                        <div className="text-gray-400 text-sm mb-2">
                          Измените порядок изображений (первое — главное):
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          {dealImages.map((image, index) => (
                            <div
                              key={image.id}
                              className={`relative rounded-lg overflow-hidden border-2 ${
                                index === 0
                                  ? "border-green-500 ring-2 ring-green-500"
                                  : "border-gray-700"
                              }`}
                            >
                              {/* Кнопка удаления в правом верхнем углу */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveImage(image.id);
                                }}
                                className="absolute top-0 right-0 z-20 bg-red-500 hover:bg-red-600 text-white rounded-bl-md p-1"
                                aria-label="Remove image"
                                style={{ fontSize: 0 }}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <line x1="18" y1="6" x2="6" y2="18"></line>
                                  <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                              </button>
                              <img
                                src={image.publicUrl}
                                alt={`Изображение ${index + 1}`}
                                className="w-full h-16 object-cover"
                              />

                              {/* Метка позиции */}
                              <div className="absolute top-0 left-0 bg-black bg-opacity-70 text-white text-xs font-bold px-1.5 py-0.5 rounded-br-md">
                                {index + 1}
                              </div>

                              {/* Кнопки перемещения */}
                              <div className="absolute bottom-0 left-0 right-0 flex justify-between bg-black bg-opacity-80 p-1">
                                {/* Кнопка влево */}
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (index > 0) {
                                      const newImages = [...dealImages];
                                      [newImages[index - 1], newImages[index]] = [
                                        newImages[index],
                                        newImages[index - 1],
                                      ];
                                      setDealImages(newImages);
                                    }
                                  }}
                                  className={`text-white rounded-full p-1 ${
                                    index === 0
                                      ? "opacity-30"
                                      : "bg-gray-700 hover:bg-gray-600"
                                  }`}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000svg"
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M15 18l-6-6 6-6" />
                                  </svg>
                                </button>

                                {/* Кнопка вправо */}
                                <button
                                  type="button"
                                  disabled={index === dealImages.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (index < dealImages.length - 1) {
                                      const newImages = [...dealImages];
                                      [newImages[index], newImages[index + 1]] = [
                                        newImages[index + 1],
                                        newImages[index],
                                      ];
                                      setDealImages(newImages);
                                    }
                                  }}
                                  className={`text-white rounded-full p-1 ${
                                    index === dealImages.length - 1
                                      ? "opacity-30"
                                      : "bg-gray-700 hover:bg-gray-600"
                                  }`}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M9 18l6-6-6-6" />
                                  </svg>
                                </button>
                              </div>

                              {/* Индикатор главного изображения */}
                              {index === 0 && (
                                <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-bl-md font-bold">
                                  Главное
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Кнопки для быстрой установки главного изображения удалены */}
                      </div>
                    )}

                    {/* Подсказка удалена */}
                  </div>
                )}

                {dealImages.length < 4 && (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleDealImageUpload(e.target.files)}
                      className="hidden"
                      id="deal-images-upload"
                      multiple={dealImages.length < 3}
                    />
                    <label
                      htmlFor="deal-images-upload"
                      className={`block w-full bg-gray-800 text-white rounded-md px-4 py-3 cursor-pointer hover:bg-gray-700 text-center ${
                        !validationState.dealImages
                          ? "border border-yellow-500"
                          : ""
                      }`}
                      style={{ minHeight: 120 }}
                    >
                      {isUploadingImage ? (
                        <div className="flex items-center justify-center">
                          <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Uploading...
                        </div>
                      ) : (
                        <>
                          <Plus className="h-5 w-5 inline-block mr-2" />
                          {dealImages.length === 0
                            ? isDragActive
                              ? "Отпустите файлы для загрузки"
                              : "Add Images * (или перетащите)"
                            : isDragActive
                              ? "Отпустите файлы для загрузки"
                              : "Add More Images (или перетащите)"}
                        </>
                      )}
                    </label>
                  </>
                )}
                {!validationState.dealImages && dealImages.length === 0 && (
                  <p className="text-orange-500 text-xs mt-1">
                    At least one image is required
                  </p>
                )}
                {isDragActive && dealImages.length === 0 && (
                  <div style={{position: "absolute", inset: 0, borderRadius: 8, border: "2px solid #3b82f6", background: "rgba(59,130,246,0.08)", pointerEvents: "none"}} />
                )}
              </div>
            </div>

            <div>
              <input
                type="url"
                placeholder="Deal URL *"
                className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 ${
                  !validationState.dealUrl && formData.dealUrl !== ""
                    ? "border border-red-500"
                    : !validationState.dealUrl
                      ? "border border-yellow-500"
                      : ""
                }`}
                value={formData.dealUrl}
                onChange={handleUrlInput}
                required
              />
              {!validationState.dealUrl && formData.dealUrl ? (
                <p className="text-red-500 text-xs mt-1">
                  Please enter a valid URL (e.g. example.com or
                  https://example.com)
                </p>
              ) : !validationState.dealUrl ? (
                <p className="text-orange-500 text-xs mt-1">
                  Deal URL is required
                </p>
              ) : (
                <div className="flex justify-between items-center mt-1">
                  <p className="text-gray-500 text-sm">
                    Add a link where users can find and purchase this deal
                  </p>
                  {validationState.dealUrl && formData.dealUrl && (
                    <div className="text-green-500 flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="relative">
                <input
                  type="date"
                  className="w-full bg-gray-800 text-white rounded-md px-4 py-3"
                  value={formData.expiryDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => {
                    const selectedDate = new Date(e.target.value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (selectedDate < today) {
                      setError("Expiry date cannot be earlier than today");
                      return;
                    }
                    setError(null);
                    setFormData({ ...formData, expiryDate: e.target.value });
                  }}
                />
                {formData.expiryDate && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, expiryDate: "" })}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              <p className="text-gray-500 text-sm mt-1">
                {labelOverrides.expiryDate || "Expired date"} (optional)
              </p>
            </div>

            {/* Проверка на роль пользователя для отображения HOT кнопки */}
            {!isUploadingImage &&
              (allowHotToggle === undefined ? canMarkHot : allowHotToggle) && (
                <div className="mt-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isHot"
                      checked={formData.isHot}
                      onChange={(e) =>
                        setFormData({ ...formData, isHot: e.target.checked })
                      }
                      className="form-checkbox h-5 w-5 text-orange-500"
                    />
                    <label htmlFor="isHot" className="text-white">
                      Mark as HOT
                    </label>
                  </div>
                </div>
              )}

            <div className="bg-gray-800 rounded-md p-4">
              <h3 className="text-white font-medium mb-2">Preview</h3>
              <pre
                className="bg-gray-900 rounded-md p-4 whitespace-pre-wrap font-sans text-sm description-preview"
                dangerouslySetInnerHTML={{
                  __html: formData.description
                    .replace(/(https?:\/\/[^\s<>"]+)/g, (match) => {
                      const lastChar = match.charAt(match.length - 1);
                      if (
                        [",", ".", ":", ";", "!", "?", ")", "]", "}"].includes(
                          lastChar,
                        )
                      ) {
                        return `<a href="${match.slice(0, -1)}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline">${match.slice(0, -1)}</a>${lastChar}`;
                      }
                      return `<a href="${match}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline">${match}</a>`;
                    })
                    .replace(/\n\n/g, "<br><br>")
                    .replace(/\n/g, "<br>")
                    .replace(/class="[^"]+"/g, "")
                    .replace(/class='[^']+'/g, ""),
                }}
              />
              <button
                type="submit" // Важно для отправки формы
                disabled={loading || !isValid}
                onClick={handleSubmit} // Можно оставить, как в AddSweepstakesPage, хотя form onSubmit тоже сработает
                className={`w-full mt-4 py-3 rounded-md font-medium flex items-center justify-center ${
                  isValid
                    ? "bg-orange-500 text-white hover:bg-orange-600" // Добавлено состояние hover для консистентности
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : isEditing ? (
                  "Update Deal" // Динамический текст для режима редактирования
                ) : (
                  "Post Deal" // Динамический текст для режима создания
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <CategorySimpleBottomSheet
        isOpen={isCategorySheetOpen}
        onClose={() => setIsCategorySheetOpen(false)}
        onCategorySelect={handleCategorySelect}
      />

      <StoreBottomSheet
        isOpen={isStoreSheetOpen}
        selectedStore={selectedStoreId}
        onStoreSelect={handleStoreSelect}
        onClose={() => setIsStoreSheetOpen(false)}
      />

      <style>
        {`
          .formatting-button {
            padding: 8px !important;
            margin: 0 2px !important;
            min-width: 40px !important;
            height: 40px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .formatting-button svg {
            width: 20px !important;
            height: 20px !important;
          }

          .formatting-button.active {
            background-color: #4B5563 !important;
            transform: scale(1.05);
          }

          .description-preview {
            white-space: pre-wrap;
          }

          .description-preview p {
            margin-bottom: 0.75rem;
          }

          .description-preview a {
            color: #f97316;
            text-decoration: underline;
          }

          /* Анимация смены главного изображения */
          .main-image-container {
            position: relative;
            overflow: hidden;
          }

          .main-image {
            transition: opacity 0.3s ease, transform 0.3s ease;
          }

          .main-image-container img {
            animation: fadeIn 0.4s ease-out;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }

          /* Стили для мобильных устройств */
          @media (max-width: 640px) {
            .image-controls button {
              padding: 8px;
              min-width: 30px;
              height: 30px;
            }

            .image-controls button svg {
              width: 16px;
              height: 16px;
            }
          }
        `}
      </style>
    </div>
  );
};

export default AddDealPageNew;
