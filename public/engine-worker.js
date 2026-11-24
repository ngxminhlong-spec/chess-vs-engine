// Runs Stockfish 19 (lite, single-threaded) in a Web Worker.
// Engine files are served from this site (public/sf/), so the page does not
// depend on any third-party CDN at runtime.
// ?engineBase=... can point at another folder (used for local testing).
const params = new URL(self.location.href).searchParams;
const BASE = new URL(params.get('engineBase') || './sf/', self.location.href).href;
const realFetch = self.fetch.bind(self);
// The loader asks for "stockfish.wasm" by a generated URL; send it to the real file.
self.fetch = (input, init) => {
  const url = String(input && input.url ? input.url : input);
  return realFetch(url.endsWith('.wasm') ? BASE + 'stockfish-19-lite-single.wasm' : input, init);
};
importScripts(BASE + 'stockfish-19-lite-single.js');
