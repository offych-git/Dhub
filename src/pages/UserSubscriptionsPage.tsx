
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Edit, Save, Search, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Subscription {
  id: string;
  keyword: string;
  created_at: string;
}

const UserSubscriptionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [keyword, setKeyword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKeyword, setEditingKeyword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      loadSubscriptions();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadSubscriptions = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_keyword_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSubscriptions(data || []);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      setError('Failed to load subscriptions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubscription = async () => {
    if (!user?.id || !keyword.trim()) return;
    
    if (keyword.length > 50) {
      setError('Keyword must be less than 50 characters');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      // Check if subscription already exists
      const { data: existing } = await supabase
        .from('user_keyword_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('keyword', keyword.trim())
        .single();
      
      if (existing) {
        setError('You are already subscribed to this keyword');
        return;
      }

      const { error } = await supabase
        .from('user_keyword_subscriptions')
        .insert({
          user_id: user.id,
          keyword: keyword.trim()
        });

      if (error) throw error;

      setKeyword('');
      setSuccess('Subscription added successfully');
      setTimeout(() => setSuccess(null), 3000);
      loadSubscriptions();
    } catch (error: any) {
      console.error('Error adding subscription:', error);
      setError(error.message || 'Failed to add subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubscription = (subscription: Subscription) => {
    setEditingId(subscription.id);
    setEditingKeyword(subscription.keyword);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingKeyword.trim()) return;
    
    if (editingKeyword.length > 50) {
      setError('Keyword must be less than 50 characters');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      // Check if another subscription with same keyword exists
      const { data: existing } = await supabase
        .from('user_keyword_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('keyword', editingKeyword.trim())
        .neq('id', editingId)
        .single();
      
      if (existing) {
        setError('You are already subscribed to this keyword');
        return;
      }

      const { error } = await supabase
        .from('user_keyword_subscriptions')
        .update({ keyword: editingKeyword.trim() })
        .eq('id', editingId)
        .eq('user_id', user.id);

      if (error) throw error;

      setEditingId(null);
      setSuccess('Subscription updated successfully');
      setTimeout(() => setSuccess(null), 3000);
      loadSubscriptions();
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      setError(error.message || 'Failed to update subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    if (!user?.id) return;

    try {
      setIsSubmitting(true);
      setError(null);
      
      const { error } = await supabase
        .from('user_keyword_subscriptions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setSuccess('Subscription deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      loadSubscriptions();
    } catch (error: any) {
      console.error('Error deleting subscription:', error);
      setError(error.message || 'Failed to delete subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const filteredSubscriptions = searchQuery
    ? subscriptions.filter(sub => 
        sub.keyword.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : subscriptions;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <p>Please sign in to access your subscriptions</p>
          <button 
            onClick={() => navigate('/auth')}
            className="mt-4 bg-orange-500 px-4 py-2 rounded-md"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="text-white">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-white font-medium ml-4">My Subscriptions</h1>
        </div>
      </div>

      <div className="px-4 pt-4">
        {error && (
          <div className="bg-red-500/90 text-white px-4 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/90 text-white px-4 py-2 rounded-lg mb-4">
            {success}
          </div>
        )}

        <div className="bg-gray-800 rounded-lg overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-white font-medium">Keyword Subscriptions</h2>
            <p className="text-gray-400 text-sm mt-1">
              Get notified about new deals matching your keywords
            </p>
          </div>
          
          <div className="p-4">
            <div className="flex mb-4">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Enter keyword"
                maxLength={50}
                className="bg-gray-700 text-white px-4 py-2 rounded-lg flex-1 mr-2"
              />
              <button
                onClick={handleAddSubscription}
                disabled={!keyword.trim() || isSubmitting}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 flex items-center"
              >
                <Plus className="h-4 w-4 mr-1" />
                Subscribe
              </button>
            </div>
            {keyword && (
              <div className="text-right text-xs text-gray-400">
                {keyword.length}/50 characters
              </div>
            )}
          </div>
        </div>

        {subscriptions.length > 0 && (
          <div className="mb-4 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search subscriptions"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
            />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>You don't have any subscriptions yet</p>
            <p className="text-sm mt-2">Add keywords to get notified about new deals</p>
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No subscriptions match your search</p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-700">
              {filteredSubscriptions.map((subscription) => (
                <div key={subscription.id} className="p-4">
                  {editingId === subscription.id ? (
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={editingKeyword}
                        onChange={(e) => setEditingKeyword(e.target.value)}
                        className="bg-gray-700 text-white px-3 py-2 rounded flex-1 mr-2"
                        maxLength={50}
                        autoFocus
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={!editingKeyword.trim() || isSubmitting}
                          className="bg-green-500 p-2 rounded text-white hover:bg-green-600 disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="bg-gray-600 p-2 rounded text-white hover:bg-gray-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-white break-all">{subscription.keyword}</h3>
                        <p className="text-gray-400 text-xs mt-1">
                          Added {new Date(subscription.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditSubscription(subscription)}
                          className="text-blue-400 hover:text-blue-300 p-1"
                          disabled={isSubmitting}
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSubscription(subscription.id)}
                          className="text-red-400 hover:text-red-300 p-1"
                          disabled={isSubmitting}
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSubscriptionsPage;
