/**
 * Connect Four — Firebase Realtime Database multiplayer
 * Exposes window.C4Firebase for the React app in index.html
 */
(function (global) {
  'use strict';

  const GLOBAL_USER_KEY = 'c4_global_username';
  const P1 = 'P1';
  const P2 = 'P2';

  let db = null;
  let auth = null;
  let uid = null;
  let ready = false;
  let initError = null;

  function cfg() {
    return global.FIREBASE_CONFIG;
  }

  function isConfigured() {
    const c = cfg();
    return c && c.apiKey && c.apiKey !== 'YOUR_API_KEY' && c.databaseURL;
  }

  const ROWS = 6;
  const COLS = 7;

  function emptyBoard() {
    return Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(null));
  }

  /** Firebase RTDB deletes null keys — empty holes become undefined and block moves */
  function normalizeBoard(board) {
    const out = emptyBoard();
    if (!board) return out;
    const rows = Array.isArray(board) ? board : Object.keys(board).sort((a, b) => +a - +b).map((k) => board[k]);
    for (let r = 0; r < ROWS; r++) {
      const row = rows[r];
      if (!row) continue;
      const cells = Array.isArray(row) ? row : Object.keys(row).sort((a, b) => +a - +b).map((k) => row[k]);
      for (let c = 0; c < COLS; c++) {
        const v = cells[c];
        out[r][c] = v === P1 || v === P2 ? v : null;
      }
    }
    return out;
  }

  function lbKey(name) {
    return String(name)
      .trim()
      .slice(0, 24)
      .replace(/[.#$[\]/]/g, '_') || 'player';
  }

  function genCode() {
    return String(1000 + Math.floor(Math.random() * 9000));
  }

  function newRoomId() {
    return db.ref('rooms/random').push().key;
  }

  function privateRef(code) {
    return db.ref('rooms/private/' + code);
  }

  function randomRoomRef(roomId) {
    return db.ref('rooms/random/' + roomId);
  }

  function queueRef() {
    return db.ref('random_queue');
  }

  function freshRoom(hostId, hostName, type, code) {
    return {
      type,
      code: code || null,
      status: 'waiting',
      hostId,
      guestId: null,
      hostName,
      guestName: null,
      board: emptyBoard(),
      current: P1,
      moveCount: 0,
      winInfo: null,
      isDraw: false,
      lastMove: null,
      rematchVotes: {},
      disconnected: null,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
    };
  }

  function friendlyFirebaseError(e) {
    const code = (e && e.code) || '';
    const msg = (e && e.message) || String(e);
    if (
      code === 'auth/configuration-not-found' ||
      msg.indexOf('configuration-not-found') !== -1
    ) {
      return (
        'Anonymous sign-in is not enabled. In Firebase Console open Authentication → Sign-in method → Anonymous → Enable. ' +
        'Then add sujindikasylzada-cyber.github.io under Authentication → Settings → Authorized domains.'
      );
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Anonymous sign-in is disabled in Firebase. Enable it under Authentication → Sign-in method.';
    }
    return msg;
  }

  async function ensureAuth() {
    if (auth.currentUser) {
      uid = auth.currentUser.uid;
      return uid;
    }
    const cred = await auth.signInAnonymously();
    uid = cred.user.uid;
    return uid;
  }

  async function init() {
    if (ready) return { ok: true, uid };
    if (!isConfigured()) {
      initError = 'Firebase is not configured. Edit firebase-config.js with your project credentials.';
      return { ok: false, error: initError };
    }
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(cfg());
      }
      auth = firebase.auth();
      db = firebase.database();
      await ensureAuth();
      ready = true;
      initError = null;
      return { ok: true, uid };
    } catch (e) {
      initError = friendlyFirebaseError(e);
      return { ok: false, error: initError };
    }
  }

  function roleFromRoom(room, playerUid) {
    if (!room || !playerUid) return null;
    if (room.hostId === playerUid) return P1;
    if (room.guestId === playerUid) return P2;
    return null;
  }

  function setPresence(roomPath, role, connected) {
    if (!roomPath || !role || !db) return;
    const ref = db.ref(roomPath);
    const patch = { updatedAt: firebase.database.ServerValue.TIMESTAMP };
    if (role === P1) patch.hostConnected = connected;
    else patch.guestConnected = connected;
    if (connected) {
      patch.disconnected = null;
      ref.update(patch);
      const who = role === P1 ? 'host' : 'guest';
      ref.onDisconnect().update({
        disconnected: who,
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
      });
    } else {
      patch.disconnected = role === P1 ? 'host' : 'guest';
      ref.update(patch);
      ref.onDisconnect().cancel();
    }
  }

  async function createPrivateRoom(hostName) {
    const r = await init();
    if (!r.ok) return r;
    let code;
    let attempts = 0;
    while (attempts < 12) {
      code = genCode();
      const snap = await privateRef(code).once('value');
      if (!snap.exists()) break;
      attempts++;
    }
    if (attempts >= 12) return { ok: false, error: 'Could not generate a room code. Try again.' };
    const room = freshRoom(uid, hostName, 'private', code);
    await privateRef(code).set(room);
    const roomPath = 'rooms/private/' + code;
    setPresence(roomPath, P1, true);
    return { ok: true, code, roomPath, role: P1, isHost: true, hostName, waiting: true };
  }

  async function joinPrivateRoom(code, guestName) {
    const r = await init();
    if (!r.ok) return r;
    const trimmed = String(code || '').trim();
    if (!/^\d{4}$/.test(trimmed)) return { ok: false, error: 'Enter a valid 4-digit room code.' };
    const ref = privateRef(trimmed);
    const result = await ref.transaction((room) => {
      if (!room) return room;
      if (room.status !== 'waiting') return;
      if (room.guestId) return;
      if (room.hostId === uid) return;
      room.guestId = uid;
      room.guestName = guestName;
      room.status = 'playing';
      room.updatedAt = firebase.database.ServerValue.TIMESTAMP;
      return room;
    });
    if (!result.committed || !result.snapshot.val()) {
      return { ok: false, error: 'Room not found or already full.' };
    }
    const roomPath = 'rooms/private/' + trimmed;
    setPresence(roomPath, P2, true);
    const joined = result.snapshot.val();
    return {
      ok: true,
      code: trimmed,
      roomPath,
      role: P2,
      isHost: false,
      waiting: false,
      hostName: joined.hostName,
      guestName: joined.guestName,
    };
  }

  async function joinRandomQueue(playerName) {
    const r = await init();
    if (!r.ok) return r;
    const q = queueRef();
    let outcome = null;

    const tx = await q.transaction((queue) => {
      if (queue && queue.roomId && queue.hostId && queue.hostId !== uid) {
        outcome = { action: 'join', roomId: queue.roomId, hostId: queue.hostId, hostName: queue.hostName };
        return null;
      }
      const roomId = newRoomId();
      outcome = { action: 'create', roomId, hostId: uid, hostName: playerName };
      return {
        roomId,
        hostId: uid,
        hostName: playerName,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
      };
    });

    if (!tx.committed || !outcome) {
      return { ok: false, error: 'Matchmaking failed. Please try again.' };
    }

    if (outcome.action === 'create') {
      const room = freshRoom(uid, playerName, 'random', null);
      const roomPath = 'rooms/random/' + outcome.roomId;
      await randomRoomRef(outcome.roomId).set(room);
      setPresence(roomPath, P1, true);
      return { ok: true, roomPath, role: P1, isHost: true, waiting: true, roomId: outcome.roomId };
    }

    const roomPath = 'rooms/random/' + outcome.roomId;
    const joinTx = await randomRoomRef(outcome.roomId).transaction((room) => {
      if (!room) return room;
      if (room.guestId) return;
      if (room.hostId === uid) return;
      room.guestId = uid;
      room.guestName = playerName;
      room.status = 'playing';
      room.updatedAt = firebase.database.ServerValue.TIMESTAMP;
      return room;
    });

    if (!joinTx.committed) {
      await q.remove();
      return { ok: false, error: 'Opponent room was taken. Try again.' };
    }
    await q.remove();
    setPresence(roomPath, P2, true);
    const joined = joinTx.snapshot.val();
    return {
      ok: true,
      roomPath,
      role: P2,
      isHost: false,
      waiting: false,
      roomId: outcome.roomId,
      hostName: joined.hostName,
      guestName: joined.guestName,
    };
  }

  function normalizeRoom(room) {
    if (!room) return room;
    if (room.board) room.board = normalizeBoard(room.board);
    return room;
  }

  function subscribeRoom(roomPath, onUpdate) {
    const ref = db.ref(roomPath);
    const handler = (snap) => onUpdate(normalizeRoom(snap.val()));
    ref.on('value', handler);
    return () => ref.off('value', handler);
  }

  function watchRandomRoom(roomPath, onReady) {
    const ref = db.ref(roomPath);
    const handler = (snap) => {
      const room = snap.val();
      if (room && room.status === 'playing' && room.guestId) {
        onReady(room);
      }
    };
    ref.on('value', handler);
    return () => ref.off('value', handler);
  }

  async function dropPiece(roomPath, col, player, helpers) {
    const { isValidCol, dropPiece: drop, checkWinner, isDraw, getDropRow } = helpers;
    const ref = db.ref(roomPath);
    let applied = false;
    const result = await ref.transaction((room) => {
      if (!room) return room;
      if (room.status !== 'playing') return room;
      if (room.current !== player) return room;
      const board = normalizeBoard(room.board);
      if (!isValidCol(board, col)) return room;
      const row = getDropRow(board, col);
      const next = drop(board, col, player);
      if (!next) return room;
      room.board = next;
      room.moveCount = (room.moveCount || 0) + 1;
      room.lastMove = { col, row, player, at: Date.now() };
      const win = checkWinner(next);
      if (win) {
        room.winInfo = win;
        room.status = 'finished';
        room.current = null;
      } else if (isDraw(next)) {
        room.isDraw = true;
        room.status = 'finished';
        room.current = null;
      } else {
        room.current = player === P1 ? P2 : P1;
      }
      room.updatedAt = firebase.database.ServerValue.TIMESTAMP;
      applied = true;
      return room;
    });
    return { ok: result.committed && applied, reason: result.committed ? (applied ? null : 'not_applied') : 'transaction_failed' };
  }

  async function requestRematch(roomPath, playerUid) {
    const ref = db.ref(roomPath);
    const result = await ref.transaction((room) => {
      if (!room) return room;
      if (!room.rematchVotes) room.rematchVotes = {};
      room.rematchVotes[playerUid] = true;
      const votes = room.rematchVotes;
      const hostReady = !!votes[room.hostId];
      const guestReady = room.guestId ? !!votes[room.guestId] : false;
      if (hostReady && guestReady) {
        room.board = emptyBoard();
        room.current = P1;
        room.moveCount = 0;
        room.winInfo = null;
        room.isDraw = false;
        room.lastMove = null;
        room.status = 'playing';
        room.rematchVotes = {};
        room.disconnected = null;
      }
      room.updatedAt = firebase.database.ServerValue.TIMESTAMP;
      return room;
    });
    return result.committed;
  }

  async function leaveRoom(roomPath, playerUid) {
    if (!db || !roomPath) return;
    const ref = db.ref(roomPath);
    const snap = await ref.once('value');
    const room = snap.val();
    if (!room) return;
    const role = roleFromRoom(room, playerUid);
    if (role === P1) {
      await ref.update({
        disconnected: 'host',
        status: 'finished',
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
      });
    } else if (role === P2) {
      await ref.update({
        disconnected: 'guest',
        status: 'finished',
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
      });
    }
    if (room.type === 'random') {
      await queueRef().remove();
    }
    ref.onDisconnect().cancel();
  }

  async function fetchGlobalLeaderboard(limit) {
    const r = await init();
    if (!r.ok) return [];
    const snap = await db.ref('leaderboard').once('value');
    const data = snap.val() || {};
    return Object.entries(data)
      .map(([key, row]) => ({
        key,
        name: row.name || key,
        wins: row.wins || 0,
        updatedAt: row.updatedAt || 0,
      }))
      .sort((a, b) => b.wins - a.wins || b.updatedAt - a.updatedAt)
      .slice(0, limit || 10);
  }

  async function recordGlobalWin(username) {
    const r = await init();
    if (!r.ok) return r;
    const name = String(username || '').trim();
    if (!name) return { ok: false, error: 'Username required' };
    const key = lbKey(name);
    const ref = db.ref('leaderboard/' + key);
    await ref.transaction((row) => {
      if (!row) row = { name, wins: 0, updatedAt: 0 };
      row.name = name;
      row.wins = (row.wins || 0) + 1;
      row.updatedAt = firebase.database.ServerValue.TIMESTAMP;
      return row;
    });
    saveUsername(name);
    return { ok: true };
  }

  function getSavedUsername() {
    try {
      return localStorage.getItem(GLOBAL_USER_KEY) || '';
    } catch {
      return '';
    }
  }

  function saveUsername(name) {
    try {
      localStorage.setItem(GLOBAL_USER_KEY, String(name).trim());
    } catch (_) {}
  }

  function cancelQueue() {
    if (!db) return Promise.resolve();
    return queueRef().remove();
  }

  global.C4Firebase = {
    init,
    isReady: () => ready,
    isConfigured,
    getInitError: () => initError,
    getUid: () => uid,
    createPrivateRoom,
    joinPrivateRoom,
    joinRandomQueue,
    subscribeRoom,
    watchRandomRoom,
    dropPiece,
    requestRematch,
    leaveRoom,
    setPresence,
    roleFromRoom,
    fetchGlobalLeaderboard,
    recordGlobalWin,
    getSavedUsername,
    saveUsername,
    cancelQueue,
    GLOBAL_USER_KEY,
  };
})(typeof window !== 'undefined' ? window : this);
