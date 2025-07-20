const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

// === Biến lưu trạng thái ===
let currentData = {
  id: "binhtool90",
  id_phien: null,
  ket_qua: "",
  pattern: "",
  du_doan: "?"
};
let id_phien_chua_co_kq = null;
let patternHistory = []; // Lưu dãy T/X gần nhất

// === Danh sách tin nhắn gửi lên server WebSocket ===
const messagesToSend = [
  [1, "MiniGame", "SC_anhlatrumapi1", "binhtool90", {
    "info": "{\"ipAddress\":\"2001:ee0:5709:2720:7ba7:fb19:d038:aa91\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsImdlbmRlciI6MCwiZGlzcGxheU5hbWUiOiJ0YW9sYWJpbmgxMjk5IiwicGhvbmVWZXJpZmllZCI6ZmFsc2UsImJvdCI6MCwiYXZhdGFyIjoiaHR0cHM6Ly9pbWFnZXMuc3dpbnNob3AubmV0L2ltYWdlcy9hdmF0YXIvYXZhdGFyXzAyLnBuZyIsInVzZXJJZCI6IjZhNWNmN2NmLTQ0ODYtNGJlNS1hMDIzLTUyOTkyOGUyZDg1YyIsInJlZ1RpbWUiOjE3NTI3NjcyOTk2OTgsInBob25lIjoiIiwiY3VzdG9tZXJJZCI6MjgzNTEyODQ1LCJicmFuZCI6InN1bi53aW4iLCJ1c2VybmFtZSI6IlNDX2FuaGxhdHJ1bWFwaTEiLCJ0aW1lc3RhbXAiOjE3NTI3ODczMDg2NTl9.5PQjsPsm2G7SyEnAbNqXtxkxYlMQIwcJpxjh1l_hH6c\",\"userId\":\"6a5cf7cf-4486-4be5-a023-529928e2d85c\",\"username\":\"SC_anhlatrumapi1\",\"timestamp\":1752787308659}",
    "signature": "5537B01C383416D3BE734483E7A84B7CAFB9ADFE81CE55406B2D455D205F437E453989E499C153EEDDEB8614D2A347C6E0E1D7335C8C39E8555E23775C0C3B7727DD1C2DBEF76ED82122FD56C83F117C07FC3AD12300BE2207F5046BEFF0D80A979D8146BA495E6425874D46A81DEFCA11427494D22C12C0C90427873AD0BFB3"
  }],
  [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
  [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]
];

// === WebSocket ===
let ws = null;
let pingInterval = null;
let reconnectTimeout = null;
let isManuallyClosed = false;

function duDoanTiepTheo(pattern) {
  if (pattern.length < 6) return "?";

  const last3 = pattern.slice(-3).join('');
  const last4 = pattern.slice(-4).join('');

  const count = pattern.join('').split(last3).length - 1;
  if (count >= 2) return last3[0];

  const count4 = pattern.join('').split(last4).length - 1;
  if (count4 >= 2) return last4[0];

  return "?";
}

function connectWebSocket() {
  ws = new WebSocket(
    "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsImdlbmRlciI6MCwiZGlzcGxheU5hbWUiOiJ0YW9sYWJpbmgxMjk5IiwicGhvbmVWZXJpZmllZCI6ZmFsc2UsImJvdCI6MCwiYXZhdGFyIjoiaHR0cHM6Ly9pbWFnZXMuc3dpbnNob3AubmV0L2ltYWdlcy9hdmF0YXIvYXZhdGFyXzAyLnBuZyIsInVzZXJJZCI6IjZhNWNmN2NmLTQ0ODYtNGJlNS1hMDIzLTUyOTkyOGUyZDg1YyIsInJlZ1RpbWUiOjE3NTI3NjcyOTk2OTgsInBob25lIjoiIiwiY3VzdG9tZXJJZCI6MjgzNTEyODQ1LCJicmFuZCI6InN1bi53aW4iLCJ1c2VybmFtZSI6IlNDX2FuaGxhdHJ1bWFwaTEiLCJ0aW1lc3RhbXAiOjE3NTI3ODczMDg2NTl9.5PQjsPsm2G7SyEnAbNqXtxkxYlMQIwcJpxjh1l_hH6c",
    {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Origin": "https://play.sun.win"
      }
    }
  );

  ws.on('open', () => {
    console.log('[✅] Đã kết nối WebSocket');
    messagesToSend.forEach((msg, i) => {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg));
        }
      }, i * 600);
    });

    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 15000);
  });

  ws.on('pong', () => {
    console.log('[📶] Ping OK');
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (Array.isArray(data) && typeof data[1] === 'object') {
        const cmd = data[1].cmd;

        if (cmd === 1008 && data[1].sid) {
          id_phien_chua_co_kq = data[1].sid;
        }

        if (cmd === 1003 && data[1].gBB) {
          const { d1, d2, d3 } = data[1];
          const total = d1 + d2 + d3;
          const result = total > 10 ? "T" : "X";

          patternHistory.push(result);
          if (patternHistory.length > 20) patternHistory.shift();

          const text = `${d1}-${d2}-${d3} = ${total} (${result === 'T' ? 'Tài' : 'Xỉu'})`;
          const du_doan = duDoanTiepTheo(patternHistory);

          currentData = {
            id: "binhtool90",
            id_phien: id_phien_chua_co_kq,
            ket_qua: text,
            pattern: patternHistory.join(''),
            du_doan: du_doan === "T" ? "Tài" : du_doan === "X" ? "Xỉu" : "?"
          };

          console.log(`🎲 Phiên ${id_phien_chua_co_kq}: ${text} → Dự đoán: ${currentData.du_doan}`);
          id_phien_chua_co_kq = null;
        }
      }
    } catch (e) {
      console.error('[❌] Lỗi xử lý:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('[🔌] Mất kết nối WebSocket. Đang reconnect...');
    clearInterval(pingInterval);
    if (!isManuallyClosed) {
      reconnectTimeout = setTimeout(connectWebSocket, 2500);
    }
  });

  ws.on('error', (err) => {
    console.error('[⚠️] WebSocket lỗi:', err.message);
  });
}

// === API ===
app.get('/taixiu', (req, res) => {
  res.json(currentData);
});

app.get('/', (req, res) => {
  res.send(`<h2>🎯 SunWin Tài Xỉu</h2><p><a href="/taixiu">Xem JSON kết quả</a></p>`);
});

// === Khởi động server ===
app.listen(PORT, () => {
  console.log(`[🌐] Server đang chạy tại http://localhost:${PORT}`);
  connectWebSocket();
});
