# Chess vs Engine

A browser chess game against Stockfish 19. The engine runs locally in a Web Worker, so there are no server calls or API keys.

## Build

```
npm install
npm run build      # writes dist/index.html and dist/engine-worker.js
```

Deploy the `dist/` folder to any static host (Vercel, Netlify, GitHub Pages, ...).

## How it works

- `src/game.js`: chess rules via [chessops](https://github.com/niklasf/chessops), with castling, en passant, promotion, and draw detection.
- `src/engine.js`: UCI wrapper around the Stockfish worker.
- `public/engine-worker.js`: loads Stockfish 19 (lite, single-threaded) from jsDelivr. The `.wasm` request is redirected to the same CDN.
- `src/main.js`: UI.

## Tests

```
npm test           # game logic (Node)
```

Browser tests need Chrome and a local server serving `dist/` at port 8765, with the Stockfish files in `/sf/`. They are `ui-test.mjs` and `ui-sf-test.mjs`.
