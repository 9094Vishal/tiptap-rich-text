import { Extension, type Editor } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import {
  ATTACHMENT_NODE_TYPES,
  ATTACHMENT_NODE_TYPE_LIST,
  BLOB_URL_PREFIX,
  DEFAULT_ACCEPTED_FILE_TYPES,
  DEFAULT_MAX_FILE_SIZE_MB,
  DEFAULT_MAX_FILES_PER_BATCH,
  MAX_CONCURRENT_UPLOADS,
  UPLOAD_ERROR_MESSAGES,
  UPLOAD_STATUS,
} from './constants';
import { generateAttachmentId, isImageMime, validateFile } from './fileUtils';

export interface UploadProgress {
  onProgress: (percent: number) => void;
  signal: AbortSignal | undefined;
}

export interface UploadResult {
  id?: string;
  url: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

export type OnUploadRequest = (file: File, progress: UploadProgress) => Promise<UploadResult>;
export type OnUploadError = (file: File | null, error: Error) => void;

export interface Attachment {
  id: string | null;
  type: 'image' | 'file';
  url: string;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
}

interface RegistryEntry {
  file: File;
  abortController: AbortController | null;
  status: (typeof UPLOAD_STATUS)[keyof typeof UPLOAD_STATUS];
}

export interface AttachmentManagerOptions {
  enabled: boolean;
  onUploadRequest: OnUploadRequest | null;
  onUploadError: OnUploadError | null;
  maxFileSizeMB: number;
  acceptedFileTypes: string[];
  maxFilesPerBatch: number;
}

export interface AttachmentManagerStorage {
  options: AttachmentManagerOptions | null;
  registry: Map<string, RegistryEntry>;
  queue: string[];
  activeCount: number;
  listeners: Set<() => void>;
  uploadedThisSession: Set<string>;
  stagedFiles: Map<string, File>;
}

declare module '@tiptap/core' {
  interface Storage {
    attachmentManager: AttachmentManagerStorage;
  }
}

/**
 * AttachmentManager — the single source of truth for every file currently
 * uploading in this editor instance. Node views never talk to
 * onUploadRequest directly; they go through here so drag/drop, paste, the
 * toolbar and the slash command all share one registry, one concurrency
 * queue, and one cleanup path.
 */
export const AttachmentManager = Extension.create<AttachmentManagerOptions, AttachmentManagerStorage>({
  name: 'attachmentManager',

  addOptions() {
    return {
      enabled: false,
      onUploadRequest: null,
      onUploadError: null,
      maxFileSizeMB: DEFAULT_MAX_FILE_SIZE_MB,
      acceptedFileTypes: DEFAULT_ACCEPTED_FILE_TYPES,
      maxFilesPerBatch: DEFAULT_MAX_FILES_PER_BATCH,
    };
  },

  addStorage() {
    return {
      options: null,
      registry: new Map(),
      queue: [],
      activeCount: 0,
      listeners: new Set(),
      // Server-side ids for every upload that completed in this editor
      // instance, for as long as it lives — unlike `registry`, never
      // shrinks when a node is removed from the doc. Undo/backspace/the
      // delete button all just remove the node; none of them know to
      // clean up the now-orphaned server-side file. Consumers diff this
      // against the doc's current attachment ids at save/cancel/unmount
      // time to find uploads that were removed before ever being saved.
      uploadedThisSession: new Set(),
      // attachmentId -> File, for files staged in deferred-upload mode
      // (see insertStagedFiles) that haven't been uploaded yet. Held only
      // for this tab session — nothing here is ever written to disk.
      stagedFiles: new Map(),
    };
  },

  onCreate() {
    this.storage.options = this.options;
  },

  onDestroy() {
    this.storage.registry.forEach((entry) => {
      try {
        entry.abortController?.abort();
      } catch {
        /* ignore */
      }
    });
    this.storage.registry.clear();
    this.storage.queue = [];
    this.storage.listeners.clear();
    this.storage.stagedFiles.clear();
  },
});

const notify = (storage: AttachmentManagerStorage) => {
  storage.listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore listener errors */
    }
  });
};

