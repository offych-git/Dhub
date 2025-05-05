
import { supabase } from '../lib/supabase';

/**
 * Utility function to clean up user data before account deletion
 * This is helpful for fully removing all user-related data
 */
export const cleanupUserData = async (userId: string) => {
  try {
    console.log('Cleaning up user data for:', userId);
    
    // Clean up user's deal favorites
    await supabase
      .from('deal_favorites')
      .delete()
      .eq('user_id', userId);
      
    // Clean up user's promo favorites
    await supabase
      .from('promo_favorites')
      .delete()
      .eq('user_id', userId);
      
    // Clean up user's comments
    await supabase
      .from('deal_comments')
      .delete()
      .eq('user_id', userId);
      
    await supabase
      .from('promo_comments')
      .delete()
      .eq('user_id', userId);
      
    return { success: true };
  } catch (error) {
    console.error('Error cleaning up user data:', error);
    return { success: false, error };
  }


/**
 * NOTE: Complete account deletion requires backend implementation
 * 
 * This function currently only deletes related data and profile record,
 * but does NOT delete the auth.users record in Supabase.
 * 
 * For complete account deletion, you need to implement a server-side function
 * using Supabase Admin API with the service role key.
 */

};

/**
 * Check if a user exists in the database
 */
export const checkUserExists = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
      
    if (error) {
      return { exists: false, error };
    }
    
    return { exists: !!data, data };
  } catch (error) {
    console.error('Error checking if user exists:', error);
    return { exists: false, error };
  }
};
