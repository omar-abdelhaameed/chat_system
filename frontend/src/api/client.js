import { clearSession, getStoredSession, storeSession } from "../storage";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function parseErrorMessage(status, data) {
  if (status === 404) return "This chat feature is not available on the server yet.";

  const detail = data?.detail || data?.message;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || JSON.stringify(item)).join(", ");
  }

  if (typeof detail === "string") return detail;

  if (status === 401) return "Your login is invalid or the session has expired.";
  if (status === 403) return "You are not a member of this room.";
  if (status === 409) return "That email, username, or room name already exists.";
  if (status >= 500) return "The server hit an error. Please try again.";
  return "Request failed.";
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function request(path, options = {}) {
  const session = getStoredSession();
  const token = options.token || session?.tokens?.access_token;
  const { token: _token, _retry, ...fetchOptions } = options;

  const isFormData = fetchOptions.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (response.status === 401 && session?.tokens?.refresh_token && !_retry) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh(newToken => {
          if (!newToken) {
            reject(new ApiError("Session expired. Please log in again.", { status: 401, code: "SESSION_EXPIRED" }));
            return;
          }
          options.token = newToken;
          resolve(request(path, { ...options, _retry: true }));
        });
      });
    }

    isRefreshing = true;
    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.tokens.refresh_token}`,
        },
        body: JSON.stringify({ refresh_token: session.tokens.refresh_token })
      });

      if (!refreshResponse.ok) {
        throw new Error("Session expired");
      }

      const data = await refreshResponse.json();
      session.tokens.access_token = data.access_token;
      if (data.refresh_token) {
        session.tokens.refresh_token = data.refresh_token;
      }
      storeSession(session);
      isRefreshing = false;
      onRefreshed(data.access_token);

      options.token = data.access_token;
      return request(path, { ...options, _retry: true });
    } catch (err) {
      isRefreshing = false;
      onRefreshed(null);
      clearSession();
      throw new ApiError("Session expired. Please log in again.", {
        status: 401,
        code: "SESSION_EXPIRED",
        details: err,
      });
    }
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    const message = parseErrorMessage(response.status, data);
    throw new ApiError(message, {
      status: response.status,
      code:
        response.status === 401
          ? "UNAUTHORIZED"
          : response.status === 403
            ? "FORBIDDEN"
            : response.status === 409
              ? "CONFLICT"
              : response.status >= 500
                ? "SERVER_ERROR"
                : "REQUEST_ERROR",
      details: data,
    });
  }

  return data;
}
