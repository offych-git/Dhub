// src/utils/emailService.ts
import { supabase } from '../lib/supabase'; // Убедитесь, что путь к вашему клиенту Supabase правильный

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string; // Необязательно, если Edge Function использует дефолтное
}

export const sendNotificationEmail = async (options: SendEmailOptions) => {
  try {
    console.log('Попытка вызвать Edge Function для отправки email:', options);

    // --- ВАЖНО: Замените 'send-notification-email' на 'smart-function' ---
    const { data, error } = await supabase.functions.invoke('smart-function', {
      body: options,
      // Если Edge Function требует аутентификации, вам нужно добавить headers: { 'Authorization': `Bearer ${session.access_token}` }
      // Но поскольку мы деплоили с --no-verify-jwt, это пока не нужно.
    });

    if (error) {
      console.error('Ошибка вызова Edge Function "smart-function":', error);
      throw new Error(error.message || 'Неизвестная ошибка при отправке email через Edge Function.');
    }

    console.log('Edge Function "smart-function" успешно вызвана. Ответ:', data);
    return data;

  } catch (err: any) {
    console.error('Произошла ошибка в sendNotificationEmail:', err);
    throw err;
  }
};