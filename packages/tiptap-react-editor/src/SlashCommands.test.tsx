import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

describe('slash commands', () => {
  it('opens a filtered menu on "/" and inserts the selected block', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Editor content="<p></p>" onChange={onChange} />);

    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    editable.focus();
    await user.type(editable, '/bullet');

    await screen.findByText('Bullet List');
    expect(screen.queryByText('Heading 1')).not.toBeInTheDocument();

    await user.keyboard('{Enter}');
    await user.type(editable, 'first item');

    await waitFor(() => {
      const calls = onChange.mock.calls;
      const html = calls[calls.length - 1]?.[0] as string;
      expect(html).toContain('<ul');
      expect(html).toContain('first item');
    });
  });

  it('omits commands whose feature is disabled via toolbarItems', async () => {
    const user = userEvent.setup();
    render(<Editor content="<p></p>" toolbarItems={{ table: false }} />);

    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    editable.focus();
    await user.type(editable, '/');

    await screen.findByText('Bullet List');
    expect(screen.queryByText('Table')).not.toBeInTheDocument();
  });

  it('does not open when enableSlashCommands is false', async () => {
    const user = userEvent.setup();
    render(<Editor content="<p></p>" enableSlashCommands={false} />);

    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    editable.focus();
    await user.type(editable, '/bullet');

    expect(screen.queryByText('Bullet List')).not.toBeInTheDocument();
  });
});
