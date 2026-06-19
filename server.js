#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const rooms = new Map();
const clients = new Map();

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const safePath = path.normalize(urlPath === '/' ? '/home.html' : urlPath).replace(/^\/+/, '');
  const filePath = path.join(ROOT, safePath);
  if (!filePath.startsWith(ROOT)) return send(res, 403, 'Forbidden');
  fs.readFile(filePath, (error, content) => {
    if (error) return send(res, error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? 'Not found' : 'Server error');
    res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  });
});

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

server.on('upgrade', (req, socket) => {
  if (req.headers.upgrade?.toLowerCase() !== 'websocket') return socket.destroy();
  const accept = crypto.createHash('sha1')
    .update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '',
    ''
  ].join('\r\n'));

  const id = crypto.randomUUID();
  clients.set(socket, { id, room: null, name: 'Player', game: 'casino' });
  socket.on('data', (buffer) => handleFrame(socket, buffer));
  socket.on('close', () => leave(socket));
  socket.on('error', () => leave(socket));
});

function handleFrame(socket, buffer) {
  const message = decodeFrame(buffer);
  if (!message) return;
  let data;
  try { data = JSON.parse(message); } catch { return; }
  if (data.type === 'join') return join(socket, data);
  const client = clients.get(socket);
  if (!client?.room) return;
  broadcast(client.room, { ...data, from: client.id, fromName: client.name, sentAt: Date.now() });
}

function join(socket, data) {
  const client = clients.get(socket);
  if (!client) return;
  leave(socket, false);
  client.room = clean(data.room || 'lobby');
  client.name = clean(data.name || 'Player');
  client.game = clean(data.game || 'casino');
  if (!rooms.has(client.room)) rooms.set(client.room, new Set());
  rooms.get(client.room).add(socket);
  sendWs(socket, { type: 'joined', id: client.id, room: client.room, players: players(client.room) });
  broadcast(client.room, { type: 'players', players: players(client.room), sentAt: Date.now() });
}

function leave(socket, removeClient = true) {
  const client = clients.get(socket);
  if (!client) return;
  if (client.room && rooms.has(client.room)) {
    rooms.get(client.room).delete(socket);
    broadcast(client.room, { type: 'players', players: players(client.room), sentAt: Date.now() });
    if (rooms.get(client.room).size === 0) rooms.delete(client.room);
  }
  client.room = null;
  if (removeClient) clients.delete(socket);
}

function players(room) {
  return [...(rooms.get(room) || [])].map((socket) => {
    const client = clients.get(socket);
    return { id: client.id, name: client.name, game: client.game };
  });
}

function clean(value) {
  return String(value).trim().slice(0, 40).replace(/[^\w\s-]/g, '') || 'Player';
}

function broadcast(room, payload) {
  for (const socket of rooms.get(room) || []) sendWs(socket, payload);
}

function sendWs(socket, payload) {
  if (!socket.writable) return;
  const data = Buffer.from(JSON.stringify(payload));
  const header = data.length < 126 ? Buffer.from([0x81, data.length]) : Buffer.from([0x81, 126, data.length >> 8, data.length & 255]);
  socket.write(Buffer.concat([header, data]));
}

function decodeFrame(buffer) {
  const opcode = buffer[0] & 0x0f;
  if (opcode === 0x8) return null;
  let offset = 2;
  let length = buffer[1] & 0x7f;
  if (length === 126) { length = buffer.readUInt16BE(offset); offset += 2; }
  if (length === 127) return null;
  const masked = Boolean(buffer[1] & 0x80);
  const mask = masked ? buffer.slice(offset, offset + 4) : null;
  if (masked) offset += 4;
  const payload = buffer.slice(offset, offset + length);
  if (masked) for (let index = 0; index < payload.length; index++) payload[index] ^= mask[index % 4];
  return payload.toString('utf8');
}

server.listen(PORT, () => console.log(`Casino multiplayer server running at http://localhost:${PORT}`));
