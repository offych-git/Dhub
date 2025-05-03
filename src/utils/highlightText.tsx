
import React from 'react';

/**
 * Выделяет найденные слова в тексте
 * @param text Исходный текст
 * @param searchQuery Поисковый запрос
 * @returns JSX с выделенными словами
 */
export function highlightText(text: string, searchQuery: string): React.ReactNode {
  if (!text || !searchQuery || searchQuery.trim() === '') {
    return text;
  }

  // Очищаем текст от возможных HTML тегов для безопасности
  const cleanText = text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

  const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
  
  if (searchTerms.length === 0) {
    return cleanText;
  }

  const parts = cleanText.split(new RegExp(`(${searchTerms.join('|')})`, 'gi'));

  return parts.map((part, i) => {
    // Проверяем, соответствует ли часть текста одному из поисковых терминов
    const isMatch = searchTerms.some(term => 
      part.toLowerCase() === term.toLowerCase()
    );
    
    return isMatch ? 
      <span key={i} className="bg-orange-500 text-white px-0.5 rounded">
        {part}
      </span> : 
      <span key={i}>{part}</span>;
  });
}
