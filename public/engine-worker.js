// Runs Stockfish 19 in a Web Worker. Engine files are served from this site (public/sf/).
// - Cross-origin isolated page + SharedArrayBuffer: full multi-threaded engine.
// - Otherwise: lite single-threaded engine (works without special headers).
// ?engineBase=... can point at another folder (used for local testing).
const params = new URL(self.location.href).searchParams;
const BASE = new URL(params.get('engineBase') || './sf/', self.location.href).href;
const MULTI = self.crossOriginIsolated === true && typeof SharedArrayBuffer !== 'undefined';
const ENGINE = MULTI ? 'stockfish-19' : 'stockfish-19-lite-single';
const realFetch = self.fetch.bind(self);
// The loader asks for "<engine>.wasm" by a generated URL; send it to the real file.
self.fetch = (input, init) => {
  const url = String(input && input.url ? input.url : input);
  return realFetch(url.endsWith('.wasm') ? BASE + ENGINE + '.wasm' : input, init);
};
self.postMessage('engine: ' + ENGINE);
importScripts(BASE + ENGINE + '.js');
