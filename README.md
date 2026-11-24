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

## Credits and headers

- Piece images (`public/pieces/`): the cburnett set by Colin M.L. Burnett, GPLv2+ (taken from lichess.org's lila repository).
- Stockfish 19 (`public/sf/`): Stockfish.js by Nathan Rugg, built from Stockfish, GPLv3.
- `vercel.json` sends `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers so the page is cross-origin isolated. That enables the multi-threaded engine. Without isolation, the lite single-threaded engine is used.
- The full engine's WASM (`public/sf/stockfish-19.wasm`, ~99 MB) is stored with Git LFS. Run `git lfs pull` after cloning.

## Tests

```
npm test           # game logic (Node)
```

Browser tests need Chrome and a local server serving `dist/` at port 8765, with the Stockfish files in `/sf/`. They are `ui-test.mjs` and `ui-sf-test.mjs`.
