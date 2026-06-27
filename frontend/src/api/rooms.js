import { request } from "./client";

export async function fetchRooms() {
  return request("/rooms");
}

export async function createRoom(name) {
  return request("/rooms", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function joinRoom(roomId) {
  return request(`/rooms/${roomId}/join`, {
    method: "POST",
  });
}

export async function fetchRoom(roomId) {
  return request(`/rooms/${roomId}`);
}

export async function updateRoom(roomId, payload) {
  return request(`/rooms/${roomId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function uploadRoomPhoto(roomId, file) {
  const formData = new FormData();
  formData.append("photo", file);

  return request(`/rooms/${roomId}/photo`, {
    method: "POST",
    body: formData,
  });
}

export async function deleteRoom(roomId) {
  return request(`/rooms/${roomId}`, {
    method: "DELETE",
  });
}

export async function fetchRoomMembers(roomId) {
  return request(`/rooms/${roomId}/members`);
}

export async function createDirectRoom(userId) {
  return request("/rooms/direct", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function updateReadState(roomId, sequenceNumber) {
  return request(`/rooms/${roomId}/read-state`, {
    method: "PATCH",
    body: JSON.stringify({ last_read_sequence_number: sequenceNumber }),
  });
}

export function normalizeRoom(room, index = 0) {
  const memberCount = Array.isArray(room.members)
    ? room.members.length
    : room.members || room.member_count || 1;

  const accents = [
    "from-green/90 to-blue/80",
    "from-orange/90 to-red/80",
    "from-blue/90 to-green/70",
    "from-muted/70 to-tile",
  ];

  return {
    id: String(room.id || room.room_id),
    name: room.name || "Untitled room",
    description: room.description || "Room created",
    members: memberCount,
    unread: room.unread || 0,
    status: room.status || "idle",
    accent: room.accent || accents[index % accents.length],
    lastSequence: room.lastSequence || room.last_sequence_number || 0,
    createdById: room.createdById || room.created_by_id || room.creator_id || "",
    createdByName: room.createdByName || room.created_by_username || "",
    createdByProfilePhotoUrl: room.createdByProfilePhotoUrl || room.created_by_profile_photo_url || "",
    photoUrl: room.photoUrl || room.photo_url || room.image_url || room.avatar_url || "",
    isDirect: room.isDirect ?? room.is_direct ?? room.direct ?? false,
    joined: room.joined ?? room.is_member ?? false,
    raw: room,
  };
}
