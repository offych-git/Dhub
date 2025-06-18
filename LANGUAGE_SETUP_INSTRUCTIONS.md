# 🌍 Настройка поддержки языков для push-уведомлений

## 📋 Проблема
Ошибка: `column profiles.language does not exist`

## ✅ Решение

### 1. Выполните SQL-скрипт
Откройте Supabase Dashboard → SQL Editor и выполните содержимое файла `ADD_LANGUAGE_COLUMN.sql`:

```sql
-- Add language column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ru';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_language ON profiles(language);

-- Set default language for existing users
UPDATE profiles 
SET language = 'ru' 
WHERE language IS NULL;
```

### 2. Проверьте результат
После выполнения скрипта проверьте структуру таблицы:

```sql
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'language';
```

### 3. Обновите страницу
Перезагрузите админ-панель push-уведомлений - ошибка должна исчезнуть.

## 🎯 Что получите после настройки

- ✅ Фильтрация пользователей по языкам
- ✅ Статистика по языкам в дашборде  
- ✅ Автоматические шаблоны для разных языков
- ✅ Таргетированные уведомления

## 🔧 Временное решение
Код уже содержит fallback-логику:
- Если колонка `language` не найдена, все пользователи считаются русскоязычными
- Система продолжит работать без ошибок

## 📝 Настройка языков пользователей

После добавления колонки вы можете настроить языки пользователей:

```sql
-- Установить английский для пользователей с Gmail
UPDATE profiles SET language = 'en' 
WHERE email LIKE '%@gmail.com';

-- Установить испанский для пользователей из Испании
UPDATE profiles SET language = 'es' 
WHERE email LIKE '%@hotmail.es' OR email LIKE '%@yahoo.es';
```

## 🚀 Готово!
После выполнения SQL-скрипта система push-уведомлений будет полностью поддерживать многоязычность. 