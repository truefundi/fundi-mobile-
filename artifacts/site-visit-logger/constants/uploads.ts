const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  pdf: 'application/pdf',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
  webm: 'video/webm',
};

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_SIZE_LABEL = '5 MB';

export function inferUploadMimeType(uriOrName: string, declaredMimeType?: string | null): string | undefined {
  const declared = declaredMimeType?.trim().toLowerCase();
  if (declared && declared !== 'application/octet-stream') return declared;

  const path = uriOrName.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
  const extension = path.slice(path.lastIndexOf('.') + 1);
  return MIME_TYPES_BY_EXTENSION[extension];
}
