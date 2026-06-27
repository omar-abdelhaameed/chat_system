import { request } from "./client";

export async function fetchMessages(roomId, limit = 50, beforeSequence = null) {
  let url = `/rooms/${roomId}/messages?limit=${limit}`;
  if (beforeSequence !== null) {
    url += `&before_sequence=${beforeSequence}`;
  }
  return request(url);
}

export function normalizeMessage(message) {
  const sequenceNumber = Number(message.sequenceNumber ?? message.sequence_number ?? 0);
  const messageId = message.id || message.message_id || message.client_message_id;

  return {
    id: String(messageId || crypto.randomUUID()),
    messageId: message.message_id || message.id || null,
    roomId: message.roomId || message.room_id || null,
    senderId: message.senderId || message.sender_id || null,
    senderName: message.senderName || message.sender_username || "User",
    senderProfilePhotoUrl: message.senderProfilePhotoUrl || message.sender_profile_photo_url || "",
    content: message.content || "",
    sequenceNumber,
    clientMessageId: message.clientMessageId || message.client_message_id || null,
    createdAt: message.createdAt || message.created_at || new Date().toISOString(),
    readBy: message.readBy || message.read_by || [],
    state: message.state || "confirmed",
    raw: message,
  };
}
