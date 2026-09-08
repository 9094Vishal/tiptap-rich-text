import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

describe('emoji suggestion', () => {
  it('opens a filtered menu on ":" and inserts the selected emoji', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Editor content="<p></p>" onChange={onChange} />);

    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    editable.focus();
    await user.type(editable, ':fire');

    // Don't hardcode which shortcode wins the "starts with fire" race
    // (several shortcodes match) — read whichever the dropdown put
    // first, and confirm that's what gets inserted.
    await waitFor(() => expect(document.querySelector('.rte-slash-dropdown .rte-slash-item')).toBeInTheDocument());
    const firstItem = document.querySelector('.rte-slash-dropdown .rte-slash-item');
    const firstGlyph = firstItem?.querySelector('.rte-emoji-item-glyph')?.textContent;
    expect(firstGlyph).toBeTruthy();

    await user.keyboard('{Enter}');

    await waitFor(() => {
      const calls = onChange.mock.calls;
      const html = calls[calls.length - 1]?.[0] as string;
      expect(html).toContain(firstGlyph);
    });
  });

  it('does not open when emoji is disabled via toolbarItems', async () => {
    const user = userEvent.setup();
    render(<Editor content="<p></p>" toolbarItems={{ emoji: false }} />);

    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    editable.focus();
    await user.type(editable, ':fire');

    expect(screen.queryByText(':fire:')).not.toBeInTheDocument();
  });

  it('omits the emoji button from the toolbar when disabled', () => {
    render(<Editor content="<p></p>" toolbarItems={{ emoji: false }} />);
    expect(screen.queryByTitle('Emoji')).not.toBeInTheDocument();
  });
});
