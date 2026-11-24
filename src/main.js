import * as G from './game.js';
import { analyze } from './engine.js';

const LEVELS = {
  easy: { label: 'Easy' },
  quick: { label: 'Quick' },
  standard: { label: 'Standard' }
};
const PIECE_BASE = './pieces/'; // cburnett set (GPLv2+), self-hosted for cross-origin isolation
const LETTER = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P' };
const GLYPH = { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' };

const $ = id => document.getElementById(id);

let game = G.newGame();
let me = 'white'; // chessops side names: 'white' | 'black'
let level = 'standard';
let engineKind = 'full';
let flipped = false;
let selected = null;
let targets = [];
let lastMove = null;
let hint = null;
let evalWhite = null;
let busy = false;
let busyMsg = null;
let errMsg = null;
let pending = null; // { from, to } waiting for a promotion choice

/* ---------- Engine (local Stockfish) ---------- */
async function askEngine(fen) {
  return analyze(fen, level, engineKind);
}

// analyze() already returns the eval from White's view (positive = White is winning).
function setEval(data) {
  if (data.mate !== null && data.mate !== undefined) evalWhite = { mate: data.mate };
  else if (typeof data.eval === 'number') evalWhite = { cp: data.eval * 100 };
}

/* ---------- Game flow ---------- */
function resultText(o) {
  switch (o.kind) {
    case 'mate': return o.mated === me ? 'Checkmate. The engine wins.' : 'Checkmate. You win!';
    case 'stalemate': return 'Stalemate. Draw.';
    case 'repetition': return 'Draw by repetition.';
    case 'insufficient': return 'Draw by insufficient material.';
    default: return 'Draw by the fifty-move rule.';
  }
}

function statusText() {
  const o = G.outcome(game);
  if (o) return resultText(o);
  return (game.pos.turn === me ? 'Your move.' : 'Engine to move.') + (game.pos.isCheck() ? ' Check!' : '');
}

function isOver() { return !!G.outcome(game); }

function onSquare(sq) {
  if (busy || pending || isOver() || game.pos.turn !== me) return;
  if (selected && targets.includes(sq)) {
    if (G.needsPromotion(game, selected, sq)) {
      pending = { from: selected, to: sq };
      openPromo();
    } else {
      playerMove(selected, sq, undefined);
    }
    return;
  }
  const piece = G.pieceAt(game, sq);
  if (piece && piece.color === me && sq !== selected) {
    selected = sq;
    targets = G.targetsFor(game, sq);
  } else {
    selected = null;
    targets = [];
  }
  render();
}

function playerMove(from, to, promotion) {
  const entry = G.makeMove(game, from, to, promotion);
  if (!entry) return;
  lastMove = { from: entry.from, to: entry.to };
  selected = null;
  targets = [];
  hint = null;
  errMsg = null;
  render();
  if (!isOver() && game.pos.turn !== me) engineTurn();
}

async function engineTurn() {
  busy = true;
  busyMsg = 'Engine is thinking…';
  render();
  try {
    const data = await askEngine(G.fenOf(game));
    const entry = G.engineMove(game, data.move);
    if (!entry) throw new Error('engine sent an illegal move');
    lastMove = { from: entry.from, to: entry.to };
    setEval(data);
  } catch (err) {
    errMsg = 'Engine failed: ' + err.message + '. Tap Hint or Undo to continue.';
  }
  busy = false;
  busyMsg = null;
  render();
}

async function showHint() {
  if (busy || pending || isOver() || game.pos.turn !== me) return;
  busy = true;
  busyMsg = 'Looking for a good move…';
  render();
  try {
    const data = await askEngine(G.fenOf(game));
    hint = { from: data.move.slice(0, 2), to: data.move.slice(2, 4) };
    errMsg = null;
  } catch (err) {
    errMsg = 'Hint failed: ' + err.message;
  }
  busy = false;
  busyMsg = null;
  render();
}

function clearState() {
  lastMove = null; selected = null; targets = [];
  hint = null; evalWhite = null; errMsg = null; pending = null;
}

function undo() {
  if (busy || game.history.length === 0) return;
  G.undoMove(game);
  while (game.pos.turn !== me && game.history.length > 0) G.undoMove(game);
  clearState();
  const h = G.lastEntry(game);
  if (h) lastMove = { from: h.from, to: h.to };
  render();
}

function startGame(colorChoice, lvl, kind) {
  game = G.newGame();
  level = lvl;
  engineKind = kind || 'full';
  me = colorChoice === 'r' ? (Math.random() < .5 ? 'white' : 'black') : (colorChoice === 'w' ? 'white' : 'black');
  flipped = me === 'black';
  clearState();
  render();
  if (game.pos.turn !== me) engineTurn();
}

/* ---------- Rendering ---------- */
function pieceImg(color, role, cls) {
  const img = document.createElement('img');
  img.className = cls;
  img.alt = '';
  img.draggable = false;
  img.src = PIECE_BASE + color[0] + LETTER[role] + '.svg'; // 'white' -> 'w'
  img.addEventListener('error', () => {
    const g = document.createElement('span');
    g.className = cls + ' gl';
    g.textContent = GLYPH[role];
    g.style.color = color === 'white' ? '#fff' : '#111';
    g.style.textShadow = color === 'white' ? '0 0 2px #000' : 'none';
    img.replaceWith(g);
  }, { once: true });
  return img;
}

const AVATAR_YOU = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>';
const AVATAR_BOT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 14h.01M15 14h.01"/></svg>';

function renderBar(pos, color) {
  const mine = color === me;
  $('av-' + pos).innerHTML = mine ? AVATAR_YOU : AVATAR_BOT;
  $('name-' + pos).textContent = mine ? 'You' : 'Engine';
  $('meta-' + pos).textContent = (color === 'white' ? 'White' : 'Black') + (mine ? '' : ' · ' + LEVELS[level].label + (engineKind === 'lite' ? ' · Lite' : ''));
  $('bar-' + pos).classList.toggle('busy', busy && !mine && !!busyMsg);

  const { got, diff } = G.capturedBy(game);
  const box = $('caps-' + pos);
  box.innerHTML = '';
  const takenColor = color === 'white' ? 'black' : 'white'; // captured pieces belong to the opposite side
  for (const role of got[color]) box.appendChild(pieceImg(takenColor, role, 'cap'));
  if (diff[color] > 0) {
    const a = document.createElement('span');
    a.className = 'adv';
    a.textContent = '+' + diff[color];
    box.appendChild(a);
  }
}

function render() {
  const board = $('board');
  board.innerHTML = '';
  const order = [0, 1, 2, 3, 4, 5, 6, 7];
  const ranks = flipped ? order : [...order].reverse();
  const files = flipped ? [...order].reverse() : order;
  const checked = game.pos.isCheck() ? G.kingSquare(game) : null;
  const last = lastMove;

  ranks.forEach((rank, ri) => {
    files.forEach((file, ci) => {
      const sq = G.sqName(file, rank);
      const piece = G.pieceAt(game, sq);
      const btn = document.createElement('button');
      btn.className = 'sq ' + ((file + rank) % 2 === 1 ? 'light' : 'dark');
      btn.setAttribute('aria-label', sq + (piece ? ' ' + piece.color + ' ' + piece.role : ''));
      if (last && (sq === last.from || sq === last.to)) btn.classList.add('last');
      if (hint && (sq === hint.from || sq === hint.to)) btn.classList.add('hint');
      if (sq === selected) btn.classList.add('sel');
      if (targets.includes(sq)) btn.classList.add(piece ? 'capture' : 'target');
      if (sq === checked) btn.classList.add('check');

      const ov = document.createElement('span');
      ov.className = 'ov';
      btn.appendChild(ov);

      if (ci === 0) {
        const n = document.createElement('span');
        n.className = 'co r';
        n.textContent = String(rank + 1);
        btn.appendChild(n);
      }
      if (ri === 7) {
        const f = document.createElement('span');
        f.className = 'co f';
        f.textContent = G.FILES[file];
        btn.appendChild(f);
      }
      if (piece) btn.appendChild(pieceImg(piece.color, piece.role, 'pc'));

      btn.addEventListener('click', () => onSquare(sq));
      board.appendChild(btn);
    });
  });

  const bottom = flipped ? 'black' : 'white';
  renderBar('bottom', bottom);
  renderBar('top', bottom === 'white' ? 'black' : 'white');

  const st = $('status');
  st.textContent = errMsg || busyMsg || statusText();
  st.className = errMsg ? 'err' : '';

  // Eval bar: white share, white sits at the bottom unless the board is flipped
  const pct = !evalWhite ? 50
    : evalWhite.mate !== undefined ? (evalWhite.mate > 0 ? 100 : 0)
    : 50 + 50 * Math.tanh(evalWhite.cp / 400);
  $('eval-fill').style.height = pct + '%';
  $('evalv').classList.toggle('flip', flipped);

  renderMoves();

  $('btn-undo').disabled = busy || game.history.length === 0;
  $('btn-hint').disabled = busy || isOver() || game.pos.turn !== me;
}

function renderMoves() {
  const hist = game.history.map(h => h.san);
  const box = $('moves');
  box.innerHTML = '';
  hist.forEach((san, i) => {
    if (i % 2 === 0) {
      const n = document.createElement('span');
      n.className = 'mn';
      n.textContent = (i / 2 + 1) + '.';
      box.appendChild(n);
    }
    const s = document.createElement('span');
    s.className = 'mv' + (i === hist.length - 1 ? ' cur' : '');
    s.textContent = san;
    box.appendChild(s);
  });
  box.scrollLeft = box.scrollWidth;
  box.scrollTop = box.scrollHeight;
}

/* ---------- Dialogs ---------- */
function show(el, on) { el.hidden = !on; }

function openPromo() {
  const box = $('promo-opts');
  box.innerHTML = '';
  for (const role of ['queen', 'rook', 'bishop', 'knight']) {
    const b = document.createElement('button');
    b.setAttribute('aria-label', 'Promote to ' + role);
    b.appendChild(pieceImg(me, role, 'pi'));
    b.addEventListener('click', () => {
      const p = pending;
      pending = null;
      show($('ov-promo'), false);
      playerMove(p.from, p.to, role);
    });
    box.appendChild(b);
  }
  show($('ov-promo'), true);
}

function pickSeg(id, value) {
  $(id).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === value)));
}
function segValue(id) {
  const b = $(id).querySelector('[aria-pressed="true"]');
  return b ? b.dataset.v : null;
}
['seg-color', 'seg-level', 'seg-engine'].forEach(id => {
  $(id).addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) pickSeg(id, b.dataset.v);
  });
});

$('btn-new').addEventListener('click', () => { if (!busy) show($('ov-new'), true); });
$('btn-cancel').addEventListener('click', () => show($('ov-new'), false));
$('ov-new').addEventListener('click', e => { if (e.target === $('ov-new')) show($('ov-new'), false); });
$('btn-start').addEventListener('click', () => {
  show($('ov-new'), false);
  startGame(segValue('seg-color'), segValue('seg-level'), segValue('seg-engine'));
});
$('ov-promo').addEventListener('click', e => {
  if (e.target === $('ov-promo')) { pending = null; show($('ov-promo'), false); }
});

$('btn-undo').addEventListener('click', undo);
$('btn-hint').addEventListener('click', showHint);
$('btn-flip').addEventListener('click', () => { flipped = !flipped; render(); });

startGame('w', 'standard');
