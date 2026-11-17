import { useEffect, useState } from 'react';
import { cachedRequestMediaUri, isProtectedMediaUri, resolveRequestMediaUri } from '@/lib/requestMedia';

export function useRequestMediaUri(uri: string): string | null {
  const [resolvedUri, setResolvedUri] = useState<string | null>(() => cachedRequestMediaUri(uri) ?? null);
  // Loaded API attachments are shared and cached for the session, so they are never revoked here.
  const shared = isProtectedMediaUri(uri);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setResolvedUri(cachedRequestMediaUri(uri) ?? null);
    resolveRequestMediaUri(uri)
      .then((resolved) => {
        if (!active) {
          if (!shared && resolved.startsWith('blob:')) URL.revokeObjectURL(resolved);
          return;
        }
        if (!shared && resolved.startsWith('blob:')) objectUrl = resolved;
        setResolvedUri(resolved);
      })
      .catch((error: unknown) => {
        console.error('Unable to load saved request attachment.', error);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [uri, shared]);

  return resolvedUri;
}