export const subscribeToPendingCount = (editor: Editor | null, fn: () => void): (() => void) => {
  const storage = editor?.storage?.attachmentManager;
  if (!storage) return () => {};
  storage.listeners.add(fn);
  return () => storage.listeners.delete(fn);
};

export const getPendingAttachmentsCount = (editor: Editor | null): number => {
  const storage = editor?.storage?.attachmentManager;
  if (!storage) return 0;
  let count = 0;
  storage.registry.forEach((entry) => {
    if (entry.status === UPLOAD_STATUS.QUEUED || entry.status === UPLOAD_STATUS.UPLOADING) count += 1;
  });
  return count;
};

export const getResolvedAttachments = (editor: Editor | null): Attachment[] => {
  if (!editor || editor.isDestroyed) return [];
  const attachments: Attachment[] = [];
  editor.state.doc.descendants((node) => {
    if (!ATTACHMENT_NODE_TYPE_LIST.includes(node.type.name)) return;
    if (node.attrs.uploading || node.attrs.error || node.attrs.staged) return;

    // Deliberately not gated on attachmentId — that's the client-local
    // upload-tracking id, and it's null for anything loaded from
    // previously-saved content rather than uploaded this session. Gate
    // on having a real URL instead.
    const url = node.attrs.url || node.attrs.src;
    if (!url) return;

    attachments.push({
      id: node.attrs.id || null,
      type: node.type.name === ATTACHMENT_NODE_TYPES.IMAGE ? 'image' : 'file',
      url,
      fileName: node.attrs.fileName,
      fileSize: node.attrs.fileSize,
      mimeType: node.attrs.mimeType,
    });
  });
  return attachments;
};

export const getAttachmentIds = (editor: Editor | null): string[] =>
  getResolvedAttachments(editor)
    .map((a) => a.id)
    .filter((id): id is string => Boolean(id));

/**
 * Every server-side attachment id uploaded in this editor instance so far,
 * including ones no longer present in the doc (removed via undo, backspace,
 * or the delete button after the upload already completed). Consumers
 * should treat any id here that's missing from `getAttachmentIds()` at
 * save/cancel/unmount time as orphaned and delete it server-side.
 */
export const getSessionUploadedIds = (editor: Editor | null): string[] => {
  const storage = editor?.storage?.attachmentManager;
  return storage ? Array.from(storage.uploadedThisSession) : [];
};

export const isOrphanedUpload = (editor: Editor | null, attachmentId: string): boolean => {
  const storage = editor?.storage?.attachmentManager;
  if (!storage) return false;
  // A staged file being uploaded by uploadStagedFiles() lives in
  // stagedFiles, not registry — without this check every staged node's
  // own mount effect would see uploading:true, find nothing in registry,
  // and immediately (and wrongly) flag itself as an interrupted upload
  // the instant the real upload started.
  return !storage.registry.has(attachmentId) && !storage.stagedFiles.has(attachmentId);
};

/**
 * Undo can restore a node with `uploading: true` whose in-flight request
 * was already aborted when it was deleted. Called by node views on mount
 * to convert that stale state into an explicit, retryable error instead
 * of a spinner that never resolves.
 */
export const markUploadInterrupted = (editor: Editor, attachmentId: string) => {
  updateAttachmentAttrs(editor, attachmentId, { uploading: false, error: UPLOAD_ERROR_MESSAGES.INTERRUPTED });
};

const findNodePos = (editor: Editor, attachmentId: string): { pos: number | null; node: PMNode | null } => {
  let pos: number | null = null;
  let node: PMNode | null = null;
  editor.state.doc.descendants((n, p) => {
    if (pos !== null) return false;
    if (n.attrs && n.attrs.attachmentId === attachmentId) {
      pos = p;
      node = n;
    }
    return true;
  });
  return { pos, node };
};

const updateAttachmentAttrs = (editor: Editor, attachmentId: string, patch: Record<string, unknown>) => {
  if (!editor || editor.isDestroyed) return;
  const { pos, node } = findNodePos(editor, attachmentId);
  if (pos === null || !node) return;
  const tr = editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...patch });
  tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
};

const revokeIfBlob = (url: unknown) => {
  if (typeof url === 'string' && url.startsWith(BLOB_URL_PREFIX)) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
};

