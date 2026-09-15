// Shared fallback for pickers whose asset shape has no fileSize field of its
// own (expo-media-library's Asset class, chat's picked-video/image path when
// the OS declined to report it) — reads the size off the filesystem instead
// of silently treating "unknown" as "under the limit".
import { File } from 'expo-file-system'

export async function getFileSizeSafe(uri: string): Promise<number | undefined> {
  try {
    const file = new File(uri)
    return file.exists ? file.size ?? undefined : undefined
  } catch {
    return undefined
  }
}
