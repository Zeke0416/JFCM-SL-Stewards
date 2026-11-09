export const PROFILE_PHOTO_UPDATED = 'stewards:profile-photo-updated';
export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
export async function prepareProfilePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > MAX_PROFILE_PHOTO_BYTES) throw new Error('Choose a JPEG, PNG or WebP photo smaller than 5 MB.');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 50000000) throw new Error('Choose a smaller photo.');
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo processing is unavailable.');
    const side = Math.min(bitmap.width, bitmap.height);
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, 256, 256);
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
    const result = canvas.toDataURL('image/jpeg', 0.85);
    if (!result.startsWith('data:image/jpeg;base64,') || result.length > 200000) throw new Error('Choose a simpler or smaller photo.');
    return result;
  } finally { bitmap.close(); }
}
