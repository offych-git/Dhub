# Исправление HTML-сущностей на веб-сайте

**Дата исправления:** 2025-01-15

## 🐛 **Проблема**

На веб-сайте символ `&` (амперсанд) отображался как `&amp;` в заголовках товаров, промокодов и розыгрышей.

**Примеры проблемы:**
- "Средство для стирки Arm&amp;Hammer 42шт" вместо "Средство для стирки Arm&Hammer 42шт"
- "Beauty &amp; Personal care" вместо "Beauty & Personal care"

## ✅ **Решение**

### 🔧 **1. Создан файл `htmlUtils.ts`**

Добавлены функции для декодирования HTML-сущностей:

```typescript
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // ... и другие HTML-сущности
}
```

### 🔧 **2. Применено к компонентам**

#### **DealCard.tsx** (используется в DealsPage и SweepstakesPage)
```typescript
import { decodeHtmlEntities } from "../../utils/htmlUtils";

// В заголовке:
{searchParams.get("q")
  ? highlightText(decodeHtmlEntities(deal.title), searchParams.get("q") || "")
  : decodeHtmlEntities(deal.title)}
```

#### **PromosPage.tsx**
```typescript
import { decodeHtmlEntities } from "../utils/htmlUtils";

// В заголовке промокода:
<h3>{decodeHtmlEntities(promo.title)}</h3>

// В функции share:
navigator.share({
  title: decodeHtmlEntities(promo.title),
  url: promoUrl,
})
```

## 🎯 **Результат**

### ✅ **Исправленные страницы:**
1. **DealsPage** - заголовки товаров теперь корректно отображают `&`
2. **PromosPage** - заголовки промокодов исправлены
3. **SweepstakesPage** - автоматически исправлено через `DealCard`

### ✅ **Дополнительные возможности:**
- Декодирование других HTML-сущностей: `<`, `>`, `"`, `'`, `©`, `®`, `™`
- Поддержка числовых HTML-сущностей
- Функции для автоматического декодирования объектов

## 🚀 **Применение в будущем**

Для новых компонентов используйте:

```typescript
import { decodeHtmlEntities } from "../utils/htmlUtils";

// Для отдельных строк:
const cleanTitle = decodeHtmlEntities(item.title);

// Для объектов (автоматически обрабатывает title и description):
const cleanItem = autoDecodeHtmlInObject(item);
```

## 📋 **Проверка**

Теперь на всех страницах веб-сайта:
- ✅ "Arm&Hammer" отображается корректно
- ✅ "Beauty & Personal care" отображается корректно  
- ✅ Другие HTML-сущности также декодируются правильно 