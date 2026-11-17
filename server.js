// Máy chủ THPT Hồng Bàng – Ký ức 3D
// - Phục vụ các file của game (index.html, map.jpg, nhac-truong.mp3)
// - Kết nối nhiều người chơi qua WebSocket ở đường dẫn /hb-ws: thấy nhau, chat, động tác, lưu bút
// Chạy: npm install  rồi  node server.js   (mặc định cổng 3000, đổi bằng biến môi trường PORT)
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');      // nơi lưu sổ lưu bút
const GB_FILE = path.join(DATA_DIR, 'luubut.json');
const MAX_PLAYERS = 80, CHAT_KEEP = 50, GB_KEEP = 3000;

// ---------- sổ lưu bút: đọc lúc khởi động, ghi lại mỗi khi có người viết ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
let guestbook = [];
try { guestbook = JSON.parse(fs.readFileSync(GB_FILE, 'utf8')); if (!Array.isArray(guestbook)) guestbook = []; } catch (e) { guestbook = []; }
let gbSaving = false, gbDirty = false;
function saveGuestbook() {
  if (gbSaving) { gbDirty = true; return; }
  gbSaving = true;
  fs.writeFile(GB_FILE + '.tmp', JSON.stringify(guestbook), err => {
    if (!err) fs.renameSync(GB_FILE + '.tmp', GB_FILE);
    gbSaving = false; if (gbDirty) { gbDirty = false; saveGuestbook(); }
  });
}

// ---------- phục vụ file tĩnh (chỉ các loại file của game, có hỗ trợ tua nhạc bằng Range) ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.css': 'text/css', '.ico': 'image/x-icon' };   // không phục vụ .js/.json để không lộ mã máy chủ, dữ liệu
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p)), ext = path.extname(file).toLowerCase();
  if (!file.startsWith(ROOT + path.sep) || !TYPES[ext] || file.includes(path.sep + '.') || file.startsWith(DATA_DIR) || file.includes('node_modules')) {
    res.writeHead(404); return res.end('Không tìm thấy');
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Không tìm thấy'); }
    const range = req.headers.range, head = { 'Content-Type': TYPES[ext], 'Accept-Ranges': 'bytes', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400' };
    const m = range && /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { ...head, 'Content-Length': st.size });
      fs.createReadStream(file).pipe(res);
    }
  });
});

// ---------- người chơi ----------
const wss = new WebSocketServer({ server, path: '/hb-ws', maxPayload: 4096 });
const players = new Map();          // id -> {ws, p: hồ sơ + vị trí, dirty, lastChat, lastGb}
const chatLog = [];
let nextId = 1;
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const num = (v, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0; };
function cleanProfile(q) {
  q = q || {}; const yr = parseInt(q.yr, 10);
  return { name: clip(q.name, 24) || 'Bạn', cls: clip(q.cls, 8), yr: yr >= 1960 && yr <= 2035 ? String(yr) : '',
           role: q.role === 'gv' ? 'gv' : 'hs', sex: q.sex === 'f' ? 'f' : 'm', season: q.season === 'winter' ? 'winter' : 'summer' };
}
const pub = c => ({ id: c.id, ...c.p });
function send(ws, m) { if (ws.readyState === 1) ws.send(JSON.stringify(m)); }
function broadcast(m, except) { const s = JSON.stringify(m); for (const c of players.values()) if (c.ws !== except && c.ws.readyState === 1) c.ws.send(s); }

wss.on('connection', ws => {
  if (players.size >= MAX_PLAYERS) { send(ws, { t: 'full' }); return ws.close(); }
  let me = null, msgs = 0, winStart = Date.now();
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    const now = Date.now(); if (now - winStart > 1000) { winStart = now; msgs = 0; } if (++msgs > 40) return;   // chống gửi dồn dập
    let m; try { m = JSON.parse(raw); } catch (e) { return; } if (!m || typeof m.t !== 'string') return;
    if (m.t === 'hello' && !me) {
      const sid = clip(m.sid, 40);
      if (sid) for (const old of players.values()) if (old.sid === sid) {          // cùng một tab vừa kết nối lại: bỏ kết nối cũ ngay, không để "bóng ma"
        players.delete(old.id); old.gone = true; try { old.ws.terminate(); } catch (e) {} broadcast({ t: 'leave', id: old.id, name: old.p.name, quiet: true });
      }
      me = { sid, id: nextId++, ws, p: { ...cleanProfile(m.p), x: 0, y: 0, z: 0, ry: 0, mv: 0, sit: 0 }, dirty: false, lastChat: 0, lastGb: 0 };
      players.set(me.id, me);
      send(ws, { t: 'welcome', id: me.id, players: [...players.values()].filter(c => c !== me).map(pub), chat: chatLog, gb: guestbook.slice(-300).reverse() });
      broadcast({ t: 'join', p: pub(me) }, ws);
      return;
    }
    if (!me) return;
    if (m.t === 'pos' && Array.isArray(m.s)) {
      const s = m.s; Object.assign(me.p, { x: num(s[0], -400, 400), y: num(s[1], -5, 40), z: num(s[2], -400, 400), ry: num(s[3], -10, 10), mv: s[4] ? 1 : 0, sit: s[5] ? 1 : 0 });
      me.dirty = true;
    } else if (m.t === 'prof') {
      Object.assign(me.p, cleanProfile(m.p)); broadcast({ t: 'prof', p: pub(me) }, ws);
    } else if (m.t === 'chat') {
      const text = clip(m.text, 200); if (!text || now - me.lastChat < 700) return; me.lastChat = now;
      const msg = { id: me.id, name: me.p.name, cls: me.p.cls, text, ts: now };
      chatLog.push(msg); if (chatLog.length > CHAT_KEEP) chatLog.shift();
      broadcast({ t: 'chat', m: msg });
    } else if (m.t === 'emo') {
      if (m.e === 'wave' || m.e === 'jump') broadcast({ t: 'emo', id: me.id, e: m.e }, ws);
    } else if (m.t === 'gb') {
      const text = clip(m.text, 500); if (text.length < 2 || now - me.lastGb < 20000) return send(ws, { t: 'gbwait' }); me.lastGb = now;
      const e = { name: me.p.name, cls: me.p.cls, yr: me.p.yr, text, ts: now };
      guestbook.push(e); if (guestbook.length > GB_KEEP) guestbook.shift(); saveGuestbook();
      broadcast({ t: 'gb', e });
    }
  });
  ws.on('close', () => { if (me && !me.gone) { players.delete(me.id); broadcast({ t: 'leave', id: me.id, name: me.p.name }); } });
});

// gửi vị trí mọi người 10 lần mỗi giây, kiểm tra kết nối chết mỗi 30 giây
setInterval(() => {
  const ps = []; for (const c of players.values()) if (c.dirty) { c.dirty = false; const p = c.p; ps.push([c.id, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +p.ry.toFixed(2), p.mv, p.sit]); }
  if (ps.length) broadcast({ t: 'st', ps });
}, 100);
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); } }, 30000);

server.listen(PORT, () => console.log(`THPT Hồng Bàng 3D đang chạy: http://localhost:${PORT}  (sổ lưu bút: ${GB_FILE})`));
