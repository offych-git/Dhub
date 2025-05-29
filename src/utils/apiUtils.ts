interface FetchErrorData {
  status?: number;
  statusText?: string;
  body?: string;
  message?: string;
}

/**
 * Выполняет fetch запрос с возможностью нескольких повторных попыток при неудаче.
 * @param url URL для запроса.
 * @param options Опции для fetch (method, headers, body, etc.).
 * @param retries Количество повторных попыток (по умолчанию 3). Первая попытка не считается ретраем.
 * @param initialDelayMs Начальная задержка перед повторной попыткой в миллисекундах (по умолчанию 1000 мс).
 * @param operationName Имя операции для логирования (опционально).
 * @param backoffFactor Множитель для экспоненциальной задержки (по умолчанию 2).
 * @returns Promise, который разрешается с объектом Response в случае успеха.
 * @throws Ошибка, если все попытки завершились неудачей или если ошибка не предполагает повторных попыток.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3, // Всего будет retries + 1 попыток (1 обычная + 'retries' повторных)
  initialDelayMs = 1500,
  operationName = 'API Call',
  backoffFactor = 2
): Promise<Response> {
  let currentDelayMs = initialDelayMs;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[WEB ${operationName}] Retrying attempt ${attempt}/${retries} in ${currentDelayMs / 1000}s for ${url}`);
        await new Promise(resolve => setTimeout(resolve, currentDelayMs));
        currentDelayMs *= backoffFactor; // Увеличиваем задержку для следующей попытки
      } else {
        console.log(`[WEB ${operationName}] Attempting to fetch ${url}`);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData: FetchErrorData = {
          status: response.status,
          statusText: response.statusText,
        };
        try {
          // Попытка прочитать тело ответа, если оно есть и текстовое/JSON
          const responseBodyText = await response.text();
          try {
            // Попытка распарсить как JSON, если это возможно
            errorData.body = JSON.stringify(JSON.parse(responseBodyText));
          } catch (jsonError) {
            errorData.body = responseBodyText; // Если не JSON, сохраняем как текст
          }
        } catch (e) {
          // Не удалось прочитать тело ответа
          errorData.body = "Could not read error response body.";
        }

        console.warn(`[WEB ${operationName}] HTTP error:`, errorData, `for ${url} on attempt ${attempt + 1}`);

        // Не повторяем для определенных клиентских ошибок
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          throw new Error(`Non-retryable HTTP error ${response.status}: ${errorData.body || response.statusText}`);
        }

        // Если это последняя попытка (с учетом ретраев), выбрасываем ошибку
        if (attempt === retries) {
          throw new Error(`HTTP error ${response.status} after ${retries + 1} attempts: ${errorData.body || response.statusText}`);
        }
        // Для других ошибок (например, 5xx) продолжаем цикл для повторной попытки
        continue; // Явно переходим к следующей итерации (и задержке)
      }
      
      console.log(`[WEB ${operationName}] Successfully fetched ${url} on attempt ${attempt + 1}`);
      return response; // Успешный ответ

    } catch (error: any) {
      console.error(`[WEB ${operationName}] Fetch attempt ${attempt + 1}/${retries + 1} failed for ${url}:`, error.message);
      
      // Проверяем, является ли ошибка сетевой (которую стоит повторять)
      // или это уже обработанная HTTP ошибка, которую не нужно повторять (например, 401)
      const isNetworkError = error.message.includes("TypeError: Failed to fetch") ||
                             error.message.includes("TypeError: Load failed") ||
                             error.message.includes("NetworkError");

      if (!isNetworkError && !(error.message.startsWith('HTTP error'))) {
        // Если это не сетевая ошибка и не наша кастомная HTTP ошибка (которая уже обработана выше),
        // возможно, это ошибка, которую не стоит повторять (например, из response.json() если бы мы его тут вызывали).
        // В данном случае, если это не сетевая и не HTTP 5xx+, то, скорее всего, это уже Non-retryable HTTP error.
        throw error; 
      }

      if (attempt === retries) { // Если это последняя попытка
        console.error(`[WEB ${operationName}] All ${retries + 1} fetch attempts failed for ${url}.`);
        throw error; // Перебрасываем ошибку после последней попытки
      }
      // Задержка перед следующей попыткой уже обработана в начале цикла для attempt > 0
    }
  }
  // Эта строка не должна быть достигнута при правильной логике цикла, но TypeScript требует возврата или throw.
  throw new Error(`[WEB ${operationName}] All fetch attempts failed unexpectedly for ${url} (exited loop).`);
}

