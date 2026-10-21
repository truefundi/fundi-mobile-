import { useEffect, useState } from 'react';
import { resolveRequestMediaUri } from '@/lib/requestMedia';

export function useRequestMediaUri(uri: string): string | null {
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setResolvedUri(null);
    resolveRequestMediaUri(uri)
      .then((resolved) => {
        if (!active) {
          if (resolved.startsWith('blob:')) URL.revokeObjectURL(resolved);
          return;
        }
        if (resolved.startsWith('blob:')) objectUrl = resolved;
        setResolvedUri(resolved);
      })
      .catch((error: unknown) => {
        console.error('Unable to load saved request attachment.', error);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [uri]);

  return resolvedUri;
}
