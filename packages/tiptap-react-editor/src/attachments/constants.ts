export const DEFAULT_MAX_FILE_SIZE_MB = 10;
export const DEFAULT_MAX_FILES_PER_BATCH = 10;
export const MAX_CONCURRENT_UPLOADS = 3;

export const UPLOAD_STATUS = {
  QUEUED: 'queued',
  UPLOADING: 'uploading',
  ERROR: 'error',
} as const;

export const ATTACHMENT_NODE_TYPES = {
  IMAGE: 'image',
  FILE_ATTACHMENT: 'fileAttachment',
} as const;

export const ATTACHMENT_NODE_TYPE_LIST: string[] = Object.values(ATTACHMENT_NODE_TYPES);

export const BLOB_URL_PREFIX = 'blob:';

// Allowlist by design — never a blocklist. A mix of extensions and MIME
// wildcards, same shape as an <input accept> value — matched against
// whichever a given file actually reports (see matchesAcceptedType in
// fileUtils.ts): extensions exist specifically for types with no
// reliable, consistent MIME across OS/browser (e.g. .js/.jsx).
export const DEFAULT_ACCEPTED_FILE_TYPES = [
  'image/*',
  'video/*',
  'audio/*',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  '.zip',
  '.rar',
];

export const UPLOAD_ERROR_MESSAGES = {
  TOO_LARGE: (maxFileSizeMB: number) => `File exceeds the ${maxFileSizeMB} MB limit.`,
  UNSUPPORTED_TYPE: "This file type isn't supported.",
  UNKNOWN_TYPE: "Couldn't determine this file's type — try again.",
  BATCH_TOO_LARGE: (maxFilesPerBatch: number) => `You can attach up to ${maxFilesPerBatch} files at once.`,
  INTERRUPTED: 'Upload was interrupted — please re-add this file.',
  GENERIC: 'Upload failed.',
};