const buildNode = (file: File, { staged = false }: { staged?: boolean } = {}) => {
  const attachmentId = generateAttachmentId();
  const common = {
    attachmentId,
    staged,
    uploading: !staged,
    progress: 0,
    error: null,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  };

  if (isImageMime(file.type)) {
    const dotIndex = file.name.lastIndexOf('.');
    const alt = dotIndex > 0 ? file.name.slice(0, dotIndex) : file.name;
    return {
      attachmentId,
      node: { type: ATTACHMENT_NODE_TYPES.IMAGE, attrs: { ...common, src: URL.createObjectURL(file), alt } },
    };
  }

  return {
    attachmentId,
    node: { type: ATTACHMENT_NODE_TYPES.FILE_ATTACHMENT, attrs: { ...common, url: null } },
  };
};

/**
 * Inserts the given attachment nodes and makes sure the cursor ends up in
 * an editable text position right after them. image/fileAttachment are
 * both block atoms — ProseMirror's default post-insert selection has
 * nothing to land a text cursor on unless a textblock already follows, so
 * left alone it stays a NodeSelection sitting on the file itself (reads
 * as "focus stuck on the attachment" instead of "ready to keep typing").
 * Adds an empty paragraph after it when nothing suitable is already there.
 */
const insertNodesWithCursorAfter = (
  editor: Editor,
  nodes: Array<{ type: string; attrs: Record<string, unknown> }>,
  at: number | undefined
) => {
  const chain = editor.chain().focus();
  if (typeof at === 'number') {
    chain.insertContentAt(at, nodes);
  } else {
    chain.insertContent(nodes);
  }

  chain.command(({ tr, state, dispatch }) => {
    if (!dispatch) return true;
    const { selection } = state;
    if (!(selection instanceof NodeSelection) || !ATTACHMENT_NODE_TYPE_LIST.includes(selection.node.type.name)) {
      return true;
    }

    const afterPos = selection.to;
    const nextNode = tr.doc.nodeAt(afterPos);
    if (!nextNode || !nextNode.isTextblock) {
      tr.insert(afterPos, state.schema.nodes.paragraph.create());
    }
    tr.setSelection(TextSelection.create(tr.doc, afterPos + 1));
    return true;
  });

  chain.run();
};

const processQueue = (editor: Editor) => {
  const storage = editor.storage.attachmentManager;
  const options = storage.options!;

  while (storage.activeCount < MAX_CONCURRENT_UPLOADS && storage.queue.length) {
    const attachmentId = storage.queue.shift()!;
    const entry = storage.registry.get(attachmentId);
    if (!entry) continue;
    storage.activeCount += 1;
    void startUpload(editor, attachmentId, entry, options);
  }
};

const startUpload = async (
  editor: Editor,
  attachmentId: string,
  entry: RegistryEntry,
  options: AttachmentManagerOptions
) => {
  const storage = editor.storage.attachmentManager;
  entry.status = UPLOAD_STATUS.UPLOADING;
  entry.abortController = new AbortController();

  try {
    const result = await options.onUploadRequest!(entry.file, {
      onProgress: (percent) => updateAttachmentAttrs(editor, attachmentId, { progress: percent }),
      signal: entry.abortController.signal,
    });

    if (!storage.registry.has(attachmentId)) {
      // Deleted while uploading — the delete handler already aborted/cleaned up.
      return;
    }

    if (result.id) storage.uploadedThisSession.add(result.id);

    const { pos, node } = findNodePos(editor, attachmentId);
    if (pos !== null && node) {
      const oldSrc = node.attrs.src;
      updateAttachmentAttrs(editor, attachmentId, {
        uploading: false,
        progress: 100,
        error: null,
        id: result.id ?? node.attrs.id,
        url: result.url,
        ...(node.type.name === ATTACHMENT_NODE_TYPES.IMAGE ? { src: result.url } : {}),
        fileName: result.fileName || node.attrs.fileName,
        fileSize: result.fileSize ?? node.attrs.fileSize,
        mimeType: result.mimeType || node.attrs.mimeType,
      });
      revokeIfBlob(oldSrc);
    }
    storage.registry.delete(attachmentId);
  } catch (err) {
    if (entry.abortController?.signal.aborted) {
      // Intentional cancel (delete mid-upload) — no error surfaced.
      return;
    }
    const message = err instanceof Error ? err.message : UPLOAD_ERROR_MESSAGES.GENERIC;
    updateAttachmentAttrs(editor, attachmentId, { uploading: false, error: message });
    entry.status = UPLOAD_STATUS.ERROR;
    options.onUploadError?.(entry.file, err instanceof Error ? err : new Error(message));
  } finally {
    storage.activeCount = Math.max(0, storage.activeCount - 1);
    notify(storage);
    processQueue(editor);
  }
};

