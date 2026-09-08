import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Extension } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';
import { Editor, type EditorHandle } from './Editor';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    insertSignature: {
      insertSignature: () => ReturnType;
    };
  }
}

describe('extensions prop', () => {
  it('registers a custom extension alongside the built-in ones', async () => {
    const CustomExtension = Extension.create({ name: 'myCustomExtension' });
    const ref = createRef<EditorHandle>();
    render(<Editor ref={ref} content="<p>x</p>" extensions={[CustomExtension]} />);

    await new Promise((r) => setTimeout(r, 0)); // let the editor's create event settle
    const names = ref.current?.getInstance()?.extensionManager.extensions.map((e) => e.name) ?? [];
    expect(names).toContain('myCustomExtension');
  });

  it('a custom command added via an extension actually works', async () => {
    const onChange = vi.fn();
    const InsertSignature = Extension.create({
      name: 'insertSignature',
      addCommands() {
        return {
          insertSignature:
            () =>
            ({ commands }) =>
              commands.insertContent('— Sent from MyApp'),
        };
      },
    });
    const ref = createRef<EditorHandle>();
    render(<Editor ref={ref} content="<p></p>" onChange={onChange} extensions={[InsertSignature]} />);
    await new Promise((r) => setTimeout(r, 0));

    ref.current?.getInstance()?.commands.insertSignature();

    expect(ref.current?.getHTML()).toContain('Sent from MyApp');
  });
});

describe('toolbarEnd', () => {
  it('renders custom content at the end of the toolbar', () => {
    render(<Editor content="<p>x</p>" toolbarEnd={() => <button title="My Button">Custom</button>} />);
    expect(screen.getByTitle('My Button')).toBeInTheDocument();
  });

  it('passes the live editor instance to the render function', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Editor
        content="<p></p>"
        onChange={onChange}
        toolbarEnd={(editor) => (
          <button
            title="Insert Hi"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().insertContent('Hi').run();
            }}
          >
            Insert
          </button>
        )}
      />
    );

    await user.click(screen.getByTitle('Insert Hi'));
    expect(onChange).toHaveBeenLastCalledWith('<p>Hi</p>', 'Hi', expect.anything());
  });

  it('is absent from the toolbar when not provided', () => {
    render(<Editor content="<p>x</p>" />);
    expect(screen.queryByTitle('My Button')).not.toBeInTheDocument();
  });
});
