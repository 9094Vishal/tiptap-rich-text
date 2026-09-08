# tiptap-rich-text

A monorepo for [`tiptap-react-editor`](packages/tiptap-react-editor) — a configurable, production-ready React rich text editor built on [Tiptap](https://tiptap.dev/) v3.

## Structure

- **`packages/tiptap-react-editor`** — the published package. See its [README](packages/tiptap-react-editor/README.md) for install instructions, the full feature list, and API docs.
- **`playground`** — a Vite dev app for manually exercising the editor during development.

## Development

```bash
npm install
npm run playground   # builds the package and starts the playground dev app
```

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## License

MIT — see [LICENSE](packages/tiptap-react-editor/LICENSE).
