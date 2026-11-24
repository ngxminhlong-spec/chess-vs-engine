// Runs Stockfish 19 (lite, single-threaded) in a Web Worker.
// The engine loader is fetched from jsDelivr. Its .wasm request is redirected
// to the same CDN, so the 1.8 MB WASM never has to be deployed with the site.
// ?engineBase=... overrides the CDN folder (used for local testing).
const params = new URL(self.location.href).searchParams;
const BASE = params.get('engineBase') || 'https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/';
const realFetch = self.fetch.bind(self);
self.fetch = (input, init) => {
  const url = String(input && input.url ? input.url : input);
  return realFetch(url.endsWith('.wasm') ? BASE + 'stockfish-19-lite-single.wasm' : input, init);
};
importScripts(BASE + 'stockfish-19-lite-single.js');
