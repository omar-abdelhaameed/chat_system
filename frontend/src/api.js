export * from "./api/client";
export * from "./api/auth";
export * from "./api/rooms";
export * from "./api/messages";
export * from "./api/users";
export {
  clearSession,
  getStoredSession,
  storeSession,
} from "./storage";

// Kept for fallback in case backend login doesn't return user details
export function fallbackUserFromToken(email) {
  return {
    id: email,
    email,
    username: email.split("@")[0] || "user",
    birthday: "",
    profilePhotoUrl: "",
  };
}
