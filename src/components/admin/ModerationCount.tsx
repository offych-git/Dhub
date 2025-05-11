import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useModeration } from '../../contexts/ModerationContext';

const ModerationCount: React.FC = () => {
  const [count, setCount] = useState<number | null>(null);
  const { queueCount } = useModeration();

  useEffect(() => {
    // Если есть счетчик из контекста модерации, используем его
    if (queueCount !== undefined) {
      setCount(queueCount);
    } else {
      // Иначе выполняем прямой запрос к базе данных
      fetchCount();
    }
  }, [queueCount]);

  const fetchCount = async () => {
    try {
      const { count, error } = await supabase
        .from('moderation_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) {
        console.error('Error fetching moderation count:', error);
        return;
      }

      setCount(count || 0);
    } catch (error) {
      console.error('Error in fetchCount:', error);
    }
  };

  return (
    <span className="inline-flex items-center">
      {count !== null ? (
        <span>
          {' '} 
          (<span className="text-orange-500">{count}</span> на модерации)
        </span>
      ) : (
        <span> (0 на модерации)</span>
      )}
    </span>
  );
};

export default ModerationCount;