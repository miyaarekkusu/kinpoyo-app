import * as FileSystem from 'expo-file-system/legacy';

const VIDEO_DIR = `${FileSystem.documentDirectory}videos/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(VIDEO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(VIDEO_DIR, { intermediates: true });
  }
}

/**
 * Copy a freshly recorded video out of the tmp directory into
 * the app's persistent document directory so it survives app restarts.
 * Returns the new file:// URI.
 */
export async function persistVideo(srcUri: string, id: string): Promise<string> {
  await ensureDir();
  const ext = srcUri.split('.').pop() || 'mp4';
  const destUri = `${VIDEO_DIR}${id}.${ext}`;
  await FileSystem.copyAsync({ from: srcUri, to: destUri });
  return destUri;
}

export async function deleteVideo(uri: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // best-effort
  }
}
