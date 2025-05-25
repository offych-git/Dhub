// UserSubscriptionsPage.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, X, Edit, Save, Search, Plus } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface Subscription {
  id: string;
  keyword: string;
  created_at: string;
}

const UserSubscriptionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [keyword, setKeyword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKeyword, setEditingKeyword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Существующий useEffect для загрузки подписок
  useEffect(() => {
    if (user) {
      loadSubscriptions();
    } else {
      setLoading(false);
    }
  }, [user]);

  // ИЗМЕНЕННЫЙ useEffect для отправки заголовка в React Native приложение (с задержкой)
  useEffect(() => {
    const pageTitle = "Subscriptions"; // Используем "My Subscriptions" как в h1
    console.log(
      `[UserSubscriptionsPage Web] INFO: useEffect для отправки заголовка "${pageTitle}" запущен (с задержкой).`,
    );

    const timerId = setTimeout(() => {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        console.log(
          `[UserSubscriptionsPage Web] INFO: Отправляю заголовок "${pageTitle}" после задержки.`,
        );
        try {
          const messagePayload = {
            type: "SET_NATIVE_HEADER_TITLE",
            title: pageTitle,
          };
          window.ReactNativeWebView.postMessage(JSON.stringify(messagePayload));
          console.log(
            "[UserSubscriptionsPage Web] SUCCESS: Сообщение с заголовком ОТПРАВЛЕНО в RN.",
          );
        } catch (e) {
          console.error(
            "[UserSubscriptionsPage Web] ERROR: Ошибка при отправке сообщения postMessage:",
            e,
          );
        }
      } else {
        console.warn(
          "[UserSubscriptionsPage Web] WARN: window.ReactNativeWebView.postMessage НЕ ДОСТУПЕН в момент вызова (после задержки).",
        );
        if (!window.ReactNativeWebView) {
          console.warn(
            "[UserSubscriptionsPage Web] DETAIL: Сам объект window.ReactNativeWebView не определен.",
          );
        } else {
          console.warn(
            "[UserSubscriptionsPage Web] DETAIL: Объект window.ReactNativeWebView есть, но метода postMessage на нем нет.",
          );
        }
      }
    }, 50); // Небольшая задержка в 50 миллисекунд

    return () => clearTimeout(timerId); // Очистка таймера при размонтировании компонента
  }, []);

  const loadSubscriptions = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const { data, error: dbError } = await supabase
        .from("user_keyword_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (dbError) throw dbError;

      setSubscriptions(data || []);
    } catch (err: any) {
      console.error("Error loading subscriptions:", err);
      setError(
        err.message || "Failed to load subscriptions. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubscription = async () => {
    if (!user?.id || !keyword.trim()) return;

    if (keyword.trim().length > 50) {
      setError("Keyword must be less than 50 characters");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const trimmedKeyword = keyword.trim();
      const { data: existing } = await supabase
        .from("user_keyword_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("keyword", trimmedKeyword)
        .single();

      if (existing) {
        setError("You are already subscribed to this keyword");
        setTimeout(() => setError(null), 3000);
        setIsSubmitting(false); // Важно сбросить isSubmitting здесь
        return;
      }

      const { error: dbError } = await supabase
        .from("user_keyword_subscriptions")
        .insert({
          user_id: user.id,
          keyword: trimmedKeyword,
        });

      if (dbError) throw dbError;

      setKeyword("");
      setSuccess("Subscription added successfully");
      setTimeout(() => setSuccess(null), 3000);
      loadSubscriptions();
    } catch (err: any) {
      console.error("Error adding subscription:", err);
      setError(err.message || "Failed to add subscription");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubscription = (subscription: Subscription) => {
    setEditingId(subscription.id);
    setEditingKeyword(subscription.keyword);
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingKeyword.trim()) return;

    if (editingKeyword.trim().length > 50) {
      setError("Keyword must be less than 50 characters");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const trimmedEditingKeyword = editingKeyword.trim();
      const { data: existing } = await supabase
        .from("user_keyword_subscriptions")
        .select("id")
        .eq("user_id", user?.id)
        .eq("keyword", trimmedEditingKeyword)
        .neq("id", editingId)
        .single();

      if (existing) {
        setError("You are already subscribed to this keyword");
        setTimeout(() => setError(null), 3000);
        setIsSubmitting(false); // Важно сбросить isSubmitting здесь
        return;
      }

      const { error: dbError } = await supabase
        .from("user_keyword_subscriptions")
        .update({ keyword: trimmedEditingKeyword })
        .eq("id", editingId)
        .eq("user_id", user?.id);

      if (dbError) throw dbError;

      setEditingId(null);
      setSuccess("Subscription updated successfully");
      setTimeout(() => setSuccess(null), 3000);
      loadSubscriptions();
    } catch (err: any) {
      console.error("Error updating subscription:", err);
      setError(err.message || "Failed to update subscription");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    if (!user?.id) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const { error: dbError } = await supabase
        .from("user_keyword_subscriptions")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (dbError) throw dbError;

      setSuccess("Subscription deleted successfully");
      setTimeout(() => setSuccess(null), 3000);
      loadSubscriptions();
    } catch (err: any) {
      console.error("Error deleting subscription:", err);
      setError(err.message || "Failed to delete subscription");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const filteredSubscriptions = searchQuery
    ? subscriptions.filter((sub) =>
        sub.keyword.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : subscriptions;

  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-white text-center">
          <p className="mb-4">Please sign in to manage your subscriptions.</p>
          <button
            onClick={() => navigate("/auth")}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-md transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    // Убрал pt-0, если он был, т.к. отступ будет у main-content-area
    <div className="pb-16 bg-gray-900 min-h-screen">
      {/* ИЗМЕНЕНО: Добавлен класс web-page-header */}
      <div className="web-page-header fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="text-white p-1 hover:bg-gray-700 rounded-full"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-white font-medium ml-3">My Subscriptions</h1>
        </div>
      </div>

      {/* ИЗМЕНЕНО: Добавлен класс main-content-area и отступ pt-16 (примерно высота хедера) */}
      <div className="main-content-area px-4 pt-6">
        {error && (
          <div className="bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-3 rounded-lg mb-4 text-sm">
            {success}
          </div>
        )}
        <div className="bg-gray-800 rounded-lg overflow-hidden mb-6 shadow-md">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-white font-semibold text-lg">
              Keyword Subscriptions
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Get notified about new deals matching your keywords.
            </p>
          </div>

          <div className="p-4">
            <div className="flex items-center mb-2">
              <input
                type="text"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  if (error && e.target.value.trim()) setError(null);
                }}
                placeholder="Enter keyword (e.g. laptop, PS5)"
                maxLength={50}
                className="bg-gray-700 border border-gray-600 text-white px-4 py-2 rounded-lg flex-1 mr-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                disabled={isSubmitting}
              />
              <button
                onClick={handleAddSubscription}
                disabled={!keyword.trim() || isSubmitting}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center transition-colors"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            {keyword && (
              <div className="text-right text-xs text-gray-500 mt-1">
                {keyword.length}/50
              </div>
            )}
          </div>
        </div>
        {loading && subscriptions.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : subscriptions.length === 0 && !loading ? (
          <div className="text-center py-12 text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-3 text-gray-600" />
            <p className="text-lg">You don't have any subscriptions yet.</p>
            <p className="text-sm mt-2">
              Add keywords above to get notified about new deals.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Search your subscriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full bg-gray-700 border border-gray-600 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>

            {filteredSubscriptions.length === 0 && searchQuery ? (
              <div className="text-center py-8 text-gray-500">
                <p>No subscriptions match your search "{searchQuery}".</p>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg overflow-hidden shadow-md">
                <div className="divide-y divide-gray-700">
                  {filteredSubscriptions.map((subscription) => (
                    <div
                      key={subscription.id}
                      className="p-4 hover:bg-gray-700/50 transition-colors"
                    >
                      {editingId === subscription.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editingKeyword}
                            onChange={(e) => setEditingKeyword(e.target.value)}
                            className="bg-gray-600 border border-gray-500 text-white px-3 py-2 rounded-md flex-1 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            maxLength={50}
                            autoFocus
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleSaveEdit()
                            }
                          />
                          {editingKeyword && (
                            <div className="text-right text-xs text-gray-500">
                              {editingKeyword.length}/50
                            </div>
                          )}
                          <div className="flex space-x-2">
                            <button
                              onClick={handleSaveEdit}
                              disabled={
                                !editingKeyword.trim() ||
                                isSubmitting ||
                                editingKeyword.trim() === subscription.keyword
                              }
                              className="bg-green-500 p-2 rounded-md text-white hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed"
                              title="Save"
                            >
                              <Save className="h-5 w-5" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="bg-gray-500 p-2 rounded-md text-white hover:bg-gray-600"
                              title="Cancel"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-white text-md break-all">
                              {subscription.keyword}
                            </h3>
                            <p className="text-gray-400 text-xs mt-1">
                              Added{" "}
                              {new Date(
                                subscription.created_at,
                              ).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() =>
                                handleEditSubscription(subscription)
                              }
                              className="text-blue-400 hover:text-blue-300 p-1.5 rounded-md hover:bg-gray-700"
                              disabled={isSubmitting}
                              title="Edit"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteSubscription(subscription.id)
                              }
                              className="text-red-400 hover:text-red-300 p-1.5 rounded-md hover:bg-gray-700"
                              disabled={isSubmitting}
                              title="Delete"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {isSubmitting && (
          <div className="fixed bottom-4 right-4 bg-gray-700 text-white px-3 py-1.5 rounded-md text-xs shadow-lg">
            Processing...
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSubscriptionsPage;
