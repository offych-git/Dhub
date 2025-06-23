/**
 * Простое декодирование самых распространенных HTML-сущностей
 */
export function decodeHtml(text: string): string {
  if (!text) return text;
  
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Автоматически декодирует HTML-сущности в строковых полях объекта
 * Это решение проще чем добавлять decodeHtml везде вручную
 */
export function autoDecodeHtmlInObject(obj: any, fieldsToProcess: string[] = ['title', 'description']): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = { ...obj };
  
  fieldsToProcess.forEach(field => {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = decodeHtml(result[field]);
    }
  });
  
  return result;
}

/**
 * Декодирует HTML-сущности в строке
 * Преобразует &amp; в &, &lt; в <, &gt; в >, &quot; в ", &#39; в ' и т.д.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text || typeof text !== 'string') return text;
  
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    // Декодируем числовые HTML-сущности (например, &#8211; для en-dash)
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Очищает HTML-теги и декодирует HTML-сущности
 */
export function cleanAndDecodeHtml(text: string): string {
  if (!text || typeof text !== 'string') return text;
  
  // Сначала убираем HTML-теги
  const withoutTags = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Затем декодируем HTML-сущности
  return decodeHtmlEntities(withoutTags);
} 