import { supabase } from '../lib/supabase';

export interface TranslationResult {
  success: boolean;
  message: string;
  translations: {
    title_en: string;
    title_es: string;
    description_en: string;
    description_es: string;
  };
}

export interface AutoTranslateParams {
  id: string;
  table: 'deals' | 'promo_codes' | 'sweepstakes';
  title: string;
  description: string;
  operation: 'create' | 'update';
}

/**
 * Вызывает функцию автоперевода для карточки
 */
export async function autoTranslateContent(params: AutoTranslateParams): Promise<TranslationResult> {
  try {
    console.log('[AUTO-TRANSLATE] Calling translation function with params:', params);
    
    const { data, error } = await supabase.functions.invoke('auto-translate-content', {
      body: params
    });

    if (error) {
      console.error('[AUTO-TRANSLATE] Function error:', error);
      throw new Error(error.message || 'Translation failed');
    }

    console.log('[AUTO-TRANSLATE] Translation result:', data);
    return data as TranslationResult;
    
  } catch (error) {
    console.error('[AUTO-TRANSLATE] Error calling translation function:', error);
    throw error;
  }
}

/**
 * Переводит текст без сохранения в базу данных (для предварительного просмотра)
 */
export async function translateTextOnly(title: string, description: string): Promise<TranslationResult> {
  try {
    console.log('[AUTO-TRANSLATE] Translating text only:', { title, description });
    
    const { data, error } = await supabase.functions.invoke('auto-translate-content', {
      body: {
        id: 'preview', // Временный ID для предварительного перевода
        table: 'deals', // Любая таблица подойдет
        title,
        description,
        operation: 'create'
      }
    });

    if (error) {
      console.error('[AUTO-TRANSLATE] Function error:', error);
      throw new Error(error.message || 'Translation failed');
    }

    console.log('[AUTO-TRANSLATE] Translation preview result:', data);
    return data as TranslationResult;
    
  } catch (error) {
    console.error('[AUTO-TRANSLATE] Error translating text only:', error);
    throw error;
  }
}

/**
 * Автоматически переводит контент после создания/обновления карточки
 */
export async function translateAfterSave(
  id: string,
  table: 'deals' | 'promo_codes' | 'sweepstakes',
  title: string,
  description: string,
  operation: 'create' | 'update' = 'create'
): Promise<void> {
  try {
    console.log(`[AUTO-TRANSLATE] Starting translation for ${table} ${id}`);
    
    const result = await autoTranslateContent({
      id,
      table,
      title,
      description,
      operation
    });

    if (result.success) {
      console.log(`[AUTO-TRANSLATE] Successfully translated ${table} ${id}`);
    } else {
      console.warn(`[AUTO-TRANSLATE] Translation completed but with issues:`, result.message);
    }
    
  } catch (error) {
    console.error(`[AUTO-TRANSLATE] Failed to translate ${table} ${id}:`, error);
    // Не бросаем ошибку, чтобы не прерывать основной процесс сохранения
  }
} 