import { useEffect } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { abortUpload, isOrphanedUpload, markUploadInterrupted, retryUpload } from './AttachmentManager';
import { formatFileSize, getFileExtension } from './fileUtils';
import { classNames } from '../utils';

export function FileAttachmentView({ node, editor, deleteNode }: NodeViewProps) {
  const { attachmentId, url, uploading, progress, error, fileName, fileSize } = node.attrs;

  useEffect(() => {
    if (uploading && attachmentId && isOrphanedUpload(editor, attachmentId)) {
      markUploadInterrupted(editor, attachmentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploading, attachmentId]);

  useEffect(
    () => () => {
      // Safe to call unconditionally — see the same cleanup in
      // ImageAttachmentView for why this isn't gated on `uploading`.
      if (attachmentId) abortUpload(editor, attachmentId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attachmentId]
  );

  const statusText = uploading ? `Uploading — ${Math.round(progress)}%` : error ? error : formatFileSize(fileSize);

  return (
    <NodeViewWrapper
      className={classNames('rte-file-chip', error && 'is-error', uploading && 'is-uploading')}
      contentEditable={false}
    >
      <div className="rte-file-chip-icon" aria-hidden="true">
        {!uploading && <span className="rte-file-chip-ext">{getFileExtension(fileName)}</span>}
      </div>

      <div className="rte-file-chip-info">
        <span className="rte-file-chip-name">{fileName || 'Untitled file'}</span>
        <span className={classNames('rte-file-chip-sub', error && 'is-error')}>{statusText}</span>
        {uploading && (
          <div className="rte-attachment-progress">
            <span style={{ width: `${Math.max(4, progress)}%` }} />
          </div>
        )}
      </div>

      {uploading && <span className="rte-attachment-spinner" role="status" aria-label="Uploading" />}

      {error && !uploading && (
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
      )}

      {!error && !uploading && url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rte-file-chip-download"
          title="Download"
          aria-label={`Download ${fileName || 'file'}`}
        />
      )}

      {!uploading && (
        <button
          type="button"
          className="rte-attachment-remove"
          title="Remove attachment"
          aria-label="Remove attachment"
          onMouseDown={(e) => {
            e.preventDefault();
            deleteNode();
          }}
        >
          ×
        </button>
      )}
    </NodeViewWrapper>
  );
}
