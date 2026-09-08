import './Editor.css';

export { Editor } from './Editor';
export type { EditorProps, EditorHandle } from './Editor';
export { RichTextPreview } from './RichTextPreview';
export type {
  RichTextPreviewProps,
  MentionClickData,
  ImageClickData,
  FileClickData,
} from './RichTextPreview';
export { TOOLBAR_KEYS, DEFAULT_TOOLBAR_ITEMS } from './toolbarConfig';
export type { ToolbarKey, ToolbarItems } from './toolbarConfig';
export type { MentionItem, MentionFetchFn } from './mentions';
export type {
  Attachment,
  OnUploadRequest,
  OnUploadError,
  UploadResult,
  UploadProgress,
} from './attachments/AttachmentManager';
export {
  DEFAULT_ACCEPTED_FILE_TYPES,
  DEFAULT_MAX_FILE_SIZE_MB,
  DEFAULT_MAX_FILES_PER_BATCH,
} from './attachments/constants';
export { compareRichTextSnapshots } from './diff';
export type { DiffSchemaOptions } from './diff';
export { useEditor, EditorContent } from '@tiptap/react';
export type { Editor as TiptapEditor } from '@tiptap/react';
export type { AnyExtension } from '@tiptap/core';
