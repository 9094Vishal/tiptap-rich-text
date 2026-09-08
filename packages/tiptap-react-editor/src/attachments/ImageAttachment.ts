import Image from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageAttachmentView } from './ImageAttachmentView';
import { formatFileSize } from './fileUtils';
import { ATTACHMENT_NODE_TYPES } from './constants';

/**
 * Extends the stock Image node with upload lifecycle attrs. `uploading`,
 * `progress`, `error` and `attachmentId` are all `rendered: false` — they
 * never make it into saved HTML, so a node persisted mid-upload
 * round-trips as a plain <img src="blob:..."> on reload (a broken-image
 * icon, not a spinner stuck mid-progress) rather than resurrecting stale
 * client-only state.
 *
 * fileName/fileSize *do* render — wrapped around the <img> as a caption.
 * A bare <img> (no wrapper) is still accepted on parse for anything saved
 * before this existed, or pasted in from elsewhere.
 */
export const ImageAttachment = Image.extend({
  name: ATTACHMENT_NODE_TYPES.IMAGE,

  addAttributes() {
    return {
      ...this.parent?.(),
      // Backend attachment id — the durable reference. Baked into saved
      // HTML as data-id so a reopened document still knows which record
      // this image is, independent of whatever URL is currently stored.
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-id'),
        renderHTML: (attributes: Record<string, unknown>) => (attributes.id ? { 'data-id': attributes.id } : {}),
      },
      // attachmentId is the client-local tracking id (upload registry
      // lookups only) — distinct from `id`, the backend's id above.
      attachmentId: { default: null, rendered: false },
      // True for a file staged in deferred-upload mode (see
      // AttachmentManager.ts) that hasn't been uploaded yet — held only
      // in memory for the current tab session, same lifecycle as
      // uploading/progress/error below.
      staged: { default: false, rendered: false },
      uploading: { default: false, rendered: false },
      progress: { default: 0, rendered: false },
      error: { default: null, rendered: false },
      // Read directly out of node.attrs inside this node's own custom
      // renderHTML below, not via the auto-merged HTMLAttributes — so
      // rendered:false here just avoids these leaking onto the <img> tag
      // itself as redundant non-standard attributes.
      fileName: { default: null, rendered: false },
      fileSize: { default: null, rendered: false },
      mimeType: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="image-attachment"]',
        getAttrs: (element: HTMLElement) => {
          const img = element.querySelector('img');
          if (!img) return false;
          const fileSize = element.getAttribute('data-file-size');
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt'),
            title: img.getAttribute('title'),
            id: img.getAttribute('data-id'),
            fileName: element.getAttribute('data-file-name'),
            fileSize: fileSize ? Number(fileSize) : null,
          };
        },
      },
      // Backward compatible with a bare <img>, no wrapper.
      { tag: 'img[src]' },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { src, alt, title, fileName, fileSize } = node.attrs;
    const imgAttrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { src, alt, title });

    if (!fileName && !fileSize) {
      return ['img', imgAttrs];
    }

    const caption = [fileName, fileSize ? formatFileSize(fileSize) : null].filter(Boolean).join(' · ');

    return [
      'div',
      { 'data-type': 'image-attachment', 'data-file-name': fileName, 'data-file-size': fileSize, class: 'rte-image-attachment' },
      ['div', { class: 'rte-image-attachment-frame' }, ['img', imgAttrs]],
      ['div', { class: 'rte-attachment-caption' }, caption],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageAttachmentView);
  },
});
