import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { FileAttachmentView } from './FileAttachmentView';
import { formatFileSize, getFileExtension } from './fileUtils';
import { ATTACHMENT_NODE_TYPES } from './constants';

/**
 * Generic (non-image) file attachment. Renders fully static markup at
 * renderHTML time — a read-only view of saved content needs zero JS to
 * display it correctly. `url` missing (an interrupted upload that got
 * persisted before it resolved) degrades to an "attachment unavailable"
 * card rather than a dead link.
 */
export const FileAttachmentNode = Node.create({
  name: ATTACHMENT_NODE_TYPES.FILE_ATTACHMENT,
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      // Backend attachment id — the durable reference, baked into saved
      // HTML as data-id. Distinct from attachmentId below (client-local
      // upload-tracking id only).
      id: { default: null },
      url: { default: null },
      fileName: { default: null },
      fileSize: { default: null },
      mimeType: { default: null },
      attachmentId: { default: null, rendered: false },
      staged: { default: false, rendered: false },
      uploading: { default: false, rendered: false },
      progress: { default: 0, rendered: false },
      error: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="file-attachment"]',
        getAttrs: (el: HTMLElement) => {
          const link = el.querySelector('a[href]');
          const fileSize = el.getAttribute('data-file-size');
          return {
            id: el.getAttribute('data-id'),
            url: link?.getAttribute('href') || null,
            fileName: el.getAttribute('data-file-name'),
            fileSize: fileSize ? Number(fileSize) : null,
            mimeType: el.getAttribute('data-mime-type'),
            attachmentId: el.getAttribute('data-attachment-id'),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { id, url, fileName, fileSize, mimeType, attachmentId } = node.attrs;

    const wrapperAttrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      'data-type': 'file-attachment',
      'data-id': id,
      'data-attachment-id': attachmentId,
      'data-file-name': fileName,
      'data-file-size': fileSize,
      'data-mime-type': mimeType,
      class: url ? 'rte-file-chip' : 'rte-file-chip rte-file-chip--missing',
    });

    const iconNode = url
      ? ['span', { class: 'rte-file-chip-icon', 'aria-hidden': 'true' }, ['span', { class: 'rte-file-chip-ext' }, getFileExtension(fileName)]]
      : ['span', { class: 'rte-file-chip-icon', 'aria-hidden': 'true' }];
    const nameNode = ['span', { class: 'rte-file-chip-name' }, fileName || 'Untitled file'];
    const sizeNode = ['span', { class: 'rte-file-chip-sub' }, url ? formatFileSize(fileSize) : 'Attachment unavailable'];
    const infoNode = ['span', { class: 'rte-file-chip-info' }, nameNode, sizeNode];

    if (!url) {
      return ['div', wrapperAttrs, iconNode, infoNode];
    }

    return [
      'div',
      wrapperAttrs,
      [
        'a',
        { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'rte-file-chip-link' },
        iconNode,
        infoNode,
        ['span', { class: 'rte-file-chip-download', 'aria-hidden': 'true' }],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentView);
  },
});
