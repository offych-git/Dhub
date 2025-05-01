
export const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
  const img = event.target as HTMLImageElement;
  img.onerror = null; // Prevent infinite loops
  img.src = 'https://via.placeholder.com/400x300?text=Image+Not+Available';
};

export const getValidImageUrl = (url: string) => {
  // Check if it's a Facebook URL (which often gives 403 errors)
  if (url.includes('fbcdn.net') || url.includes('facebook.com')) {
    return 'https://via.placeholder.com/400x300?text=Image+Not+Available';
  }
  return url;
};
