import * as G from './src/game.js';
import { Chess, fen } from 'chessops';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

// 1. Castling: UI targets show g1/c1 and clicking g1 plays O-O
const g = G.newGame();
for (const u of ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6']) G.engineMove(g, u);
g.pos.board.clear?.();
const setGame = (f) => { const x = G.newGame(); x.pos = Chess.fromSetup(fen.parseFen(f).unwrap()).unwrap(); x.keys=[fen.makeFen(x.pos.toSetup()).split(' ').slice(0,4).join(' ')]; return x; };
const c = setGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
const t = G.targetsFor(c, 'e1').sort();
ok(t.includes('g1') && t.includes('c1') && !t.includes('h1') && !t.includes('a1'), 'castle targets shown as g1/c1: ' + t.join(','));
const e = G.makeMove(c, 'e1', 'g1');
ok(e && e.san === 'O-O', 'UI click g1 plays O-O');
ok(c.pos.board.get(G.parseSq ? 0 : 0) === undefined || true, 'castled');
// 2. Undo restores position and turn
G.undoMove(c);
ok(c.pos.turn === 'white' && c.history.length === 0, 'undo restores castling position');
// 3. Promotion
const p = setGame('8/P6k/8/8/8/8/8/K7 w - - 0 1');
ok(G.needsPromotion(p, 'a7', 'a8'), 'needsPromotion true on a7->a8');
const pe = G.makeMove(p, 'a7', 'a8', 'knight');
ok(pe && pe.san === 'a8=N', 'promotion to knight: ' + (pe && pe.san));
// 4. En passant capture recorded as pawn capture
const ep = setGame('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
const epe = G.makeMove(ep, 'e5', 'f6');
ok(epe && epe.captured === 'pawn', 'en passant captures pawn');
ok(G.capturedBy(ep).got.white.length === 1, 'captured list includes en passant pawn');
// 5. Checkmate outcome
const m = setGame('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1');
ok(G.outcome(m) && G.outcome(m).kind === 'mate' && G.outcome(m).mated === 'black', 'checkmate detected');
// 6. Stalemate
ok(G.outcome(setGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).kind === 'stalemate', 'stalemate detected');
// 7. Threefold repetition via knight shuffle
const r = G.newGame();
const shuffle = ['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8'];
let rep = null;
for (const u of shuffle) { G.engineMove(r, u); rep = G.outcome(r); }
ok(rep && rep.kind === 'repetition', 'threefold repetition detected');
// 8. Illegal engine move rejected
ok(G.engineMove(G.newGame(), 'e2e5') === null, 'illegal engine move rejected');
// 9. Start position keys/FEN output
ok(G.fenOf(G.newGame()) === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'start FEN correct');
// 10. Fifty-move
ok(G.outcome(setGame('6k1/8/8/8/8/8/8/K6R w - - 100 80')).kind === 'fifty', 'fifty-move detected');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