export const insertFiles = (editor: Editor | null, fileList: FileList | File[], { at }: { at?: number } = {}) => {
  const storage = editor?.storage?.attachmentManager;
  const options = storage?.options;
  if (!editor || !storage || !options?.enabled || !options.onUploadRequest) return;

  let files = Array.from(fileList || []);
  if (!files.length) return;

  if (files.length > options.maxFilesPerBatch) {
    options.onUploadError?.(null, new Error(UPLOAD_ERROR_MESSAGES.BATCH_TOO_LARGE(options.maxFilesPerBatch)));
    files = files.slice(0, options.maxFilesPerBatch);
  }

  const nodes: Array<{ type: string; attrs: Record<string, unknown> }> = [];
  files.forEach((file) => {
    const { valid, error } = validateFile(file, {
      maxFileSizeMB: options.maxFileSizeMB,
      acceptedFileTypes: options.acceptedFileTypes,
    });
    if (!valid) {
      options.onUploadError?.(file, new Error(error ?? UPLOAD_ERROR_MESSAGES.GENERIC));
      return;
    }

    const { attachmentId, node } = buildNode(file);
    storage.registry.set(attachmentId, { file, abortController: null, status: UPLOAD_STATUS.QUEUED });
    storage.queue.push(attachmentId);
    nodes.push(node);
  });

  if (!nodes.length) return;

  insertNodesWithCursorAfter(editor, nodes, at);

  notify(storage);
  processQueue(editor);
};

export const retryUpload = (editor: Editor | null, attachmentId: string) => {
  const storage = editor?.storage?.attachmentManager;
  if (!editor || !storage) return;

  // Deferred/staged file — nothing to retry right now: the actual attempt
  // happens automatically the next time uploadStagedFiles() runs. Retry
  // here just clears the error so the node looks normal again.
  if (storage.stagedFiles.has(attachmentId)) {
    updateAttachmentAttrs(editor, attachmentId, { error: null });
    return;
  }

  const entry = storage.registry.get(attachmentId);
  if (!entry) return;

  entry.status = UPLOAD_STATUS.QUEUED;
  entry.abortController = null;
  updateAttachmentAttrs(editor, attachmentId, { uploading: true, progress: 0, error: null });
  storage.queue.push(attachmentId);
  notify(storage);
  processQueue(editor);
};

/**
 * Deferred-upload counterpart to insertFiles: validates and inserts the
 * node exactly the same way — same inline position, same local preview —
 * but never calls onUploadRequest. The file is held in memory only, on
 * this editor instance; nothing server-side happens until
 * uploadStagedFiles() runs at actual submit time.
 */
export const insertStagedFiles = (
  editor: Editor | null,
  fileList: FileList | File[],
  { at }: { at?: number } = {}
) => {
  const storage = editor?.storage?.attachmentManager;
  const options = storage?.options;
  if (!editor || !storage || !options?.enabled || !options.onUploadRequest) return;

  let files = Array.from(fileList || []);
  if (!files.length) return;

  if (files.length > options.maxFilesPerBatch) {
    options.onUploadError?.(null, new Error(UPLOAD_ERROR_MESSAGES.BATCH_TOO_LARGE(options.maxFilesPerBatch)));
    files = files.slice(0, options.maxFilesPerBatch);
  }

  const nodes: Array<{ type: string; attrs: Record<string, unknown> }> = [];
  files.forEach((file) => {
    const { valid, error } = validateFile(file, {
      maxFileSizeMB: options.maxFileSizeMB,
      acceptedFileTypes: options.acceptedFileTypes,
    });
    if (!valid) {
      options.onUploadError?.(file, new Error(error ?? UPLOAD_ERROR_MESSAGES.GENERIC));
      return;
    }

    const { attachmentId, node } = buildNode(file, { staged: true });
    storage.stagedFiles.set(attachmentId, file);
    nodes.push(node);
  });

  if (!nodes.length) return;

  insertNodesWithCursorAfter(editor, nodes, at);
};

