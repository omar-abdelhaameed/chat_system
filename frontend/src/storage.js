const SESSION_KEY = "chat.session";
const ROOM_SESSION_PREFIX = "chat.ws.session";
const ROOM_SEQUENCE_PREFIX = "chat.room.lastSequence";

export function getStoredSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function storeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getRoomSessionId(userId, roomId) {
  const key = `${ROOM_SESSION_PREFIX}.${userId}.${roomId}`;
  let sessionId = localStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(key, sessionId);
  }
  return sessionId;
}

export function getLastSequence(userId, roomId) {
  const value = localStorage.getItem(`${ROOM_SEQUENCE_PREFIX}.${userId}.${roomId}`);
  return Number(value || 0);
}

export function storeLastSequence(userId, roomId, sequenceNumber) {
  if (!Number.isFinite(sequenceNumber)) return;
  localStorage.setItem(`${ROOM_SEQUENCE_PREFIX}.${userId}.${roomId}`, String(sequenceNumber));
}
