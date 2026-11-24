// Local Stockfish wrapper: UCI over a Web Worker.
const WORKER_URL = 'engine-worker.js';
const LEVELS = {
  easy:     { depth: 6,  skill: 5 },
  quick:    { depth: 10, skill: 12 },
  standard: { depth: 14, skill: 20 }
};

let worker = null;
let initPromise = null;
const listeners = new Set();

function onLine(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function send(cmd) {
  worker.postMessage(cmd);
}

function waitFor(test, ms) {
  return new Promise((resolve, reject) => {
    const off = onLine(line => {
      if (test(line)) { off(); clearTimeout(t); resolve(line); }
    });
    const t = setTimeout(() => { off(); reject(new Error('engine timed out')); }, ms);
  });
}

function init() {
  if (initPromise) return initPromise;
  worker = new Worker(WORKER_URL);
  worker.onmessage = e => { for (const fn of [...listeners]) fn(String(e.data)); };
  worker.onerror = () => { for (const fn of [...listeners]) fn('worker-error'); };
  // Fail fast if the worker itself cannot load (network error, blocked script, ...).
  const workerFailed = new Promise((_, reject) => {
    worker.addEventListener('error', e => reject(new Error(e.message || 'worker failed to load')));
  });
  const startup = (async () => {
    send('uci');
    await waitFor(l => l === 'uciok', 30000);
    const threads = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 2) - 1));
    send('setoption name Threads value ' + threads);
    send('isready');
    await waitFor(l => l === 'readyok', 30000);
  })();
  initPromise = Promise.race([startup, workerFailed]).catch(err => {
    initPromise = null;
    if (worker) worker.terminate();
    worker = null;
    throw new Error('engine failed to start (' + err.message + ')');
  });
  return initPromise;
}

// UCI scores are from the side to move; convert to White's view (positive = White better).
function parseScore(line, sign) {
  const m = line.match(/ score (cp|mate) (-?\d+)/);
  if (!m) return null;
  return m[1] === 'mate'
    ? { mate: sign * Number(m[2]) }
    : { eval: sign * Number(m[2]) / 100 };
}

// Returns { move, eval, mate } for the position, matching the shape the UI expects.
export async function analyze(fen, level) {
  await init();
  const cfg = LEVELS[level] || LEVELS.standard;
  const sign = fen.split(' ')[1] === 'w' ? 1 : -1;

  send('setoption name Skill Level value ' + cfg.skill);
  send('ucinewgame');
  send('position fen ' + fen);
  send('go depth ' + cfg.depth);

  let score = null;
  let move;
  try {
    move = await new Promise((resolve, reject) => {
      const off = onLine(line => {
        if (line.startsWith('info ')) {
          const s = parseScore(line, sign);
          if (s) score = s;
        } else if (line.startsWith('bestmove ')) {
          off(); clearTimeout(t);
          resolve(line.split(' ')[1]);
        }
      });
      const t = setTimeout(async () => {
        off();
        send('stop');
        // drain the late bestmove so it cannot answer the next search
        await waitFor(l => l.startsWith('bestmove '), 5000).catch(() => {});
        reject(new Error('request timed out'));
      }, 20000);
    });
  } catch (err) {
    throw err;
  }
  if (!move || move === '(none)') throw new Error('engine returned no move');
  return { move, ...(score || { eval: 0 }) };
}
