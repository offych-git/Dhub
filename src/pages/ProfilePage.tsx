import React, { useState, useEffect, useCallback } from "react"; // Added useCallback here
import {
  Heart,
  Tag,
  Bell,
  MessageSquare,
  Pencil,
  Check,
  X,
  Settings,
  Shield,
  Info,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAdmin } from "../hooks/useAdmin";
import { useModeration } from "../contexts/ModerationContext";

// Компонент для отображения количества элементов в очереди модерации
const ModerationCount: React.FC = () => {
  const { queueCount, isLoading, loadModerationQueue } = useModeration();

  useEffect(() => {
    // При монтировании компонента загружаем данные очереди модерации
    loadModerationQueue();
  }, [loadModerationQueue]);

  return (
    <span className="ml-auto text-gray-400">
      {isLoading ? "..." : queueCount > 0 ? queueCount : 0}
    </span>
  );
};

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [savedItemsCount, setSavedItemsCount] = useState(0);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    dealsCount: 0,
    promosCount: 0,
    commentsCount: 0,
  });
  const [userStatus, setUserStatus] = useState("Newcomer");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { isAdmin, isLoading: isAdminLoading, role } = useAdmin();

  const getUserStatusColor = (status: string) => {
    switch (status) {
      case "Admin":
        return "bg-red-500/20 text-red-400 dark:text-red-300";
      case "Deal Master":
        return "bg-purple-500/20 text-purple-600 dark:text-purple-300";
      case "Deal Expert":
        return "bg-orange-500/20 text-orange-600 dark:text-orange-300";
      case "Moderator":
        return "bg-pink-500/20 text-pink-600 dark:text-pink-300";
      case "Active Contributor":
        return "bg-green-500/20 text-green-600 dark:text-green-300";
      case "Regular Member":
        return "bg-blue-500/20 text-blue-600 dark:text-blue-300";
      case "Rising Star":
        return "bg-yellow-500/20 text-yellow-600 dark:text-yellow-300";
      default:
        return "bg-gray-500/20 text-gray-600 dark:text-gray-300";
    }
  };

  const calculateUserStatus = async (stats: {
    dealsCount: number;
    commentsCount: number;
  }) => {
    try {
      if (!user?.id) return "Newcomer";

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("user_status")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        return "Newcomer";
      }

      if (profile?.user_status === "admin") return "Admin";
      if (profile?.user_status === "moderator") return "Moderator";
      if (profile?.user_status === "super_admin") return "Admin"; // Added super_admin check

      const totalContributions = stats.dealsCount + stats.commentsCount;

      if (totalContributions >= 1000) return "Deal Master";
      if (totalContributions >= 500) return "Deal Expert";
      if (totalContributions >= 150) return "Active Contributor";
      if (totalContributions >= 100) return "Regular Member";
      if (totalContributions >= 50) return "Rising Star";
      return "Newcomer";
    } catch (error) {
      console.error("Error calculating user status:", error);
      return "Newcomer";
    }
  };

  // Replaced original useEffect with these three for better separation and useCallback
  useEffect(() => {
    if (user) {
      // These are now dependencies for loadUserProfile, loadUserStats, loadSavedItemsCount
      // The individual functions are wrapped in useCallback below.
      loadUserProfile();
    }
  }, [user]); // Run loadUserProfile when 'user' object changes

  useEffect(() => {
    if (user) {
      loadUserStats();
    }
  }, [user, calculateUserStatus]); // Run loadUserStats when 'user' changes, and also when calculateUserStatus changes (though it's stable)

  useEffect(() => {
    if (user) {
      loadSavedItemsCount();
    }
  }, [user]); // Run loadSavedItemsCount when 'user' changes


  const loadSavedItemsCount = async () => {
    if (!user) return;

    try {
      // 1. Получаем ID избранных скидок
      const { data: dealFavorites, error: dealFavoritesError } = await supabase
        .from("deal_favorites")
        .select("deal_id")
        .eq("user_id", user.id);

      if (dealFavoritesError) {
        console.error("Error fetching deal favorites:", dealFavoritesError);
      }

      // 2. Получаем количество реальных скидок, которые можно показать (существуют в таблице deals)
      let dealsCount = 0;
      if (dealFavorites && dealFavorites.length > 0) {
        const dealIds = dealFavorites.map((fav) => fav.deal_id);
        const { count, error } = await supabase
          .from("deals")
          .select("id", { count: "exact", head: true })
          .in("id", dealIds);

        if (error) {
          console.error("Error fetching deals count:", error);
        } else {
          dealsCount = count || 0;
        }
      }

      // 3. Получаем количество избранных промокодов
      const { count: promoCount, error: promosCountError } = await supabase
        .from("promo_favorites")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (promosCountError) {
        console.error("Error fetching saved promos count:", promosCountError);
      }

      // Логируем фактические результаты для отладки
      console.log(
        "Actual saved items count - Deals:",
        dealsCount,
        "Promos:",
        promoCount,
        "Total:",
        (dealsCount || 0) + (promoCount || 0),
      );

      // Устанавливаем правильное количество
      setSavedItemsCount((dealsCount || 0) + (promoCount || 0));
    } catch (err) {
      console.error("Error loading saved items count:", err);
    }
  };

  // --- MODIFIED loadUserProfile function ---
  const loadUserProfile = useCallback(async () => {
    if (!user?.id) {
      setDisplayName('Гость');
      setOriginalName('Гость');
      setProfile(null);
      setUserStatus('Гость'); // Set guest status explicitly
      return;
    }

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, user_status")
        .eq("id", user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      let finalDisplayName = '';
      const nameFromFacebook = user.user_metadata?.full_name || user.user_metadata?.name;

      // 1. **Highest Priority:** Name from Facebook
      if (nameFromFacebook) {
        finalDisplayName = nameFromFacebook;
      }
      // 2. If no name from Facebook, fallback to email
      else if (user.email) {
        finalDisplayName = user.email.split('@')[0];
      }
      // 3. Last resort if no info is available
      else {
        finalDisplayName = 'Пользователь';
      }

      setDisplayName(finalDisplayName);
      setOriginalName(finalDisplayName);
      setProfile(profileData || {}); // Set profile data (can be null for new user)

      // **KEY STEP: Save the determined name to profiles.display_name.**
      // This will happen if profiles.display_name is empty, OR if the
      // name we just determined (finalDisplayName) is different from what's in the DB.
      // This ensures the Facebook name is written and remains primary until user changes it.
      if (!profileData?.display_name || profileData?.display_name !== finalDisplayName) {
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert({ id: user.id, display_name: finalDisplayName }, { onConflict: 'id' }); // Use upsert for create or update
        if (upsertError) {
          console.error('Error saving/updating name in profile:', upsertError);
        } else {
          console.log('Profile name successfully updated/created in DB.');
          // Update the profile state to reflect the new display_name from DB
          setProfile(prev => ({ ...prev, display_name: finalDisplayName }));
        }
      }

      // Set user status based on fetched profile data
      if (profileData?.user_status === "admin" || profileData?.user_status === "super_admin") {
        console.log("User is admin or super_admin:", profileData.user_status);
        setUserStatus("Admin");
      } else if (profileData?.user_status === "moderator") {
        console.log("User is moderator:", profileData.user_status);
        setUserStatus("Moderator");
      }
      // Note: If profileData?.user_status is null/undefined for a new user,
      // the status will be "Newcomer" by default, and `calculateUserStatus`
      // (called by loadUserStats) will refine it based on contributions.

    } catch (err: any) {
      console.error("Error loading profile:", err.message);
      // Fallback names in case of profile loading error, but user object is present
      const fallbackName = user?.user_metadata?.full_name
                         || user?.user_metadata?.name
                         || user?.email?.split('@')[0]
                         || 'Пользователь';
      setDisplayName(fallbackName);
      setOriginalName(fallbackName);
      setProfile(null); // Ensure profile is null if an error occurs
      setUserStatus('Ошибка загрузки'); // Indicate loading error status
    }
  }, [user, supabase]); // Dependencies for useCallback

  const loadUserStats = async () => {
    if (!user) return;

    try {
      // Get deals count
      const { count: dealsCount } = await supabase
        .from("deals")
        .select("id", { count: "exact" })
        .eq("user_id", user.id);

      // Get promos count
      const { count: promosCount } = await supabase
        .from("promo_codes")
        .select("id", { count: "exact" })
        .eq("user_id", user.id);

      // Get total comments count (both deal and promo comments)
      const { count: dealCommentsCount } = await supabase
        .from("deal_comments")
        .select("id", { count: "exact" })
        .eq("user_id", user.id);

      const { count: promoCommentsCount } = await supabase
        .from("promo_comments")
        .select("id", { count: "exact" })
        .eq("user_id", user.id);

      const newStats = {
        dealsCount: (dealsCount || 0) + (promosCount || 0), // Total of deals and promos
        promosCount: promosCount || 0,
        commentsCount: (dealCommentsCount || 0) + (promoCommentsCount || 0),
      };

      setStats(newStats);
      const status = await calculateUserStatus(newStats);
      setUserStatus(status);
    } catch (err) {
      console.error("Error loading user stats:", err);
    }
  };

  const handleNameEdit = () => {
    setIsEditingName(true);
  };

  const handleNameSave = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() })
        .eq("id", user.id);

      if (error) throw error;

      setOriginalName(displayName);
      setIsEditingName(false);
      setSuccess("Name updated successfully");

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setDisplayName(originalName);
    } finally {
      setLoading(false);
    }
  };

  const handleNameCancel = () => {
    setDisplayName(originalName);
    setIsEditingName(false);
  };

  // Helper function to handle tooltip toggling
  const toggleTooltip = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const tooltip = e.currentTarget.nextElementSibling;
    if (tooltip) {
      tooltip.classList.toggle("opacity-0");
      if (!tooltip.classList.contains("opacity-0")) {
        const closeTooltip = (event: MouseEvent) => {
          if (!tooltip.contains(event.target as Node)) {
            tooltip.classList.add("opacity-0");
            document.removeEventListener("click", closeTooltip);
          }
        };
        // Add listener on next tick to avoid immediate closure
        setTimeout(() => {
          document.addEventListener("click", closeTooltip);
        }, 0);
      }
    }
  };

  return (
    <div className="pb-8 pt-0 bg-gray-900 min-h-screen">
      <div className="px-4 pt-4">
        {error && (
          <div className="bg-red-500 text-white px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500 text-white px-4 py-2 rounded mb-4">
            {success}
          </div>
        )}

        {/* User info */}
        <div className="flex items-center mb-6">
          <div className="w-16 h-16 rounded-full overflow-hidden mr-4">
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`}
              alt="User avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center">
              {isEditingName ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="bg-gray-800 text-white px-2 py-1 rounded"
                    autoFocus
                  />
                  <button
                    onClick={handleNameSave}
                    disabled={loading || !displayName.trim()}
                    className="text-green-500 hover:text-green-400 disabled:opacity-50"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleNameCancel}
                    className="text-red-500 hover:text-red-400"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-white text-xl font-bold">
                    {displayName}
                  </h2>
                  <button
                    onClick={handleNameEdit}
                    className="ml-2 text-gray-400 hover:text-orange-500 cursor-pointer transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center">
              {" "}
              {/* New div for email and tooltip */}
              <p className="text-gray-400">{user?.email}</p>
              <div className="relative w-4 h-4 flex items-center justify-center ml-2">
                {" "}
                {/* Added ml-2 for spacing */}
                <button
                  onClick={toggleTooltip}
                  className="text-gray-500 hover:text-gray-300 p-0 flex items-center justify-center"
                >
                  <Info className="h-4 w-4" />{" "}
                  {/* Using Info icon for email tooltip */}
                </button>
                {/* Updated Tooltip Positioning and Styling */}
                {/* Tooltip Wrapper - CHANGED: removed transform translate-x-1/2 */}
                <div className="absolute top-full right-0 mt-2 w-48 opacity-0 transition-opacity duration-200 pointer-events-none z-50">
                  {/* Content Box */}
                  <div className="bg-gray-100 text-gray-800 text-center text-xs py-2 px-3 rounded-lg shadow-lg border border-gray-200">
                    Your email is visible only to you.
                  </div>
                  {/* Arrow Assembly */}
                  {/* Arrow Positioning Div - CHANGED: right-1/2 transform translate-x-1/2 TO right-0. Corrected nested structure. */}
                  <div className="absolute bottom-full right-0 mb-1">
                    <div className="border-8 border-transparent border-b-gray-100"></div>{" "}
                    {/* Arrow Shape */}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div>
            <button
              onClick={() => navigate("/user-settings")}
              className="p-2 text-white hover:text-orange-500"
              title="User Settings"
            >
              <Settings className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* User Status & Rating */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-gray-400 text-sm mb-1 flex items-center justify-center gap-2">
                Status
                <div className="relative w-4 h-4 flex items-center justify-center">
                  <button
                    onClick={toggleTooltip} // Re-using the same toggleTooltip function
                    className="text-gray-500 hover:text-gray-300 p-0 flex items-center justify-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                  </button>
                  {/* Status Tooltip - unchanged from previous version for dark theme support if applicable */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-64 opacity-0 transition-opacity duration-200 pointer-events-none z-50">
                    <div className="bg-white dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300 py-2 px-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                      <div className="font-medium mb-1 text-gray-900 dark:text-white">
                        Status Progression:
                      </div>
                      <div className="space-y-1">
                        <div>Newcomer (0)</div>
                        <div>Rising Star (50+)</div>
                        <div>Regular Member (100+)</div>
                        <div>Active Contributor (150+)</div>
                        <div>Deal Expert (500+)</div>
                        <div>Deal Master (1000+)</div>
                      </div>
                    </div>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1">
                      <div className="border-8 border-transparent border-b-white dark:border-b-gray-800"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-center">
                  <div
                    className={`px-3 py-1 rounded-full text-sm ${getUserStatusColor(userStatus)}`}
                  >
                    {userStatus}
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {(() => {
                    const totalContributions =
                      stats.dealsCount + stats.commentsCount;
                    if (userStatus === "Admin" || userStatus === "Moderator") {
                      return (
                        <>
                          Special status
                          <ModerationCount />
                        </>
                      );
                    } else if (userStatus === "Deal Master") {
                      return `${totalContributions}/1000+ contributions`;
                    } else {
                      const nextThreshold =
                        totalContributions < 50
                          ? 50
                          : totalContributions < 100
                            ? 100
                            : totalContributions < 150
                              ? 150
                              : totalContributions < 500
                                ? 500
                                : totalContributions < 1000
                                  ? 1000
                                  : 1000;
                      const progress = Math.min(
                        100,
                        (totalContributions / nextThreshold) * 100,
                      );
                      return `${totalContributions}/${nextThreshold} contributions (${Math.floor(progress)}%)`;
                    }
                  })()}
                </div>
              </div>
            </div>
            <div className="text-center border-l border-gray-700">
              <div className="text-gray-400 text-sm mb-1">Rating</div>
              <div className="text-xl font-bold text-orange-500">
                {Math.min(
                  5,
                  Math.floor((stats.dealsCount + stats.commentsCount) / 10),
                )}
                .0
              </div>
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div className="bg-gray-800 rounded-lg overflow-hidden mb-6">
          <div className="divide-y divide-gray-700">
            <div className="px-4 py-3 flex items-center">
              <Heart className="h-5 w-5 text-orange-500 mr-3" />
              <button
                onClick={() => navigate("/saved")}
                className="text-white flex-1 text-left"
              >
                Saved Items
              </button>
              <span className="ml-auto text-gray-400">{savedItemsCount}</span>
            </div>
            <div className="px-4 py-3 flex items-center">
              <Tag className="h-5 w-5 text-orange-500 mr-3" />
              <button
                onClick={() => navigate("/posted")}
                className="text-white flex-1 text-left"
              >
                My Posted Items
              </button>
              <span className="ml-auto text-gray-400">{stats.dealsCount}</span>
            </div>
            <div className="px-4 py-3 flex items-center">
              <Bell className="h-5 w-5 text-orange-500 mr-3" />
              <button
                onClick={() => navigate("/settings/notifications")}
                className="text-white flex-1 text-left"
              >
                Notification Settings
              </button>
            </div>
            <div className="px-4 py-3 flex items-center">
              <svg
                className="h-5 w-5 text-orange-500 mr-3"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
              <button
                onClick={() => navigate("/user-subscriptions")}
                className="text-white flex-1 text-left"
              >
                My Subscriptions
              </button>
            </div>
            <div className="px-4 py-3 flex items-center">
              <MessageSquare className="h-5 w-5 text-orange-500 mr-3" />
              <button
                onClick={() => navigate("/comments")}
                className="text-white flex-1 text-left"
              >
                My Comments
              </button>
              <span className="ml-auto text-gray-400">
                {stats.commentsCount}
              </span>
            </div>
            {(isAdmin ||
              role === "moderator" ||
              role === "admin" ||
              role === "super_admin") && (
                <div className="px-4 py-3 flex items-center">
                  <Shield className="h-5 w-5 text-orange-500 mr-3" />
                  <button
                    onClick={() => navigate("/moderation")}
                    className="text-white flex-1 text-left"
                  >
                    Модерация
                  </button>
                  <ModerationCount />
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;