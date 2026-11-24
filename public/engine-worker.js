// Runs Stockfish 19 in a Web Worker. Engine files are served from this site (public/sf/).
// ?engine=full  -> full multi-threaded engine (falls back to lite if the page is not cross-origin isolated)
// ?engine=lite  -> lite single-threaded engine
// ?engineBase=... can point at another folder (used for local testing).
const params = new URL(self.location.href).searchParams;
const BASE = new URL(params.get('engineBase') || './sf/', self.location.href).href;
const WANT_FULL = params.get('engine') !== 'lite';
const MULTI = WANT_FULL && self.crossOriginIsolated === true && typeof SharedArrayBuffer !== 'undefined';
const ENGINE = MULTI ? 'stockfish-19' : 'stockfish-19-lite-single';
const realFetch = self.fetch.bind(self);
// The loader asks for "<engine>.wasm" by a generated URL; send it to the real file.
self.fetch = (input, init) => {
  const url = String(input && input.url ? input.url : input);
  return realFetch(url.endsWith('.wasm') ? BASE + ENGINE + '.wasm' : input, init);
};
self.postMessage('engine: ' + ENGINE);
importScripts(BASE + ENGINE + '.js');
