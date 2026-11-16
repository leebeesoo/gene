// localStorage 래퍼 — 사생활 보호 모드 등에서 실패해도 앱은 동작
const K_CUR = 'family:current:v1';
const K_BOARDS = 'family:boards:v1';
function get(k, fallback) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function set(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
}
export const loadCurrent = () => get(K_CUR, null);
export const saveCurrent = board => set(K_CUR, board);
export const listBoards = () => { const b = get(K_BOARDS, []); return Array.isArray(b) ? b : []; };
export function saveBoard(board) {
  const boards = listBoards();
  const id = board.savedId || ('b' + Date.now().toString(36));
  const rec = { id, title: board.title, people: board.people, at: Date.now() };
  const i = boards.findIndex(b => b.id === id);
  if (i >= 0) boards[i] = rec; else boards.unshift(rec);
  return set(K_BOARDS, boards.slice(0, 30)) ? id : null;
}
export function deleteBoard(id) { return set(K_BOARDS, listBoards().filter(b => b.id !== id)); }
