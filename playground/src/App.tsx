import { useRef, useState } from 'react';
import { Extension } from '@tiptap/core';
import { Editor, RichTextPreview, type EditorHandle, type MentionItem, type OnUploadRequest } from 'tiptap-react-editor';
import 'tiptap-react-editor/styles.css';

// Custom extension demo: a keyboard shortcut that inserts a signature.
const InsertSignature = Extension.create({
  name: 'insertSignature',
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-s': () => this.editor.commands.insertContent('— Sent from MyApp'),
    };
  },
});
const extraExtensions = [InsertSignature];

const TEAM: MentionItem[] = [
  { id: 1, value: 'Ada Lovelace' },
  { id: 2, value: 'Alan Turing' },
  { id: 3, value: 'Grace Hopper' },
  { id: 4, value: 'Katherine Johnson' },
];

let uploadCounter = 0;
// Fake backend: a file named with "fail" deterministically fails once (to
// exercise the retry button), everything else succeeds. Reports progress
// over ~1s so the progress bar/spinner are visible.
const failedOnce = new Set<string>();
const fakeUploadRequest: OnUploadRequest = (file, { onProgress }) =>
  new Promise((resolve, reject) => {
    uploadCounter += 1;
    const shouldFail = file.name.includes('fail') && !failedOnce.has(file.name);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      onProgress(Math.min(progress, 100));
      if (progress >= 100) {
        clearInterval(interval);
        if (shouldFail) {
          failedOnce.add(file.name);
          reject(new Error('Simulated upload failure — click retry'));
        } else {
          resolve({
            id: `up-${uploadCounter}`,
            url: URL.createObjectURL(file),
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          });
        }
      }
    }, 200);
  });

export default function App() {
  const [html, setHtml] = useState('<p>Start typing…</p>');
  const [readOnly, setReadOnly] = useState(false);
  const [mentionIds, setMentionIds] = useState<Array<string | number>>([]);
  const [draftStatus, setDraftStatus] = useState<{ hasDraft: boolean; isDifferentFromContent: boolean } | null>(
    null
  );
  const editorRef = useRef<EditorHandle>(null);

  return (
    <div style={{ maxWidth: 820, margin: '2rem auto', fontFamily: 'sans-serif', padding: '0 1rem' }}>
      <h1>tiptap-react-editor playground</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setReadOnly((r) => !r)}>{readOnly ? 'Make editable' : 'Make read-only'}</button>
        <button onClick={() => editorRef.current?.clear()}>Clear</button>
        <button onClick={() => editorRef.current?.focus()}>Focus</button>
        <button onClick={() => alert(editorRef.current?.isEmpty() ? 'Empty' : 'Has content')}>Is empty?</button>
      </div>

      <Editor
        ref={editorRef}
        content={html}
        onChange={setHtml}
        editable={!readOnly}
        placeholder="Write something… try '/' or '@'"
        collapsible
        defaultExpanded
        enableMentions
        mentionList={TEAM}
        onMentionIds={setMentionIds}
        onMentionClick={({ label }) => alert(`Clicked mention: ${label}`)}
        enableFileUpload
        onUploadRequest={fakeUploadRequest}
        onUploadError={(_file, err) => alert(`Upload error: ${err.message}`)}
        extensions={extraExtensions}
        draftKey="playground-demo"
        onDraftStatusChange={setDraftStatus}
        toolbarEnd={(editor) => (
          <button
            title="Insert signature (or Ctrl/Cmd+Shift+S)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().insertContent('— Sent from MyApp').run()}
          >
            ✍️ Signature
          </button>
        )}
      />

      <p style={{ fontSize: 13, color: '#6b7280' }}>Mention ids in doc: {JSON.stringify(mentionIds)}</p>
      <p style={{ fontSize: 13, color: '#6b7280' }}>Draft status: {JSON.stringify(draftStatus)}</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => editorRef.current?.saveDraftNow()}>Save draft now</button>
        <button onClick={() => editorRef.current?.clearDraft()}>Clear draft</button>
        <button onClick={() => alert(`hasDraft: ${editorRef.current?.hasDraft()}`)}>hasDraft?</button>
        <button onClick={() => alert(`isUnchangedFrom(current html): ${editorRef.current?.isUnchangedFrom(html)}`)}>
          isUnchangedFrom(html)?
        </button>
      </div>

      <h2>Read-only preview</h2>
      <div style={{ border: '1px solid #d9dce1', borderRadius: 8, padding: '12px 14px' }}>
        <RichTextPreview
          content={html}
          emptyText="Nothing written yet."
          onMentionClick={({ label }) => alert(`Preview mention click: ${label}`)}
          onFileClick={({ fileName }) => alert(`Preview file click: ${fileName}`)}
        />
      </div>

      <h2>HTML output</h2>
      <pre style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: 6, whiteSpace: 'pre-wrap' }}>{html}</pre>
    </div>
  );
}
