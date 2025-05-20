
import React from 'react';

export const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
  const img = event.target as HTMLImageElement;
  img.onerror = null; // Prevent infinite loops
  img.src = 'https://placehold.co/400x300?text=Image+Not+Available';
};

export const getValidImageUrl = (url: string) => {
  // Check if it's empty or undefined
  if (!url || url.trim() === '') {
    return 'https://placehold.co/400x300?text=No+Image';
  }

  // Check if it's a Facebook URL (which often gives 403 errors)
  if (url.includes('fbcdn.net') || url.includes('facebook.com')) {
    return 'https://placehold.co/400x300?text=Image+Not+Available';
  }
  
  return url;
};
