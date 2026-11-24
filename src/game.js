// Pure chess logic on top of chessops. No DOM here, so it can be tested in Node.
import { Chess, fen, san, makeSquare, parseSquare, squareFile, squareRank } from 'chessops';

export const FILES = 'abcdefgh';
export const VALUE = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
const CAPTURE_ORDER = ['queen', 'rook', 'bishop', 'knight', 'pawn'];
const PROMO_BY_CHAR = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' };

export function newGame() {
  const pos = Chess.default();
  return { pos, history: [], keys: [keyOf(pos)] };
}

export function fenOf(game) {
  return fen.makeFen(game.pos.toSetup());
}

// Position identity for threefold repetition: ignores move counters.
function keyOf(pos) {
  return fen.makeFen(pos.toSetup()).split(' ').slice(0, 4).join(' ');
}

function squaresOf(set) {
  const out = [];
  for (let s = 0; s < 64; s++) if (set.has(s)) out.push(makeSquare(s));
  return out;
}

export function pieceAt(game, sq) {
  return game.pos.board.get(parseSquare(sq));
}

export function sqName(file, rank) {
  return FILES[file] + (rank + 1);
}

export function kingSquare(game) {
  const k = game.pos.board.kingOf(game.pos.turn);
  return k === undefined ? null : makeSquare(k);
}

export function lastEntry(game) {
  return game.history[game.history.length - 1];
}

// chessops encodes castling as "king takes own rook". The UI shows the king's
// real destination (g1/c1), so translate between the two representations.
function castleRookSquare(pos, from, to) {
  const piece = pos.board.get(from);
  const sameRank = squareRank(from) === squareRank(to);
  const twoFiles = Math.abs(squareFile(from) - squareFile(to)) === 2;
  if (piece && piece.role === 'king' && sameRank && twoFiles) {
    const rookFile = squareFile(to) > squareFile(from) ? 7 : 0;
    return rookFile + 8 * squareRank(from);
  }
  return to;
}

function kingDestForCastle(pos, from, rookSq) {
  const piece = pos.board.get(from);
  const rook = pos.board.get(rookSq);
  if (piece && piece.role === 'king' && rook && rook.role === 'rook' && rook.color === piece.color) {
    const file = squareFile(rookSq) === 7 ? 6 : 2; // g-file or c-file
    return file + 8 * squareRank(from);
  }
  return rookSq;
}

// Squares the piece on `sq` can move to, in display form (castling shows g1/c1).
export function targetsFor(game, sq) {
  const { pos } = game;
  const from = parseSquare(sq);
  return squaresOf(pos.dests(from)).map(d => makeSquare(kingDestForCastle(pos, from, parseSquare(d))));
}

export function needsPromotion(game, from, to) {
  const piece = pieceAt(game, from);
  if (!piece || piece.role !== 'pawn') return false;
  const r = squareRank(parseSquare(to));
  return r === 0 || r === 7;
}

// Plays a move if it is legal. Returns the history entry, or null.
function play(game, from, to, promotion) {
  const { pos } = game;
  const piece = pos.board.get(from);
  if (!piece || piece.color !== pos.turn) return null;
  const realTo = castleRookSquare(pos, from, to);
  if (!pos.dests(from).has(realTo)) return null;

  let promo = promotion;
  if (piece.role === 'pawn' && (squareRank(realTo) === 0 || squareRank(realTo) === 7)) promo = promo || 'queen';
  const move = { from, to: realTo };
  if (promo) move.promotion = promo;

  const target = pos.board.get(realTo);
  let captured;
  if (target) captured = target.role;
  else if (piece.role === 'pawn' && squareFile(from) !== squareFile(realTo)) captured = 'pawn'; // en passant

  const entry = {
    san: san.makeSan(pos.clone(), move),
    from: makeSquare(from),
    to: makeSquare(realTo),
    mover: pos.turn,
    captured,
    before: pos.clone()
  };
  pos.play(move);
  game.history.push(entry);
  game.keys.push(keyOf(pos));
  return entry;
}

// Player move from the UI. `to` is a display square; `promotion` is a role name.
export function makeMove(game, from, to, promotion) {
  return play(game, parseSquare(from), parseSquare(to), promotion);
}

// Engine move in UCI form, e.g. "e2e4" or "e7e8q".
export function engineMove(game, uci) {
  const from = parseSquare(uci.slice(0, 2));
  const to = parseSquare(uci.slice(2, 4));
  const promotion = uci[4] ? PROMO_BY_CHAR[uci[4]] : undefined;
  return play(game, from, to, promotion);
}

export function undoMove(game) {
  const h = game.history.pop();
  if (!h) return;
  game.keys.pop();
  game.pos = h.before;
}

export function outcome(game) {
  const { pos } = game;
  if (pos.isCheckmate()) return { kind: 'mate', mated: pos.turn };
  if (pos.isStalemate()) return { kind: 'stalemate' };
  if (pos.isInsufficientMaterial()) return { kind: 'insufficient' };
  const key = game.keys[game.keys.length - 1];
  if (game.keys.filter(k => k === key).length >= 3) return { kind: 'repetition' };
  if (pos.halfmoves >= 100) return { kind: 'fifty' };
  return null;
}

// Pieces each side has captured, plus material balance (positive = that side is ahead).
export function capturedBy(game) {
  const got = { white: [], black: [] };
  for (const h of game.history) if (h.captured) got[h.mover].push(h.captured);
  for (const c of ['white', 'black']) got[c].sort((a, b) => CAPTURE_ORDER.indexOf(a) - CAPTURE_ORDER.indexOf(b));
  const sum = c => got[c].reduce((s, t) => s + VALUE[t], 0);
  return { got, diff: { white: sum('white') - sum('black'), black: sum('black') - sum('white') } };
}