/**
 * Uploads every currently-staged file — called at actual submit time.
 * Resolves once all of them have either succeeded (node patched in place
 * with its real id/url, same shape as the immediate-upload path) or the
 * whole call rejects on the first failure, leaving failed nodes staged
 * with an error so the caller can surface it and let the user retry.
 */
export const uploadStagedFiles = async (editor: Editor | null): Promise<string[]> => {
  const storage = editor?.storage?.attachmentManager;
  const options = storage?.options;
  if (!editor || !storage || !options?.onUploadRequest || editor.isDestroyed) return getAttachmentIds(editor);

  const stagedIds: string[] = [];
  editor.state.doc.descendants((node) => {
    if (ATTACHMENT_NODE_TYPE_LIST.includes(node.type.name) && node.attrs.staged) {
      stagedIds.push(node.attrs.attachmentId);
    }
  });

  if (!stagedIds.length) return getAttachmentIds(editor);

  await Promise.all(
    stagedIds.map(async (attachmentId) => {
      const file = storage.stagedFiles.get(attachmentId);
      if (!file) {
        // Node survived (e.g. an editor remount) but its File didn't —
        // nothing in-memory to upload.
        updateAttachmentAttrs(editor, attachmentId, { uploading: false, error: UPLOAD_ERROR_MESSAGES.INTERRUPTED });
        throw new Error(UPLOAD_ERROR_MESSAGES.INTERRUPTED);
      }

      updateAttachmentAttrs(editor, attachmentId, { uploading: true, error: null });

      try {
        const result = await options.onUploadRequest!(file, {
          onProgress: (percent) => updateAttachmentAttrs(editor, attachmentId, { progress: percent }),
          signal: undefined,
        });

        if (result.id) storage.uploadedThisSession.add(result.id);

        const { pos, node } = findNodePos(editor, attachmentId);
        if (pos !== null && node) {
          const oldSrc = node.attrs.src;
          updateAttachmentAttrs(editor, attachmentId, {
            uploading: false,
            staged: false,
            progress: 100,
            error: null,
            id: result.id ?? node.attrs.id,
            url: result.url,
            ...(node.type.name === ATTACHMENT_NODE_TYPES.IMAGE ? { src: result.url } : {}),
            fileName: result.fileName || node.attrs.fileName,
            fileSize: result.fileSize ?? node.attrs.fileSize,
            mimeType: result.mimeType || node.attrs.mimeType,
          });
          revokeIfBlob(oldSrc);
        }
        storage.stagedFiles.delete(attachmentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : UPLOAD_ERROR_MESSAGES.GENERIC;
        // staged stays true (untouched) — the file is still held locally,
        // so the next submit attempt will pick it back up automatically.
        updateAttachmentAttrs(editor, attachmentId, { uploading: false, error: message });
        options.onUploadError?.(file, err instanceof Error ? err : new Error(message));
        throw err;
      }
    })
  );

  return getAttachmentIds(editor);
};

/** Called by a node view when its node is removed from the document. */
export const abortUpload = (editor: Editor | null, attachmentId: string) => {
  const storage = editor?.storage?.attachmentManager;
  if (!storage) return;

  // Staged (deferred, not yet uploaded) — just drop the in-memory File,
  // nothing to abort server-side since nothing was ever sent.
  if (storage.stagedFiles.has(attachmentId)) {
    storage.stagedFiles.delete(attachmentId);
    return;
  }

  const entry = storage.registry.get(attachmentId);
  if (!entry) return;

  try {
    entry.abortController?.abort();
  } catch {
    /* ignore */
  }
  storage.registry.delete(attachmentId);
  notify(storage);
};
