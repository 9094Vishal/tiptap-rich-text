import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RichTextPreview } from './RichTextPreview';

describe('RichTextPreview', () => {
  it('renders nothing for empty content when no emptyText is given', () => {
    const { container } = render(<RichTextPreview content="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders emptyText for empty content when given', () => {
    render(<RichTextPreview content="<p></p>" emptyText="Nothing here yet." />);
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
  });

  it('renders the given HTML and matches the editor typography classes', () => {
    render(<RichTextPreview content="<h1>Title</h1><p>Body text</p>" />);
    expect(screen.getByText('Title').tagName).toBe('H1');
    const root = document.querySelector('.rte-preview');
    expect(root).toHaveClass('ProseMirror');
  });

  it('adds target=_blank and rel=noopener to links', () => {
    render(<RichTextPreview content='<p><a href="https://example.com">link</a></p>' />);
    const link = screen.getByText('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('opens an image in a new tab by default, or calls onImageClick when given', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<RichTextPreview content='<img src="https://cdn.example.com/a.png" alt="a" />' />);
    await user.click(screen.getByAltText('a'));
    expect(openSpy).toHaveBeenCalledWith('https://cdn.example.com/a.png', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('calls onImageClick instead of opening a new tab when given', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const onImageClick = vi.fn();
    render(
      <RichTextPreview content='<img src="https://cdn.example.com/a.png" alt="a" />' onImageClick={onImageClick} />
    );
    await user.click(screen.getByAltText('a'));
    expect(onImageClick).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://cdn.example.com/a.png', alt: 'a' }));
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('leaves a mention chip inert with no default action when onMentionClick is omitted', async () => {
    const user = userEvent.setup();
    render(
      <RichTextPreview content='<p><span data-type="mention" data-id="1" data-label="Ada">@Ada</span></p>' />
    );
    // Should not throw, navigate, or otherwise error — just a no-op click.
    await user.click(screen.getByText('@Ada'));
  });

  it('calls onMentionClick with the chip data when given', async () => {
    const user = userEvent.setup();
    const onMentionClick = vi.fn();
    render(
      <RichTextPreview
        content='<p><span data-type="mention" data-id="1" data-label="Ada">@Ada</span></p>'
        onMentionClick={onMentionClick}
      />
    );
    await user.click(screen.getByText('@Ada'));
    expect(onMentionClick).toHaveBeenCalledWith(expect.objectContaining({ id: '1', label: 'Ada' }));
  });

  it('calls onFileClick with the chip data when given', async () => {
    const user = userEvent.setup();
    const onFileClick = vi.fn();
    render(
      <RichTextPreview
        content='<div data-type="file-attachment" data-id="f1" data-file-name="doc.pdf" data-file-size="1024"><a href="https://cdn.example.com/doc.pdf">doc.pdf</a></div>'
        onFileClick={onFileClick}
      />
    );
    await user.click(screen.getByText('doc.pdf'));
    expect(onFileClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'f1', fileName: 'doc.pdf', fileSize: 1024, url: 'https://cdn.example.com/doc.pdf' })
    );
  });
});
