import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { getAccessToken } from '@/lib/auth-session';

export type RequestMediaInput = {
  uri: string;
  name?: string;
  mimeType?: string;
};

const WEB_MEDIA_PREFIX = 'fundi-media://';
const WEB_DATABASE = 'fundi-request-media';
const WEB_STORE = 'attachments';

function openWebMediaDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Persistent attachment storage is not available in this browser.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WEB_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(WEB_STORE)) {
        request.result.createObjectStore(WEB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open attachment storage.'));
    request.onblocked = () => reject(new Error('Attachment storage is blocked by another browser tab.'));
  });
}

function storeWebAttachment(id: string, blob: Blob): Promise<void> {
  return openWebMediaDatabase().then(
    (database) =>
      new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(WEB_STORE, 'readwrite');
        transaction.objectStore(WEB_STORE).put(blob, id);
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? new Error('Could not save the attachment.'));
        };
        transaction.onabort = () => {
          database.close();
          reject(transaction.error ?? new Error('Attachment saving was interrupted.'));
        };
      }),
  );
}

export async function persistRequestMedia(media: RequestMediaInput[]): Promise<string[]> {
  return Promise.all(
    media.map(async (item) => {
      if (item.uri.startsWith(WEB_MEDIA_PREFIX)) return item.uri;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      if (Platform.OS === 'web') {
        const response = await fetch(item.uri);
        if (!response.ok) throw new Error(`Could not read attachment (${response.status}).`);
        const blob = await response.blob();
        if (blob.size === 0) throw new Error('The selected attachment is empty.');
        await storeWebAttachment(id, blob);
        return `${WEB_MEDIA_PREFIX}${id}`;
      }

      const namedExtension = item.name?.split('.').pop()?.match(/^[a-zA-Z0-9]+$/)?.[0];
      const mimeExtension: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
      };
      const extension = namedExtension ?? mimeExtension[item.mimeType ?? ''] ?? 'media';
      const directory = new Directory(Paths.document, 'fundi-attachments');
      if (!directory.exists) directory.create();
      const source = new File(item.uri);
      const destination = new File(directory, `${id}.${extension}`);
      await source.copy(destination);
      return destination.uri;
    }),
  );
}

/** Job attachments served by the API need the user's token, so an <Image> cannot load them directly. */
const PROTECTED_MEDIA = /\/api\/v1\/jobs\/[^/]+\/media\/[^/?#]+/;
const protectedCache = new Map<string, Promise<string>>();
const protectedResolved = new Map<string, string>();

export function isProtectedMediaUri(uri: string): boolean {
  return PROTECTED_MEDIA.test(uri);
}

/** The loaded local address of an attachment, when it has been loaded already. */
export function cachedRequestMediaUri(uri: string): string | undefined {
  return protectedResolved.get(uri);
}

async function loadProtectedMedia(uri: string): Promise<string> {
  const token = await getAccessToken();
  const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
  if (Platform.OS === 'web') {
    const response = await fetch(uri, { headers });
    if (!response.ok) throw new Error(`Could not load the attachment (${response.status}).`);
    return URL.createObjectURL(await response.blob());
  }
  const directory = new Directory(Paths.cache, 'fundi-job-media');
  if (!directory.exists) directory.create();
  const name = uri.match(PROTECTED_MEDIA)?.[0].split('/').slice(-3).join('-') ?? `${Date.now()}`;
  const destination = new File(directory, name);
  if (destination.exists) return destination.uri;
  const file = await File.downloadFileAsync(uri, destination, { headers });
  return file.uri;
}

export async function resolveRequestMediaUri(uri: string): Promise<string> {
  if (isProtectedMediaUri(uri)) {
    let pending = protectedCache.get(uri);
    if (!pending) {
      pending = loadProtectedMedia(uri).then((resolved) => {
        protectedResolved.set(uri, resolved);
        return resolved;
      });
      // A failed load can be retried the next time the attachment is shown.
      pending.catch(() => protectedCache.delete(uri));
      protectedCache.set(uri, pending);
    }
    return pending;
  }
  if (!uri.startsWith(WEB_MEDIA_PREFIX)) return uri;
  const database = await openWebMediaDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(WEB_STORE, 'readonly');
    const request = transaction.objectStore(WEB_STORE).get(uri.slice(WEB_MEDIA_PREFIX.length));
    request.onsuccess = () => {
      database.close();
      if (!(request.result instanceof Blob)) {
        reject(new Error('This saved attachment is no longer available.'));
        return;
      }
      resolve(URL.createObjectURL(request.result));
    };
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error('Could not load the saved attachment.'));
    };
  });
}
