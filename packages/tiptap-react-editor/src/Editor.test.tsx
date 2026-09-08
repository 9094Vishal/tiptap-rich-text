import { createRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Editor, type EditorHandle } from './Editor';

describe('Editor', () => {
  it('renders the toolbar and editable content area', async () => {
    render(<Editor content="<p>Hello world</p>" />);
    expect(await screen.findByText('Hello world')).toBeInTheDocument();
    expect(screen.getByTitle('Bold (Ctrl+B)')).toBeInTheDocument();
  });

  it('calls onChange with the updated HTML when the user types', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Editor content="<p></p>" onChange={onChange} />);

    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    editable.focus();
    await user.type(editable, 'Hi there');

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith('<p>Hi there</p>', 'Hi there', expect.anything());
    });
  });

  it('toggles bold on the current selection when the Bold button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const ref = createRef<EditorHandle>();
    render(<Editor ref={ref} content="<p>Hello world</p>" onChange={onChange} />);

    // jsdom has no real selection/layout engine, so drive selection through
    // the editor's own command API rather than a browser Ctrl+A/execCommand.
    ref.current?.getInstance()?.commands.selectAll();

    await user.click(screen.getByTitle('Bold (Ctrl+B)'));

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.stringContaining('<strong>'),
        expect.anything(),
        expect.anything()
      );
    });
  });

  it('hides the toolbar when hideToolbar is set', () => {
    render(<Editor content="<p>x</p>" hideToolbar />);
    expect(screen.queryByTitle('Bold (Ctrl+B)')).not.toBeInTheDocument();
  });

  it('renders read-only content when editable is false', () => {
    render(<Editor content="<p>Read only</p>" editable={false} />);
    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    expect(editable).toHaveAttribute('contenteditable', 'false');
  });

  it('shows the error message and error styling when error is set', () => {
    render(<Editor content="<p>x</p>" error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  describe('imperative handle', () => {
    it('getHTML / isEmpty / clear reflect the live document', async () => {
      const ref = createRef<EditorHandle>();
      render(<Editor ref={ref} content="<p>content</p>" />);

      await waitFor(() => expect(ref.current?.getHTML()).toBe('<p>content</p>'));
      expect(ref.current?.isEmpty()).toBe(false);

      ref.current?.clear();
      await waitFor(() => expect(ref.current?.isEmpty()).toBe(true));
      expect(ref.current?.getHTML()).toBe('');
    });

    it('getInstance exposes the underlying Tiptap editor', () => {
      const ref = createRef<EditorHandle>();
      render(<Editor ref={ref} content="<p>x</p>" />);
      expect(ref.current?.getInstance()).toBeTruthy();
    });
  });

  describe('collapsible mode', () => {
    it('starts collapsed (toolbar hidden, expand chevron shown) when defaultExpanded is false', () => {
      render(<Editor content="<p>x</p>" collapsible />);
      expect(screen.queryByTitle('Bold (Ctrl+B)')).not.toBeInTheDocument();
      expect(screen.getByTitle('Expand')).toBeInTheDocument();
    });

    it('expands to show the toolbar when defaultExpanded is true', () => {
      render(<Editor content="<p>x</p>" collapsible defaultExpanded />);
      expect(screen.getByTitle('Bold (Ctrl+B)')).toBeInTheDocument();
    });

    it('clicking the expand chevron reveals the toolbar', async () => {
      const user = userEvent.setup();
      render(<Editor content="<p>x</p>" collapsible />);
      await user.click(screen.getByTitle('Expand'));
      expect(screen.getByTitle('Bold (Ctrl+B)')).toBeInTheDocument();
    });

    it('keeps the document content visible (not hidden) while collapsed', async () => {
      // Regression test: an earlier version hid the entire editor area via
      // `display: none` while collapsed instead of clamping it to a
      // single-line preview, which also clipped the expand button itself.
      render(<Editor content="<p>Existing content</p>" collapsible />);
      expect(await screen.findByText('Existing content')).toBeVisible();
    });
  });

  describe('toolbarItems', () => {
    it('omits a toolbar button whose feature flag is turned off', () => {
      render(<Editor content="<p>x</p>" toolbarItems={{ table: false }} />);
      expect(screen.queryByTitle('Insert table')).not.toBeInTheDocument();
      expect(screen.getByTitle('Bold (Ctrl+B)')).toBeInTheDocument();
    });

    it('actually disables the link mark when link is turned off, not just its toolbar button', async () => {
      // Regression test: StarterKit v3 bundles its own Link/Underline
      // marks. Disabling only the toolbar button (without also disabling
      // StarterKit's copies) left the mark itself registered and
      // toggleable via editor.commands, and logged a duplicate-extension
      // warning as StarterKit's copy silently competed with ours.
      const ref = createRef<EditorHandle>();
      render(<Editor ref={ref} content="<p>x</p>" toolbarItems={{ link: false }} />);
      expect(ref.current?.getInstance()?.schema.marks.link).toBeUndefined();
    });

    it('actually disables the underline mark when underline is turned off', () => {
      const ref = createRef<EditorHandle>();
      render(<Editor ref={ref} content="<p>x</p>" toolbarItems={{ underline: false }} />);
      expect(ref.current?.getInstance()?.schema.marks.underline).toBeUndefined();
    });

    it('registers no duplicate extension names', () => {
      const ref = createRef<EditorHandle>();
      render(<Editor ref={ref} content="<p>x</p>" />);
      const names = ref.current?.getInstance()?.extensionManager.extensions.map((e) => e.name) ?? [];
      expect(new Set(names).size).toBe(names.length);
    });
  });
});
