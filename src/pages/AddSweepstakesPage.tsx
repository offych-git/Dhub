import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  Info,
  X,
  Upload,
  RefreshCcw,
} from "lucide-react";
import imageCompression from "browser-image-compression";
import { stores } from "../data/mockData";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useAuth } from "../contexts/AuthContext";
import { useAdmin } from "../hooks/useAdmin";
import { useLanguage } from "../contexts/LanguageContext";
import { supabase } from "../lib/supabase";
import StoreBottomSheet from "../components/deals/StoreBottomSheet";
import { useModeration } from "../contexts/ModerationContext";
import { translateTextOnly } from "../utils/autoTranslate";

interface AddSweepstakesPageProps {
  isEditing?: boolean;
  sweepstakesId?: string;
  initialData?: any;
  allowHotToggle?: boolean;
  labelOverrides?: { submitButton?: string; pageTitle?: string };
  onEditSuccess?: (id: string) => Promise<void>;
}

const AddSweepstakesPage: React.FC<AddSweepstakesPageProps> = ({
  isEditing = false,
  sweepstakesId,
  initialData,
  allowHotToggle,
  labelOverrides,
  onEditSuccess,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useAdmin();
  const { t, language } = useLanguage();
  const canMarkHot = role === "admin" || role === "moderator";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const selectedStoreName =
    stores.find((store) => store.id === selectedStoreId)?.name || "";
  const [isStoreSheetOpen, setIsStoreSheetOpen] = useState(false);
  const [sweepstakesImage, setSweepstakesImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(
    initialData?.image || null,
  );
  const { addToModerationQueue } = useModeration();
  const [isDragActive, setIsDragActive] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  // Helper to determine the correct localStorage key
  const getDraftKey = useCallback(() => {
    return isEditing && sweepstakesId ? `sweepstakesDraft_${sweepstakesId}` : "sweepstakesDraftNew";
  }, [isEditing, sweepstakesId]);

  useEffect(() => {
    const pageTitle = "Add Sweepstakes";

    console.log(
      `[Add Sweepstakes Web] INFO: useEffect для отправки заголовка "${pageTitle}" запущен (с небольшой задержкой).`,
    );

    const timerId = setTimeout(() => {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        console.log(
          `[Add Sweepstakes Web] INFO: Отправляю заголовок "${pageTitle}" в React Native после задержки.`,
        );
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "SET_NATIVE_HEADER_TITLE",
            title: pageTitle,
          }),
        );
      } else {
        console.warn(
          `[Add Sweepstakes Web] WARN: ReactNativeWebView.postMessage НЕ ДОСТУПЕН (после задержки). Возможно, страница открыта не в WebView React Native.`,
        );
      }
    }, 50);

    return () => clearTimeout(timerId);
  }, []);

  // Состояние для данных формы
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    description: initialData?.description || "",
    dealUrl: initialData?.dealUrl || "",
    expiryDate: initialData?.expiryDate
      ? initialData.expiryDate.split("T")[0]
      : "",
    // Многоязычные поля
    title_en: initialData?.title_en || "",
    title_es: initialData?.title_es || "",
    description_en: initialData?.description_en || "",
    description_es: initialData?.description_es || "",
  });

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
    ],
    // Загружаем контент: сначала черновик из localStorage, затем initialData, иначе пустая строка
    content: initialData?.description || "", // Initial content will be set in the useEffect below
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

      // Сохраняем черновик в localStorage
      const draftKey = getDraftKey();
      try {
        const currentDraft = JSON.parse(localStorage.getItem(draftKey) || '{}');
        localStorage.setItem(draftKey, JSON.stringify({...currentDraft, description: html}));
      } catch (e) {
        console.error("Error saving description draft to localStorage:", e);
      }

      checkImagesInEditor();
    },
  });

  // Отладочная информация при инициализации компонента
  useEffect(() => {
    console.log("📋 AddSweepstakesPage инициализирована");
    console.log("📋 Режим редактирования:", isEditing);
    console.log("📋 ID редактируемого розыгрыша:", sweepstakesId);
    console.log("📋 Начальные данные:", initialData);
  }, [isEditing, sweepstakesId, initialData]);

  // Отслеживаем состояние валидации каждого поля отдельно
  const [validationState, setValidationState] = useState({
    title: true,
    description: true,
    image: true,
    dealUrl: true,
    expiryDate: true,
  });

  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log(
      "AddSweepstakesPage - isStoreSheetOpen state changed:",
      isStoreSheetOpen,
    );
  }, [isStoreSheetOpen]);

  // Image compression function
  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.2, // 200KB
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

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;

    try {
      setIsUploadingImage(true);
      const file = files[0]; // Take only the first file

      if (!file.type.startsWith("image/")) {
        throw new Error("Please select only image files");
      }

      const compressedImage = await compressImage(file);
      setSweepstakesImage(compressedImage);
      const newImageUrl = URL.createObjectURL(compressedImage);
      setImageUrl(newImageUrl);

      // Save image URL to draft
      const draftKey = getDraftKey();
      try {
        const currentDraft = JSON.parse(localStorage.getItem(draftKey) || '{}');
        localStorage.setItem(draftKey, JSON.stringify({...currentDraft, image: newImageUrl}));
      } catch (e) {
        console.error("Error saving image URL draft to localStorage:", e);
      }

    } catch (error) {
      console.error("Error uploading image:", error);
      setError(
        error instanceof Error ? error.message : "Failed to upload image",
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  const validateForm = () => {
    // Эта функция validateForm больше не используется для установки isValid,
    // но ее можно использовать для вывода ошибок перед отправкой, если нужно
    if (!formData.title.trim()) {
      setError("Title is required");
      return false;
    }

    if (!formData.description.trim()) {
      setError("Description is required");
      return false;
    }

    if (!sweepstakesImage && !imageUrl) {
      setError("Please upload an image");
      return false;
    }

    if (!formData.dealUrl) {
      setError("Deal URL is required");
      return false;
    }

    const urlRegex =
      /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i; // Corrected regex for JavaScript
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

  // Отслеживание изменений формы для валидации
  useEffect(() => {
    const titleValid = formData.title.trim() !== "";
    const descriptionValid = formData.description.trim() !== "";
    const imageValid = sweepstakesImage !== null || imageUrl !== null;
    const urlValid =
      /^(https?:\/\/)?[da-z.-]+\.[a-z.]{2,6}([\/\w .-]*)*\/?$/.test( // Corrected regex for JavaScript
        formData.dealUrl,
      );

    let expiryDateValid = true;
    if (formData.expiryDate) {
      const selectedDate = new Date(formData.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expiryDateValid = selectedDate >= today;
    }

    setValidationState({
      title: titleValid,
      description: descriptionValid,
      image: imageValid,
      dealUrl: urlValid,
      expiryDate: expiryDateValid,
    });

    const isFormValid =
      titleValid &&
      descriptionValid &&
      imageValid &&
      urlValid &&
      expiryDateValid;

    setIsValid(isFormValid);
    console.log("Form validation:", {
      titleValid,
      descriptionValid,
      imageValid,
      urlValid,
      expiryDateValid,
      isFormValid,
    });
  }, [formData, sweepstakesImage, imageUrl]);

  // Инициализация формы и редактора: загружаем черновик или initialData
  useEffect(() => {
    const draftKey = getDraftKey();
    const storedDraft = localStorage.getItem(draftKey);
    let loadedData = initialData;

    if (storedDraft) {
      try {
        const parsedDraft = JSON.parse(storedDraft);
        loadedData = parsedDraft;
        console.log("Loaded draft:", parsedDraft);
      } catch (e) {
        console.error("Failed to parse draft from localStorage, using initialData:", e);
        localStorage.removeItem(draftKey); // Clear corrupted draft
      }
    }

    setFormData({
      title: loadedData?.title || "",
      description: loadedData?.description || "",
      dealUrl: loadedData?.dealUrl || "",
      expiryDate: loadedData?.expiryDate || "",
      // Многоязычные поля
      title_en: loadedData?.title_en || "",
      title_es: loadedData?.title_es || "",
      description_en: loadedData?.description_en || "",
      description_es: loadedData?.description_es || "",
    });
    setImageUrl(loadedData?.image || null);

    if (editor && loadedData?.description !== undefined) {
      editor.commands.setContent(loadedData.description || "");
    }
  }, [editor, initialData, getDraftKey]); // Added getDraftKey to dependencies

  // Сохраняем поля формы в localStorage при их изменении (для черновика)
  useEffect(() => {
    const draftKey = getDraftKey();
    try {
      // Get existing draft data, or an empty object
      const currentDraft = JSON.parse(localStorage.getItem(draftKey) || '{}');

      // Update specific fields. Only update fields that have changed
      const newDraftState = {
        ...currentDraft,
        title: formData.title,
        description: formData.description, // Tiptap's onUpdate already handles this, but good to be consistent
        dealUrl: formData.dealUrl,
        expiryDate: formData.expiryDate,
        image: imageUrl, // Save current imageUrl
      };
      localStorage.setItem(draftKey, JSON.stringify(newDraftState));
    } catch (e) {
      console.error("Error saving form data draft to localStorage:", e);
    }
  }, [formData.title, formData.dealUrl, formData.expiryDate, imageUrl, getDraftKey, formData.description]); // Added formData.description to dependencies

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null); // Сбрасываем ошибку перед новой попыткой отправки

    // Дополнительная проверка валидации перед отправкой
    if (!isValid) {
      setError("Please fill in all required fields correctly.");
      setLoading(false);
      return;
    }

    // Проверка аутентификации пользователя
    if (!user || !user.id) {
      console.error("User not authenticated or user ID is missing.");
      setError("Для создания розыгрыша необходимо войти в систему.");
      setLoading(false);
      return;
    }

    try {
      let uploadedImageUrl = "";

      // Upload image if available and new
      if (sweepstakesImage) {
        const fileExt = sweepstakesImage.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/sweepstakes-images/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("deal-images")
          .upload(filePath, sweepstakesImage);

        if (uploadError) {
          throw new Error(`Error uploading image: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from("deal-images")
          .getPublicUrl(filePath);

        uploadedImageUrl = urlData.publicUrl;
      }

      // Получаем оригинального создателя розыгрыша при редактировании
      let originalUserId = user.id;

      if (isEditing && sweepstakesId) {
        console.log(
          "Получаем данные оригинального розыгрыша для сохранения создателя",
        );
        try {
          const { data: existingData, error: fetchError } = await supabase
            .from("deals")
            .select("user_id")
            .eq("id", sweepstakesId)
            .single();

          if (!fetchError && existingData && existingData.user_id) {
            originalUserId = existingData.user_id; // Corrected: existingData.user_id not existingData.user.id
            console.log("Оригинальный создатель розыгрыша:", originalUserId);
          } else {
            console.warn(
              "Не удалось получить оригинального создателя, используем текущего пользователя:",
              user.id,
            );
          }
        } catch (err) {
          console.error("Ошибка при получении данных о создателе:", err);
        }
      }

      // Prepare sweepstakes data
      const sweepstakesData = {
        title: formData.title,
        description: formData.description,
        // Многоязычные поля
        title_en: formData.title_en || null,
        title_es: formData.title_es || null,
        description_en: formData.description_en || null,
        description_es: formData.description_es || null,
        current_price: 0,
        original_price: null,
        store_id: selectedStoreId || null,
        category_id: 1,
        subcategories: [],
        image_url: sweepstakesImage
          ? uploadedImageUrl
          : imageUrl, // Используем новое изображение или существующий URL
        deal_url: formData.dealUrl,
        user_id: originalUserId,
        expires_at: formData.expiryDate || null,
        is_hot: allowHotToggle ? (formData as any).isHot : false, // Assuming formData.isHot exists, cast to any for now
        type: "sweepstakes",
        status: "pending",
      };

      console.log("Отправляемые данные розыгрыша:", {
        ...sweepstakesData,
        userId: user.id,
        originalUserId,
      });

      let data, error;

      if (isEditing && sweepstakesId) {
        const { data: currentSweepstake, error: currentSweepstakeError } = await supabase
          .from("deals")
          .select("status")
          .eq("id", sweepstakesId)
          .eq("type", "sweepstakes")
          .single();

        if (currentSweepstakeError) {
          throw new Error(currentSweepstakeError.message);
        }

        if (currentSweepstake.status === "approved" && !allowHotToggle) {
          sweepstakesData.status = "pending";
        }

        console.log("Обновление существующего розыгрыша:", sweepstakesId);
        const { data: updatedData, error: updateError } = await supabase
          .from("deals")
          .update(sweepstakesData)
          .eq("id", sweepstakesId)
          .select()
          .single();

        data = updatedData;
        error = updateError;

        if (error) {
          console.error("Детали ошибки обновления:", error);
          throw new Error(`Failed to update sweepstakes: ${error.message}`);
        }

        console.log("Розыгрыш успешно обновлен:", data);

        // Очищаем черновик из localStorage после успешного обновления в режиме редактирования
        localStorage.removeItem(getDraftKey());
      } else {
        console.log("Создание нового розыгрыша...");
        const { data: newData, error: insertError } = await supabase
          .from("deals")
          .insert(sweepstakesData)
          .select()
          .single();

        data = newData;
        error = insertError;

        if (error) {
          console.error("Детали ошибки создания:", error);
          throw new Error(`Failed to create sweepstakes: ${error.message}`);
        }

        console.log("Розыгрыш успешно создан:", data);

        // Очищаем черновик из localStorage после успешного создания
        localStorage.removeItem(getDraftKey());
      }

      if (!data || !data.id) {
        console.error(
          "Получены некорректные данные после операции с розыгрышем:",
          data,
        );
        throw new Error(
          "Получены некорректные данные после операции с розыгрышем",
        );
      }

      if (
        (!isEditing || (isEditing && sweepstakesData.status === "pending")) &&
        addToModerationQueue
      ) {
        try {
          console.log("Добавление розыгрыша в очередь модерации");
          const moderationResult = await addToModerationQueue(
            data.id,
            "sweepstake",
          );
          console.log("Розыгрыш отправлен на модерацию:", moderationResult);
        } catch (moderationError) {
          console.error(
            "Ошибка при добавлении в очередь модерации:",
            moderationError,
          );
        }
      }

      if (isEditing && typeof onEditSuccess === "function" && data.id) {
        console.log(
          "Вызываем onEditSuccess после успешного редактирования розыгрыша",
        );
        try {
          await onEditSuccess(data.id);
        } catch (e) {
          console.error("Ошибка при вызове onEditSuccess:", e);
        }
      }

      navigate(`/sweepstakes/${data.id}`);
    } catch (error) {
      console.error("Error in handleSubmit:", error);

      if (error instanceof Error) {
        console.error("Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      }

      let errorMessage = "Failed to create/update sweepstakes";

      if (error instanceof Error) {
        if (error.message.includes("actor_id")) {
          errorMessage =
            "Не удалось создать розыгрыш: проблема с идентификацией пользователя. Пожалуйста, выйдите и войдите снова в систему.";
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const calculateDiscount = useCallback(() => {
    // Эта функция не используется для sweepstakes, но оставлена как заглушка
    if ((formData as any).currentPrice && (formData as any).originalPrice) {
      const current = Number((formData as any).currentPrice);
      const original = Number((formData as any).originalPrice);
      if (current && original && current <= original) {
        return Math.round(((original - current) / original) * 100);
      }
    }
    return null;
  }, [/*(formData as any).currentPrice, (formData as any).originalPrice*/]); // Убраны зависимости, так как этих полей нет

  useEffect(() => {
    if (editor) {
      console.log(
        "Editor initialized with extensions:",
        editor.extensionManager.extensions,
      );
    }
  }, [editor]);

  useEffect(() => {
    if (editor) {
      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const imageNode = target.closest('img[alt^="img-"]');
        if (imageNode) {
          const imageId = imageNode.getAttribute("alt");
          if (imageId) {
            setSelectedImageId(imageId);
          }
        } else {
          setSelectedImageId(null);
        }
      };

      editor.view.dom.addEventListener("click", handleClick);
      return () => {
        editor.view.dom.removeEventListener("click", handleClick);
      };
    }
  }, [editor]);

  useEffect(() => {
    if (editor && editor.view.dom) {
      const editorDom = editor.view.dom;

      const observer = new MutationObserver((mutations) => {
        let needsCheck = false;

        mutations.forEach((mutation) => {
          if (
            mutation.type === "childList" &&
            mutation.removedNodes.length > 0
          ) {
            Array.from(mutation.removedNodes).forEach((node) => {
              if (node instanceof HTMLElement) {
                if (
                  node.classList?.contains("image-wrapper") ||
                  node.tagName === "IMG" ||
                  node.querySelector("img")
                ) {
                  needsCheck = true;
                }
              }
            });
          }
        });

        if (needsCheck) {
          setTimeout(checkImagesInEditor, 0);
        }
      });

      observer.observe(editorDom, {
        childList: true,
        subtree: true,
        characterData: false,
        attributes: false,
      });

      return () => {
        observer.disconnect();
      };
    }
  }, [editor]);

  const handleStoreSelect = (storeId: string | null) => {
    setSelectedStoreId(storeId);
    setIsStoreSheetOpen(false);
  };

  // Функция для перевода текста
  const handleTranslate = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      alert("Заполните заголовок и описание на русском языке для перевода");
      return;
    }

    setIsTranslating(true);
    try {
      const currentDescription = editor ? editor.getHTML() : formData.description;
      
      const result = await translateTextOnly(formData.title, currentDescription);
      
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

  useEffect(() => {
    console.log("AddSweepstakesPage - StoreBottomSheet props:", {
      isOpen: isStoreSheetOpen,
      selectedStore: selectedStoreId,
      onStoreSelect: handleStoreSelect,
    });
  }, [isStoreSheetOpen, selectedStoreId]);

  const checkImagesInEditor = () => {
    if (!editor) return;
    console.log("Editor content checked");
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
      <div className="web-page-header fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white text-lg font-medium ml-4">
              {labelOverrides?.pageTitle || "Add Sweepstakes"}
            </h1>
          </div>
          <button className="text-white">
            <Info className="h-6 w-6" />
          </button>
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
                  className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 ${!validationState.title && formData.title !== "" ? "border border-red-500" : !validationState.title ? "border border-yellow-500" : ""}`}
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

            <div className="relative" ref={editorRef}>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                <div className="flex flex-wrap items-center gap-1">
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

                <div className="ml-auto">
                  {selectedImageId && (
                    <button
                      type="button"
                      className="delete-image-button flex items-center justify-center px-2 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200"
                      onClick={() => {
                        setSelectedImageId(null);
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      </svg>
                    </button>
                  )}
                </div>
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
              {!validationState.description && (
                <p className="text-orange-500 text-xs mt-1">
                  Description is required
                </p>
              )}
              {validationState.description && formData.description && (
                <div className="text-green-500 text-xs font-medium mt-1 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Description looks good!
                </div>
              )}
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

            <div className="mb-4">
              <label className="block text-gray-400 mb-2">Image *</label>
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
                    handleImageUpload(e.dataTransfer.files);
                  }
                }}
                className={
                  (imageUrl
                    ? ""
                    :
                      `border-2 border-dashed rounded-lg p-4 text-center ` +
                      (isUploadingImage
                        ? "border-orange-500 bg-orange-500/10"
                        : !validationState.image
                          ? "border-yellow-500"
                          : isDragActive
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-gray-700"))
                }
                style={{ position: imageUrl ? undefined : "relative", transition: "border-color 0.2s, background 0.2s" }}
              >
                {imageUrl ? (
                  <div className="relative">
                    <img
                      src={imageUrl}
                      alt="Sweepstakes image"
                      className="w-full h-48 object-contain rounded-lg bg-gray-800 mb-2"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSweepstakesImage(null);
                        setImageUrl(null);
                        // Clear image from draft as well
                        const draftKey = getDraftKey();
                        try {
                          const currentDraft = JSON.parse(localStorage.getItem(draftKey) || '{}');
                          delete currentDraft.image; // Remove image property
                          localStorage.setItem(draftKey, JSON.stringify(currentDraft));
                        } catch (e) {
                          console.error("Error clearing image draft from localStorage:", e);
                        }
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {validationState.image && (
                      <div className="absolute top-2 left-2 bg-green-500/80 text-white font-semibold text-xs px-2 py-1 rounded-md">
                        Изображение загружено
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      id="sweepstakes-image"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files)}
                    />
                    <label
                      htmlFor="sweepstakes-image"
                      className="flex flex-col items-center justify-center cursor-pointer"
                      style={{ minHeight: 120 }}
                    >
                      <Upload className="h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-gray-400">
                        {isUploadingImage
                          ? "Uploading..."
                          : isDragActive
                            ? "Отпустите файл для загрузки"
                            : "Click or drag image here to upload"}
                      </p>
                    </label>
                  </>
                )}
                {!validationState.image && !imageUrl && (
                  <p className="text-orange-500 text-xs mt-1">
                    Image is required
                  </p>
                )}
                {isDragActive && !imageUrl && (
                  <div style={{position: "absolute", inset: 0, borderRadius: 8, border: "2px solid #3b82f6", background: "rgba(59,130,246,0.08)", pointerEvents: "none"}} />
                )}
              </div>
            </div>

            <div>
              <div className="relative">
                <input
                  type="url"
                  placeholder="Sweepstakes URL *"
                  className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 ${
                    !validationState.dealUrl && formData.dealUrl !== ""
                      ? "border border-red-500"
                      : !validationState.dealUrl
                        ? "border border-yellow-500"
                        : ""
                  }`}
                  value={formData.dealUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, dealUrl: e.target.value })
                  }
                  required
                />
                {validationState.dealUrl && formData.dealUrl && (
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
              {!validationState.dealUrl && formData.dealUrl ? (
                <p className="text-red-500 text-xs mt-1">
                  Please enter a valid URL (e.g. example.com or
                  https://example.com)
                </p>
              ) : !validationState.dealUrl ? (
                <p className="text-orange-500 text-xs mt-1">
                  Sweepstakes URL is required
                </p>
              ) : (
                <p className="text-gray-500 text-sm mt-1">
                  Add a link where users can participate in this sweepstakes
                </p>
              )}
            </div>

            <div>
              <div className="relative">
                <input
                  type="date"
                  className={`w-full bg-gray-800 text-white rounded-md px-4 py-3 ${
                    !validationState.expiryDate ? "border border-red-500" : ""
                  }`}
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
                {validationState.expiryDate && formData.expiryDate && (
                  <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
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
              {!validationState.expiryDate ? (
                <p className="text-red-500 text-xs mt-1">
                  Expiry date cannot be earlier than today
                </p>
              ) : (
                <p className="text-gray-500 text-sm mt-1">
                  End date of sweepstakes (required)
                </p>
              )}
            </div>

            <div className="bg-gray-800 rounded-md p-4">
              <h3 className="text-white font-medium mb-2">Preview</h3>
              <pre
                className="bg-gray-900 rounded-md p-4 whitespace-pre-wrap font-sans text-sm description-preview"
                dangerouslySetInnerHTML={{
                  __html: formData.description
                    .replace(/(https?:\/\/[^\s"]+)/g, (match) => { // Fixed regex escaping here too
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
                type="submit"
                disabled={loading || !isValid}
                className={`w-full mt-4 py-3 rounded-md font-medium flex items-center justify-center ${
                  isValid
                    ? "bg-orange-500 text-white"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
                onClick={handleSubmit}
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : isEditing ? (
                  labelOverrides?.submitButton || "Update Sweepstakes"
                ) : (
                  "Post Sweepstakes"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      <style>
        {`
          .image-wrapper {
            margin: 1rem 0;
            position: relative;
            display: inline-block;
          }
          .image-wrapper img {
            transition: opacity 0.2s;
          }
          .image-wrapper:hover img {
            opacity: 0.8;
          }
          .image-wrapper:hover .delete-button {
            opacity: 1;
          }
          .delete-button {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 40px;
            height: 40px;
            background-color: #ef4444;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            transition: all 0.2s;
            opacity: 0;
            z-index: 10;
          }
          .delete-button:hover {
            background-color: #dc2626;
          }
          .delete-button svg {
            width: 20px;
            height: 20px;
            color: white;
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

          /* Mobile-friendly formatting buttons */
          @media (max-width: 640px) {
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

            .delete-image-button {
              padding: 4px !important;
              margin: 4px 0 !important;
              height: 32px !important;
              width: auto !important;
              max-width: 32px !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              overflow: hidden !important;
            }

            .delete-image-button svg {
              width: 16px !important;
              height: 16px !important;
            }
          }
        `}
      </style>

      <StoreBottomSheet
        isOpen={isStoreSheetOpen}
        selectedStore={selectedStoreId}
        onStoreSelect={handleStoreSelect}
        onClose={() => setIsStoreSheetOpen(false)}
      />
    </div>
  );
};

export default AddSweepstakesPage;