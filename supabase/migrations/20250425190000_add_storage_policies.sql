/*
  # Add storage policies for deal-images bucket

  1. Changes
    - Add policies for deal-images bucket
    - Allow authenticated users to upload images
    - Allow public read access to images
    - Allow users to manage their own images

  2. Security
    - Enable RLS on storage
    - Add policies for authenticated users
*/

-- Enable RLS on storage
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies for deal-images bucket
CREATE POLICY "Allow public read access to deal images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'deal-images');

CREATE POLICY "Allow authenticated users to upload images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'deal-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Allow users to update their own images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'deal-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Allow users to delete their own images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'deal-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  ); 