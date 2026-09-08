import { createRef } from 'react';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor, type EditorHandle } from './Editor';

afterEach(() => {
  window.localStorage.clear();
});

describe('draft autosave', () => {
  it('does not touch localStorage when draftKey is unset', async () => {
    const user = userEvent.setup();
    render(<Editor content="<p></p>" />);
    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    editable.focus();
    await user.type(editable, 'hello');
    await new Promise((r) => setTimeout(r, 50));
    expect(window.localStorage.length).toBe(0);
  });

  it('saves the current content under the draft key after the debounce window', async () => {
    const user = userEvent.setup();
    render(<Editor content="<p></p>" draftKey="compose-1" />);
    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    editable.focus();
    await user.type(editable, 'draft text');

    await waitFor(
      () => expect(window.localStorage.getItem('rte-draft:compose-1')).toContain('draft text'),
      { timeout: 2000 }
    );
  });

  it('saveDraftNow() flushes immediately without waiting for the debounce', async () => {
    const user = userEvent.setup();
    const ref = createRef<EditorHandle>();
    render(<Editor ref={ref} content="<p></p>" draftKey="compose-2" />);
    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    editable.focus();
    await user.type(editable, 'urgent draft');

    ref.current?.saveDraftNow();
    expect(window.localStorage.getItem('rte-draft:compose-2')).toContain('urgent draft');
  });

  it('restores a stored draft as initial content on mount, taking priority over `content`', async () => {
    window.localStorage.setItem('rte-draft:compose-3', '<p>restored draft</p>');
    render(<Editor content="<p>original content</p>" draftKey="compose-3" />);

    await waitFor(() => expect(document.querySelector('.ProseMirror')?.textContent).toBe('restored draft'));
  });

  it('does not fire onChange for the restored draft on mount', async () => {
    window.localStorage.setItem('rte-draft:compose-4', '<p>restored</p>');
    const onChange = vi.fn();
    render(<Editor content="<p>original</p>" draftKey="compose-4" onChange={onChange} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('hasDraft() and getDraftValue() reflect the stored draft', async () => {
    window.localStorage.setItem('rte-draft:compose-5', '<p>x</p>');
    const ref = createRef<EditorHandle>();
    render(<Editor ref={ref} content="<p></p>" draftKey="compose-5" />);
    await waitFor(() => expect(ref.current?.hasDraft()).toBe(true));
    expect(ref.current?.getDraftValue()).toBe('<p>x</p>');
  });

  it('clearDraft() removes the stored draft', async () => {
    window.localStorage.setItem('rte-draft:compose-6', '<p>x</p>');
    const ref = createRef<EditorHandle>();
    render(<Editor ref={ref} content="<p></p>" draftKey="compose-6" />);
    await waitFor(() => expect(ref.current?.hasDraft()).toBe(true));

    ref.current?.clearDraft();
    expect(window.localStorage.getItem('rte-draft:compose-6')).toBeNull();
    expect(ref.current?.hasDraft()).toBe(false);
  });

  it('clear() also clears the draft', async () => {
    const user = userEvent.setup();
    const ref = createRef<EditorHandle>();
    render(<Editor ref={ref} content="<p></p>" draftKey="compose-7" />);
    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    editable.focus();
    await user.type(editable, 'text');
    ref.current?.saveDraftNow();
    expect(window.localStorage.getItem('rte-draft:compose-7')).toBeTruthy();

    ref.current?.clear();
    expect(window.localStorage.getItem('rte-draft:compose-7')).toBeNull();
  });

  it('onDraftStatusChange fires with hasDraft/draftValue/isDifferentFromContent', async () => {
    window.localStorage.setItem('rte-draft:compose-8', '<p>different from content</p>');
    const onDraftStatusChange = vi.fn();
    render(<Editor content="<p>original</p>" draftKey="compose-8" onDraftStatusChange={onDraftStatusChange} />);

    await waitFor(() =>
      expect(onDraftStatusChange).toHaveBeenCalledWith({
        hasDraft: true,
        draftValue: '<p>different from content</p>',
        isDifferentFromContent: true,
      })
    );
  });

  it('onDraftStatusChange reports isDifferentFromContent: false when draft matches content', async () => {
    window.localStorage.setItem('rte-draft:compose-9', '<p>same</p>');
    const onDraftStatusChange = vi.fn();
    render(<Editor content="<p>same</p>" draftKey="compose-9" onDraftStatusChange={onDraftStatusChange} />);

    await waitFor(() =>
      expect(onDraftStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ hasDraft: true, isDifferentFromContent: false })
      )
    );
  });

  it('survives a corrupted/unavailable localStorage without crashing', () => {
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => render(<Editor content="<p></p>" draftKey="compose-10" />)).not.toThrow();
    window.localStorage.setItem = original;
  });
});

describe('isUnchangedFrom', () => {
  it('is true when the live doc matches the baseline, ignoring HTML re-serialization noise', async () => {
    const ref = createRef<EditorHandle>();
    render(<Editor ref={ref} content="<p>Hello world</p>" />);
    await waitFor(() => expect(ref.current?.getHTML()).toBe('<p>Hello world</p>'));

    expect(ref.current?.isUnchangedFrom('<p >Hello world</p>')).toBe(true);
  });

  it('is false after a real edit', async () => {
    const user = userEvent.setup();
    const ref = createRef<EditorHandle>();
    render(<Editor ref={ref} content="<p>Hello world</p>" />);
    await waitFor(() => expect(ref.current?.getHTML()).toBe('<p>Hello world</p>'));

    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    editable.focus();
    await user.type(editable, '!');

    expect(ref.current?.isUnchangedFrom('<p>Hello world</p>')).toBe(false);
  });
});
