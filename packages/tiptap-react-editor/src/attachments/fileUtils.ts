import { UPLOAD_ERROR_MESSAGES } from './constants';

let idCounter = 0;
export const generateAttachmentId = (): string => {
  idCounter += 1;
  return `att-${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
};

export const isImageMime = (mimeType: string | undefined | null): boolean =>
  Boolean(mimeType) && mimeType!.startsWith('image/');

export const getFileExtension = (fileName = ''): string => {
  const parts = fileName.split('.');
  return parts.length > 1 ? (parts.pop() as string).toUpperCase() : '';
};

export const formatFileSize = (bytes: number | null | undefined): string => {
  if (bytes == null || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Same shape as an <input accept> value, so it's matched the same way a
 * browser's own file picker filters: a `.ext` pattern checks the file's
 * extension, everything else (a bare MIME type or a `type/*` wildcard)
 * checks file.type.
 */
const matchesAcceptedType = (file: File, acceptedFileTypes: string[]): boolean => {
  const mimeType = file.type || '';
  const extension = getFileExtension(file.name).toLowerCase();

  return acceptedFileTypes.some((pattern) => {
    if (pattern.startsWith('.')) return extension === pattern.slice(1).toLowerCase();
    if (pattern.endsWith('/*')) return mimeType.startsWith(pattern.slice(0, -1));
    return mimeType === pattern;
  });
};

export interface FileValidationResult {
  valid: boolean;
  error: string | null;
}

/**
 * Client-side validation only — the UX gate, never the security boundary.
 * The backend must independently validate content-type/size before
 * accepting an upload.
 */
export const validateFile = (
  file: File,
  { maxFileSizeMB, acceptedFileTypes }: { maxFileSizeMB: number; acceptedFileTypes: string[] }
): FileValidationResult => {
  if (!file.type && !getFileExtension(file.name)) {
    return { valid: false, error: UPLOAD_ERROR_MESSAGES.UNKNOWN_TYPE };
  }

  if (!matchesAcceptedType(file, acceptedFileTypes)) {
    return { valid: false, error: UPLOAD_ERROR_MESSAGES.UNSUPPORTED_TYPE };
  }

  const maxBytes = maxFileSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { valid: false, error: UPLOAD_ERROR_MESSAGES.TOO_LARGE(maxFileSizeMB) };
  }

  return { valid: true, error: null };
};
