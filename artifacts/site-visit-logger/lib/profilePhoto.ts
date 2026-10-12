import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/** What came back from the picker: a picture, a refused permission, or the person backing out. */
export type PhotoResult = { uri: string } | { denied: true } | { cancelled: true };

/** Long edge of a profile picture on web, where it is stored inline. */
const WEB_SIZE = 320;

/**
 * On web the picker's own address for the file stops working once it returns,
 * so the picture is read from its data and shrunk to a small JPEG data URL
 * that also survives a reload.
 */
function shrinkForWeb(source: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(1, WEB_SIZE / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('canvas'));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => reject(new Error('image'));
    image.src = source;
  });
}

/**
 * Picks a square profile picture from the gallery or the camera.
 *
 * The picture stays on the device until the backend's upload endpoint exists;
 * then the uploaded URL replaces it on the account.
 */
export async function pickProfilePhoto(source: 'library' | 'camera'): Promise<PhotoResult> {
  if (Platform.OS !== 'web') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { denied: true };
  }
  const web = Platform.OS === 'web';
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: web };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset?.uri) return { cancelled: true };
  if (!web) return { uri: asset.uri };
  const data = asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;
  return { uri: await shrinkForWeb(data) };
}
