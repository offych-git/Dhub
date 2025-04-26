export const extractMentions = (text: string): string[] => {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
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

  // Get all mentioned users
  const { data: users } = await supabase
    .from('profiles')
    .select('id, notification_preferences')
    .in('display_name', mentions);

  if (!users || users.length === 0) return;

  // Create notifications for mentioned users who have mentions enabled
  const notifications = users
    .filter(user => user.notification_preferences?.mentions !== false)
    .map(user => ({
      user_id: user.id,
      type: 'mention',
      content,
      source_type: sourceType,
      source_id: sourceId,
      actor_id: actorId
    }));

  if (notifications.length > 0) {
    await supabase
      .from('notifications')
      .insert(notifications);
  }
};