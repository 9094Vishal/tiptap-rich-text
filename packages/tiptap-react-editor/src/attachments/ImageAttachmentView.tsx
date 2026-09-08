import { useEffect, useRef } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { abortUpload, isOrphanedUpload, markUploadInterrupted, retryUpload } from './AttachmentManager';
import { formatFileSize } from './fileUtils';
import { BLOB_URL_PREFIX, UPLOAD_ERROR_MESSAGES } from './constants';
import { classNames } from '../utils';

export function ImageAttachmentView({ node, editor, deleteNode }: NodeViewProps) {
  const { attachmentId, src, alt, uploading, progress, error, fileName, fileSize } = node.attrs;

  const attrsRef = useRef(node.attrs);
  attrsRef.current = node.attrs;

  // Undo can restore a node with uploading:true that has no live upload
  // behind it (the in-flight request was aborted when it was deleted).
  useEffect(() => {
    if (uploading && attachmentId && isOrphanedUpload(editor, attachmentId)) {
      markUploadInterrupted(editor, attachmentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploading, attachmentId]);

  useEffect(
    () => () => {
      // Safe to call unconditionally: a no-op for nodes whose upload
      // already resolved (registry entry is gone by then), aborts an
      // in-flight request, and frees an error-state entry that would
      // otherwise hold its File reference forever since retry is no
      // longer reachable.
      if (attachmentId) abortUpload(editor, attachmentId);
      if (typeof attrsRef.current.src === 'string' && attrsRef.current.src.startsWith(BLOB_URL_PREFIX)) {
        try {
          URL.revokeObjectURL(attrsRef.current.src);
        } catch {
          /* ignore */
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attachmentId]
  );

  return (
    <NodeViewWrapper className={classNames('rte-image-attachment', error && 'is-error', uploading && 'is-uploading')}>
      <div className="rte-image-attachment-frame">
        <img src={src} alt={alt || fileName || ''} loading="lazy" />

        {uploading && (
          <div className="rte-attachment-overlay">
            <span className="rte-attachment-spinner" role="status" aria-label="Uploading" />
            <div className="rte-attachment-progress">
              <span style={{ width: `${Math.max(4, progress)}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="rte-attachment-overlay rte-attachment-overlay--error">
            <span className="rte-attachment-error-text">{error || UPLOAD_ERROR_MESSAGES.GENERIC}</span>
            <button
              type="button"
              className="rte-attachment-retry"
              onMouseDown={(e) => {
                e.preventDefault();
                retryUpload(editor, attachmentId);
              }}
            >
              ↻ Retry
            </button>
          </div>
        )}

        {!uploading && (
          <button
            type="button"
            className="rte-attachment-remove"
            title="Remove image"
            aria-label="Remove image"
            contentEditable={false}
            onMouseDown={(e) => {
              e.preventDefault();
              deleteNode();
            }}
          >
            ×
          </button>
        )}
      </div>

      {(fileName || fileSize) && (
        <div className="rte-attachment-caption">
          {fileName}
          {fileSize ? ` · ${formatFileSize(fileSize)}` : ''}
        </div>
      )}
    </NodeViewWrapper>
  );
}
