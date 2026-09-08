import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';
import type { MentionItem } from './mentions';

const TEAM: MentionItem[] = [
  { id: 1, value: 'Ada Lovelace' },
  { id: 2, value: 'Alan Turing' },
];

describe('mentions', () => {
  it('is off by default even if a mentionList is passed', async () => {
    const user = userEvent.setup();
    render(<Editor content="<p></p>" mentionList={TEAM} />);
    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    editable.focus();
    await user.type(editable, '@ada');
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });

  it('filters a static mentionList in-memory and inserts a mention chip on select', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onMentionIds = vi.fn();
    render(
      <Editor content="<p></p>" onChange={onChange} enableMentions mentionList={TEAM} onMentionIds={onMentionIds} />
    );

    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    editable.focus();
    await user.type(editable, '@ada');

    await screen.findByText('Ada Lovelace');
    expect(screen.queryByText('Alan Turing')).not.toBeInTheDocument();

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.stringContaining('data-id="1"'),
        expect.anything(),
        expect.anything()
      );
    });
    await waitFor(() => expect(onMentionIds).toHaveBeenLastCalledWith([1]));
  });

  // onMentionClick itself (a real click on the chip resolving to a
  // ProseMirror position via handleClickOn) needs real hit-testing —
  // view.posAtCoords depends on layout jsdom doesn't provide — so that
  // path is covered by manual/browser verification instead. This test
  // just confirms the chip renders with the right text/attrs to click.
  it('renders an inserted mention chip with the expected text and data-id', async () => {
    const user = userEvent.setup();
    render(<Editor content="<p></p>" enableMentions mentionList={TEAM} />);

    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    editable.focus();
    await user.type(editable, '@ada');
    await screen.findByText('Ada Lovelace');
    await user.keyboard('{Enter}');

    const chip = await screen.findByText('@Ada Lovelace');
    expect(chip).toHaveAttribute('data-id', '1');
  });

  it('prefers a static mentionList over mentionFetchFn when both are given', async () => {
    const user = userEvent.setup();
    const mentionFetchFn = vi.fn().mockResolvedValue([]);
    render(<Editor content="<p></p>" enableMentions mentionList={TEAM} mentionFetchFn={mentionFetchFn} />);

    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    editable.focus();
    await user.type(editable, '@ada');

    await screen.findByText('Ada Lovelace');
    expect(mentionFetchFn).not.toHaveBeenCalled();
  });
});
