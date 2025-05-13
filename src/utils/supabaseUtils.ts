
import { supabase } from '../lib/supabase';

/**
 * Выполняет запрос к Supabase с автоматическими повторными попытками при ошибках сети
 * @param queryFn Функция, выполняющая запрос к Supabase
 * @param maxRetries Максимальное количество повторных попыток
 * @param retryDelay Задержка между повторными попытками в мс
 */
export async function executeWithRetry(
  queryFn: () => Promise<any>,
  maxRetries = 3,
  retryDelay = 1000
) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await queryFn();
    } catch (error: any) {
      retries++;
      
      // Проверяем, является ли ошибка сетевой
      const isNetworkError = 
        error.message?.includes('Failed to fetch') || 
        error.message?.includes('Network Error') ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ECONNRESET';
      
      // Если не сетевая ошибка или исчерпаны все попытки, выбрасываем ошибку
      if (!isNetworkError || retries >= maxRetries) {
        console.error('Supabase error after retries:', error);
        throw error;
      }
      
      // Добавляем логирование для отладки
      console.log(`Attempt ${retries}/${maxRetries} failed, retrying in ${retryDelay}ms...`);
      
      // Ждем перед следующей попыткой
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

/**
 * Стандартизированная функция для получения элементов с проверкой статусов
 * (показывает как published, так и approved элементы)
 */
export async function fetchPublishedItems(table, query = {}) {
  return executeWithRetry(async () => {
    let supabaseQuery = supabase
      .from(table)
      .select(query.select || '*');
    
    // Добавляем фильтр по статусу (published или approved)
    supabaseQuery = supabaseQuery.or('status.eq.published,status.eq.approved');
    
    // Применяем дополнительные фильтры если они есть
    if (query.filters) {
      Object.entries(query.filters).forEach(([key, value]) => {
        supabaseQuery = supabaseQuery.eq(key, value);
      });
    }
    
    // Сортировка
    if (query.orderBy) {
      supabaseQuery = supabaseQuery.order(query.orderBy.column, {
        ascending: query.orderBy.ascending
      });
    }
    
    // Пагинация
    if (query.pagination) {
      const { page, pageSize } = query.pagination;
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      supabaseQuery = supabaseQuery.range(start, end);
    }
    
    return supabaseQuery;
  });
}

/**
 * Получение опубликованных элементов с учетом прав пользователя
 * @param table Имя таблицы
 * @param user Текущий пользователь
 * @param isAdmin Флаг админа
 * @param options Дополнительные опции запроса
 */
export async function fetchPublishedItemsWithPermission(table, user, isAdmin, options = {}) {
  return executeWithRetry(async () => {
    let query = supabase
      .from(table)
      .select(options.select || '*');
    
    // Применяем фильтрацию на основе прав пользователя
    if (isAdmin) {
      // Админы видят все элементы
    } else if (user) {
      // Авторизованные пользователи видят опубликованные и свои элементы
      query = query.or(`status.eq.published,user_id.eq.${user.id}`);
    } else {
      // Неавторизованные пользователи видят только опубликованные элементы
      query = query.or('status.eq.published,status.eq.approved');
    }
    
    // Применяем дополнительные фильтры
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    
    // Сортировка
    if (options.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending
      });
    }
    
    return query;
  });
}
