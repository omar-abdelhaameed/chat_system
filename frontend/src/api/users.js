import { request } from "./client";

export async function fetchCurrentUser(token) {
  return request("/users/me", token ? { token } : {});
}

export async function updateCurrentUser(payload) {
  return request("/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function uploadProfilePhoto(file) {
  const formData = new FormData();
  formData.append("photo", file);
  return request("/users/me/photo", {
    method: "POST",
    body: formData,
  });
}

export async function searchUsers(username, limit = 10) {
  const params = new URLSearchParams({
    username,
    limit: String(limit),
  });
  return request(`/users/search?${params.toString()}`);
}

export function normalizeUser(user) {
  return {
    id: String(user.id || user.user_id || user.email || ""),
    email: user.email || "",
    username: user.username || user.name || user.email?.split("@")[0] || "user",
    birthday: user.birthday || "",
    profilePhotoUrl: user.profile_photo_url || user.profilePhotoUrl || "",
    raw: user,
  };
}
