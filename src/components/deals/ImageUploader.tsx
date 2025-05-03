import React, { useCallback, useState, useRef } from 'react';
import { Image as ImageIcon, X, Upload } from 'lucide-react';
import imageCompression from 'browser-image-compression';

interface ImageUploaderProps {
  onImagesChange: (images: File[]) => void;
  maxImages?: number;
  onMainImageChange?: (index: number) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImagesChange, maxImages = 4, onMainImageChange }) => {
  const [images, setImages] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.2, // 200KB
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.8, // Начальное качество 80%
    };

    try {
      return await imageCompression(file, options);
    } catch (error) {
      console.error('Error compressing image:', error);
      return file;
    }
  };

  const handleImageChange = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const newImages = Array.from(files).filter(file => 
      file.type.startsWith('image/') && 
      images.length + 1 <= maxImages
    );

    if (newImages.length > 0) {
      // Compress all new images
      const compressedImages = await Promise.all(
        newImages.map(file => compressImage(file))
      );

      const updatedImages = [...images, ...compressedImages].slice(0, maxImages);
      setImages(updatedImages);
      onImagesChange(updatedImages);
      
      // Если это первое добавленное изображение и есть обработчик для главного изображения
      if (images.length === 0 && updatedImages.length > 0 && onMainImageChange) {
        onMainImageChange(0);
      }
    }
  }, [images, maxImages, onImagesChange, onMainImageChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleImageChange(e.dataTransfer.files);
  }, [handleImageChange]);

  const removeImage = useCallback((index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onImagesChange(newImages);
    
    // Если удаляем изображение и есть обработчик для главного изображения
    if (onMainImageChange && newImages.length > 0) {
      onMainImageChange(0); // После удаления первое изображение становится главным
    }
  }, [images, onImagesChange, onMainImageChange]);

  // Обработчики для перетаскивания миниатюр
  const handleThumbnailDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    if (e.dataTransfer.setDragImage) {
      const img = new Image();
      img.src = URL.createObjectURL(images[index]);
      e.dataTransfer.setDragImage(img, 0, 0);
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleThumbnailDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleThumbnailDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedItem === null || draggedItem === dropIndex) return;
    
    // Создаем новый порядок изображений
    const newImages = [...images];
    const draggedImage = newImages[draggedItem];
    
    // Удаляем изображение с исходной позиции
    newImages.splice(draggedItem, 1);
    
    // Вставляем его на новую позицию
    newImages.splice(dropIndex, 0, draggedImage);
    
    setImages(newImages);
    onImagesChange(newImages);
    setDraggedItem(null);
    
    // Если первое изображение изменилось и есть обработчик
    if (onMainImageChange) {
      onMainImageChange(0); // Первое изображение всегда главное
    }
  };

  const handleThumbnailDragEnd = () => {
    setDraggedItem(null);
  };

  return (
    <div className="space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center ${
          isDragging ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleImageChange(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center justify-center space-y-2">
          <Upload className="h-8 w-8 text-gray-400" />
          <p className="text-gray-400">
            {images.length > 0
              ? `Drag and drop more images or click to select (${images.length}/${maxImages})`
              : `Drag and drop images or click to select (max ${maxImages})`}
          </p>
        </div>
      </div>

      {images.length > 0 && (
        <>
          {/* Большое изображение */}
          <div className="relative">
            <img
              src={URL.createObjectURL(images[0])}
              alt="Main image"
              className="w-full h-48 object-contain rounded-lg"
            />
            {images.length > 1 && (
              <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                Главное изображение
              </div>
            )}
          </div>

          {/* Миниатюры с возможностью перетаскивания */}
          {images.length > 1 && (
            <div 
              ref={thumbnailsRef}
              className="flex overflow-x-auto space-x-2 py-2"
            >
              {images.map((image, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={(e) => handleThumbnailDragStart(e, index)}
                  onDragOver={(e) => handleThumbnailDragOver(e, index)}
                  onDrop={(e) => handleThumbnailDrop(e, index)}
                  onDragEnd={handleThumbnailDragEnd}
                  className={`relative flex-shrink-0 w-16 h-16 cursor-move ${
                    index === 0 ? 'ring-2 ring-green-500' : ''
                  } ${
                    draggedItem === index ? 'opacity-50' : 'opacity-100'
                  }`}
                >
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-0 right-0 p-1 bg-red-500 rounded-full scale-75"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                  {index === 0 && (
                    <div className="absolute top-0 left-0 bg-green-500 text-white text-xs px-1 py-0.5 rounded-sm">
                      1
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Для мобильного отображения показываем сетку, если нет thumbnail view */}
          {images.length === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="relative group">
                <img
                  src={URL.createObjectURL(images[0])}
                  alt="Uploaded image 1"
                  className="w-full h-32 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => removeImage(0)}
                  className="absolute top-2 right-2 p-1 bg-gray-900/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        /* Стили для полосы прокрутки в миниатюрах */
        div[ref="thumbnailsRef"]::-webkit-scrollbar {
          height: 4px;
        }
        div[ref="thumbnailsRef"]::-webkit-scrollbar-track {
          background: #1f2937;
          border-radius: 10px;
        }
        div[ref="thumbnailsRef"]::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default ImageUploader; 