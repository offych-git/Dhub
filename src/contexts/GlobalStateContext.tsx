import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { Deal } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// Типы состояния
type Role = 'user' | 'moderator' | 'admin' | 'super_admin';

interface GlobalState {
  deals: {
    items: Deal[];
    isLoading: boolean;
    isStale: boolean;
    lastFetched: number | null;
  };
  promos: {
    items: any[];
    isLoading: boolean; 
    isStale: boolean;
    lastFetched: number | null;
  };
  admin: {
    role: Role;
    isLoading: boolean;
    permissions: {
      canDeleteContent: boolean;
      canManageUsers: boolean;
      canManageRoles: boolean;
      canManageComments: boolean;
      canManageDeals: boolean;
      canManagePromos: boolean;
    };
  };
  moderation: {
    isEnabled: boolean;
    queue: any[];
    queueCount: number;
  };
}

// Типы действий
type Action = 
  | { type: 'SET_DEALS', payload: Deal[] }
  | { type: 'SET_DEALS_LOADING', payload: boolean }
  | { type: 'MARK_DEALS_STALE' }
  | { type: 'SET_PROMOS', payload: any[] }
  | { type: 'SET_PROMOS_LOADING', payload: boolean }
  | { type: 'MARK_PROMOS_STALE' }
  | { type: 'SET_ADMIN_ROLE', payload: Role }
  | { type: 'SET_ADMIN_LOADING', payload: boolean }
  | { type: 'UPDATE_DEAL', payload: Deal }
  | { type: 'DELETE_DEAL', payload: string }
  | { type: 'UPDATE_PROMO', payload: any }
  | { type: 'DELETE_PROMO', payload: string }
  | { type: 'SET_MODERATION_ENABLED', payload: boolean }
  | { type: 'SET_MODERATION_QUEUE', payload: any[] };

// Начальное состояние
const initialState: GlobalState = {
  deals: {
    items: [],
    isLoading: false,
    isStale: true,
    lastFetched: null
  },
  promos: {
    items: [],
    isLoading: false,
    isStale: true,
    lastFetched: null
  },
  admin: {
    role: 'user',
    isLoading: true,
    permissions: {
      canDeleteContent: false,
      canManageUsers: false,
      canManageRoles: false,
      canManageComments: false,
      canManageDeals: false,
      canManagePromos: false
    }
  },
  moderation: {
    isEnabled: true,
    queue: [],
    queueCount: 0
  }
};

// Определение разрешений по роли
const getPermissionsForRole = (role: Role) => {
  const permissions = {
    user: {
      canDeleteContent: false,
      canManageUsers: false,
      canManageRoles: false,
      canManageComments: false,
      canManageDeals: false,
      canManagePromos: false
    },
    moderator: {
      canDeleteContent: true,
      canManageUsers: false,
      canManageRoles: false,
      canManageComments: true,
      canManageDeals: false,
      canManagePromos: false
    },
    admin: {
      canDeleteContent: true,
      canManageUsers: true,
      canManageRoles: false,
      canManageComments: true,
      canManageDeals: true,
      canManagePromos: true
    },
    super_admin: {
      canDeleteContent: true,
      canManageUsers: true,
      canManageRoles: true,
      canManageComments: true,
      canManageDeals: true,
      canManagePromos: true
    }
  };

  return permissions[role];
};

// Редьюсер
function reducer(state: GlobalState, action: Action): GlobalState {
  switch (action.type) {
    case 'SET_DEALS':
      return {
        ...state,
        deals: {
          ...state.deals,
          items: action.payload,
          isStale: false,
          lastFetched: Date.now()
        }
      };
    case 'SET_DEALS_LOADING':
      return {
        ...state,
        deals: {
          ...state.deals,
          isLoading: action.payload
        }
      };
    case 'MARK_DEALS_STALE':
      return {
        ...state,
        deals: {
          ...state.deals,
          isStale: true
        }
      };
    case 'SET_PROMOS':
      return {
        ...state,
        promos: {
          ...state.promos,
          items: action.payload,
          isStale: false,
          lastFetched: Date.now()
        }
      };
    case 'SET_PROMOS_LOADING':
      return {
        ...state,
        promos: {
          ...state.promos,
          isLoading: action.payload
        }
      };
    case 'MARK_PROMOS_STALE':
      return {
        ...state,
        promos: {
          ...state.promos,
          isStale: true
        }
      };
    case 'SET_ADMIN_ROLE':
      return {
        ...state,
        admin: {
          ...state.admin,
          role: action.payload,
          permissions: getPermissionsForRole(action.payload),
          isLoading: false
        }
      };
    case 'SET_ADMIN_LOADING':
      return {
        ...state,
        admin: {
          ...state.admin,
          isLoading: action.payload
        }
      };
    case 'UPDATE_DEAL':
      return {
        ...state,
        deals: {
          ...state.deals,
          // Полностью очищаем массив сделок и делаем его устаревшим
          // чтобы принудительно обновить после редактирования
          items: [],
          isStale: true,
          lastFetched: null
        }
      };
    case 'DELETE_DEAL':
      return {
        ...state,
        deals: {
          ...state.deals,
          items: state.deals.items.filter(deal => deal.id !== action.payload)
        }
      };
    case 'UPDATE_PROMO':
      return {
        ...state,
        promos: {
          ...state.promos,
          items: state.promos.items.map(promo => 
            promo.id === action.payload.id ? action.payload : promo
          )
        }
      };
    case 'DELETE_PROMO':
      return {
        ...state,
        promos: {
          ...state.promos,
          items: state.promos.items.filter(promo => promo.id !== action.payload)
        }
      };
    default:
      return state;
  }
}

