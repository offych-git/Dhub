export const extractMentions = (text: string): string[] => {
  const mentionRegex = /@([a-zA-Z0-9_\.]+)/g;
  const matches = text.match(mentionRegex);
  return matches ? matches.map(match => match.slice(1)) : [];
};

export const createMentionNotification = async (
  supabase: any,
  sourceType: 'deal_comment' | 'promo_comment',
  sourceId: string,
  content: string,
  actorId: string
) => {
  const mentions = extractMentions(content);
  
  if (mentions.length === 0) return;

  console.log('Found mentions:', mentions);

  // Get all mentioned users
  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select('id, notification_preferences, display_name')
    .in('display_name', mentions);

  if (usersError) {
    console.error('Error fetching mentioned users:', usersError);
    return;
  }

  console.log('Found users for mentions:', users);

  if (!users || users.length === 0) return;

  // Create notifications for mentioned users who have mentions enabled
  const notifications = users
    .filter(user => user.id !== actorId) // Don't notify yourself
    .filter(user => user.notification_preferences?.mentions !== false)
    .map(user => ({
      user_id: user.id,
      type: 'mention',
      content,
      source_type: sourceType,
      source_id: sourceId,
      actor_id: actorId
    }));

  console.log('Creating notifications:', notifications);

  if (notifications.length > 0) {
    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);
      
    if (insertError) {
      console.error('Error inserting notifications:', insertError);
    }
  }
};