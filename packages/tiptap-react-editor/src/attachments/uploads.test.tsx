import { createRef, type RefObject } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Editor, type EditorHandle } from '../Editor';
import type { OnUploadRequest } from './AttachmentManager';

const makeFile = (name: string, type: string, sizeBytes = 1024): File =>
  new File([new Uint8Array(sizeBytes)], name, { type });

const deferredUpload = () => {
  let resolve!: (result: { id: string; url: string }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ id: string; url: string }>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const onUploadRequest: OnUploadRequest = () => promise;
  return { onUploadRequest, resolve, reject };
};

// Tiptap's Editor fires its internal `create` event (and therefore this
// extension's onCreate, which seeds AttachmentManager's storage.options)
// via a real `setTimeout(0)`, not synchronously during construction —
// insertFiles is a silent no-op if called before that fires. A consumer
// interacting well after mount never notices; a test that calls it in the
// same tick as render() does, so wait for it explicitly first.
const waitForUploadReady = async (ref: RefObject<EditorHandle>) => {
  await waitFor(() => {
    const instance = ref.current?.getInstance();
    expect(instance?.storage.attachmentManager?.options).toBeTruthy();
  });
};

describe('file uploads', () => {
  it('is off by default: dropping/pasting is a no-op without enableFileUpload', () => {
    const ref = createRef<EditorHandle>();
    render(<Editor ref={ref} content="<p></p>" />);
    ref.current?.insertFiles([makeFile('a.png', 'image/png')]);
    expect(ref.current?.isEmpty()).toBe(true);
  });

  it('inserts an image node in an uploading state, then resolves to the uploaded url', async () => {
    const { onUploadRequest, resolve } = deferredUpload();
    const ref = createRef<EditorHandle>();
    const onChange = vi.fn();
    render(
      <Editor ref={ref} content="<p></p>" onChange={onChange} enableFileUpload onUploadRequest={onUploadRequest} />
    );
    await waitForUploadReady(ref);

    ref.current?.insertFiles([makeFile('photo.png', 'image/png')]);

    await waitFor(() => expect(document.querySelector('.rte-image-attachment.is-uploading')).toBeInTheDocument());
    expect(ref.current?.getPendingUploadsCount()).toBe(1);

    resolve({ id: 'server-1', url: 'https://cdn.example.com/photo.png' });

    await waitFor(() => expect(ref.current?.getPendingUploadsCount()).toBe(0));
    await waitFor(() => expect(document.querySelector('.rte-image-attachment.is-uploading')).not.toBeInTheDocument());
    expect(ref.current?.getAttachmentIds()).toEqual(['server-1']);
    expect(ref.current?.getAttachments()[0]).toMatchObject({
      id: 'server-1',
      url: 'https://cdn.example.com/photo.png',
      type: 'image',
    });
  });

  it('reports pending count changes via onPendingUploadsChange', async () => {
    const { onUploadRequest, resolve } = deferredUpload();
    const onPendingUploadsChange = vi.fn();
    const ref = createRef<EditorHandle>();
    render(
      <Editor
        ref={ref}
        content="<p></p>"
        enableFileUpload
        onUploadRequest={onUploadRequest}
        onPendingUploadsChange={onPendingUploadsChange}
      />
    );
    await waitForUploadReady(ref);

    ref.current?.insertFiles([makeFile('a.png', 'image/png')]);
    await waitFor(() => expect(onPendingUploadsChange).toHaveBeenCalledWith(1));

    resolve({ id: '1', url: 'https://cdn.example.com/a.png' });
    await waitFor(() => expect(onPendingUploadsChange).toHaveBeenLastCalledWith(0));
  });

  it('rejects a file over the size limit before ever calling onUploadRequest', async () => {
    const onUploadRequest = vi.fn();
    const onUploadError = vi.fn();
    const ref = createRef<EditorHandle>();
    render(
      <Editor
        ref={ref}
        content="<p></p>"
        enableFileUpload
        onUploadRequest={onUploadRequest}
        onUploadError={onUploadError}
        maxFileSizeMB={1}
      />
    );
    await waitForUploadReady(ref);

    ref.current?.insertFiles([makeFile('huge.png', 'image/png', 2 * 1024 * 1024)]);

    expect(onUploadRequest).not.toHaveBeenCalled();
    expect(onUploadError).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ message: expect.stringMatching(/1 MB limit/) })
    );
    expect(ref.current?.isEmpty()).toBe(true);
  });

  it('shows a retry button on upload failure, and retrying re-attempts the upload', async () => {
    const user = userEvent.setup();
    let attempt = 0;
    const onUploadRequest: OnUploadRequest = () => {
      attempt += 1;
      if (attempt === 1) return Promise.reject(new Error('network down'));
      return Promise.resolve({ id: 'ok-1', url: 'https://cdn.example.com/ok.png' });
    };
    const ref = createRef<EditorHandle>();
    render(<Editor ref={ref} content="<p></p>" enableFileUpload onUploadRequest={onUploadRequest} />);
    await waitForUploadReady(ref);

    ref.current?.insertFiles([makeFile('a.png', 'image/png')]);

    const retryBtn = await screen.findByText('↻ Retry');
    await user.click(retryBtn);

    await waitFor(() => expect(ref.current?.getAttachmentIds()).toEqual(['ok-1']));
  });

  it('deferred mode stages the file without uploading until uploadStagedFiles() is called', async () => {
    const onUploadRequest = vi.fn().mockResolvedValue({ id: 'staged-1', url: 'https://cdn.example.com/staged.png' });
    const ref = createRef<EditorHandle>();
    render(<Editor ref={ref} content="<p></p>" enableFileUpload deferUploads onUploadRequest={onUploadRequest} />);
    await waitForUploadReady(ref);

    ref.current?.insertFiles([makeFile('a.png', 'image/png')]);

    await waitFor(() => expect(document.querySelector('.rte-image-attachment')).toBeInTheDocument());
    expect(onUploadRequest).not.toHaveBeenCalled();
    expect(ref.current?.getPendingUploadsCount()).toBe(0);

    const ids = await ref.current!.uploadStagedFiles();
    expect(onUploadRequest).toHaveBeenCalledTimes(1);
    expect(ids).toEqual(['staged-1']);
  });
});