// Создание контекста
const GlobalStateContext = createContext<{
  state: GlobalState;
  dispatch: React.Dispatch<Action>;
  refreshDeals: () => Promise<void>;
  refreshPromos: () => Promise<void>;
  refreshAdminStatus: () => Promise<void>;
}>({
  state: initialState,
  dispatch: () => null,
  refreshDeals: async () => {},
  refreshPromos: async () => {},
  refreshAdminStatus: async () => {}
});

// Хук для использования контекста
export const useGlobalState = () => useContext(GlobalStateContext);

// Провайдер контекста
export const GlobalStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { user } = useAuth();

  // Функция для загрузки роли пользователя
  const refreshAdminStatus = async () => {
    if (!user) {
      dispatch({ type: 'SET_ADMIN_ROLE', payload: 'user' });
      return;
    }

    dispatch({ type: 'SET_ADMIN_LOADING', payload: true });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      dispatch({ type: 'SET_ADMIN_ROLE', payload: data?.role || 'user' });
    } catch (error) {
      console.error('Error checking role:', error);
      dispatch({ type: 'SET_ADMIN_ROLE', payload: 'user' });
    }
  };

  // Функция для загрузки сделок с использованием утилитарных функций
  const refreshDeals = async () => {
    if (state.deals.isLoading) return;
    dispatch({ type: 'SET_DEALS_LOADING', payload: true });

    try {
      // Используем утилитарную функцию для загрузки с повторными попытками
      const { data: deals, error } = await supabase
        .from('deals')
        .select(`
          *,
          profiles (
            id,
            email,
            display_name
          )
        `)
        .or('status.eq.published,status.eq.approved')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Обработка данных и преобразование в нужный формат
      // (упрощенно для примера)
      const formattedDeals = deals ? deals.map(deal => ({
        id: deal.id,
        title: deal.title,
        currentPrice: parseFloat(deal.current_price),
        originalPrice: deal.original_price ? parseFloat(deal.original_price) : undefined,
        store: { id: deal.store_id, name: deal.store_id },
        category: { id: deal.category_id, name: deal.category_id },
        image: deal.image_url || 'https://via.placeholder.com/400x300?text=No+Image',
        postedAt: {
          relative: '0m', // Упрощено
          exact: new Date(deal.created_at).toLocaleString()
        },
        popularity: 0, // Будет заполнено позже
        comments: 0, // Будет заполнено позже
        postedBy: {
          id: deal.profiles?.id || 'anonymous',
          name: deal.profiles?.display_name || 'Anonymous User',
          avatar: 'https://ui-avatars.com/api/?name=Anonymous+User&background=random'
        },
        description: deal.description,
        url: deal.deal_url,
        createdAt: new Date(deal.created_at),
        is_hot: deal.is_hot
      })) : [];

      dispatch({ type: 'SET_DEALS', payload: formattedDeals });
    } catch (err) {
      console.error('Error fetching deals:', err);
    } finally {
      dispatch({ type: 'SET_DEALS_LOADING', payload: false });
    }
  };

  // Функция для загрузки промокодов
  const refreshPromos = async () => {
    if (state.promos.isLoading) return;
    dispatch({ type: 'SET_PROMOS_LOADING', payload: true });

    try {
      // Здесь должен быть код для загрузки промокодов
      const { data: promos, error } = await supabase
        .from('promo_codes')
        .select(`
          *,
          profiles:user_id (
            id,
            email,
            display_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      dispatch({ type: 'SET_PROMOS', payload: promos || [] });
    } catch (err) {
      console.error('Error fetching promo codes:', err);
    } finally {
      dispatch({ type: 'SET_PROMOS_LOADING', payload: false });
    }
  };

  // Загрузка статуса админа при изменении пользователя
  useEffect(() => {
    refreshAdminStatus();
  }, [user]);

  return (
    <GlobalStateContext.Provider value={{ 
      state, 
      dispatch, 
      refreshDeals,
      refreshPromos,
      refreshAdminStatus
    }}>
      {children}
    </GlobalStateContext.Provider>
  );
};