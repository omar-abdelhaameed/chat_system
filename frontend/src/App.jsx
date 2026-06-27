import {
  Avatar,
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  ScrollShadow,
  Spinner,
} from "@heroui/react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CircleDot,
  Clock3,
  ImagePlus,
  Info,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Signal,
  Trash2,
  UserPlus,
  UserRound,
  UsersRound,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearSession,
  createDirectRoom,
  createRoom,
  deleteRoom,
  fallbackUserFromToken,
  fetchCurrentUser,
  fetchMessages,
  fetchRoom,
  fetchRoomMembers,
  fetchRooms,
  getStoredSession,
  login,
  normalizeMessage,
  normalizeRoom,
  normalizeUser,
  register,
  storeSession,
  searchUsers,
  updateReadState,
  updateCurrentUser,
  updateRoom,
  uploadRoomPhoto,
  uploadProfilePhoto,
} from "./api";
import { getLastSequence, storeLastSequence } from "./storage";
import { ChatSocket } from "./realtime/chatSocket";

const connectionCopy = {
  connected: "Connected",
  connecting: "Connecting",
  reconnecting: "Reconnecting",
  offline: "Offline",
  idle: "Idle",
  rate_limited: "Paused",
};

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getMessageSequence(message) {
  return Number(message.sequenceNumber ?? message.sequence_number ?? 0);
}

function getMessageKey(message) {
  if (message.messageId && !String(message.messageId).startsWith("local-")) return `id:${message.messageId}`;
  if (message.id && !String(message.id).startsWith("local-")) return `id:${message.id}`;
  if (message.clientMessageId) return `client:${message.clientMessageId}`;
  if (message.client_message_id) return `client:${message.client_message_id}`;
  if (message.roomId && getMessageSequence(message)) return `seq:${message.roomId}:${getMessageSequence(message)}`;
  if (message.room_id && getMessageSequence(message)) return `seq:${message.room_id}:${getMessageSequence(message)}`;
  return `local:${message.id}`;
}

function mergeMessages(existing, incoming) {
  const byKey = new Map();

  for (const message of existing) {
    byKey.set(getMessageKey(message), message);
  }

  for (const message of incoming) {
    const normalized = normalizeMessage(message);
    const clientKey = normalized.clientMessageId ? `client:${normalized.clientMessageId}` : null;
    const stableKey = getMessageKey(normalized);

    if (clientKey && byKey.has(clientKey)) {
      byKey.set(clientKey, {
        ...byKey.get(clientKey),
        ...normalized,
        state: "confirmed",
      });
      continue;
    }

    if (!clientKey) {
      const pending = Array.from(byKey.entries()).find(([, existingMessage]) => {
        return (
          existingMessage.state === "pending" &&
          existingMessage.senderId === normalized.senderId &&
          existingMessage.content === normalized.content
        );
      });

      if (pending) {
        byKey.delete(pending[0]);
        byKey.set(stableKey, {
          ...pending[1],
          ...normalized,
          state: "confirmed",
        });
        continue;
      }
    }

    byKey.set(stableKey, {
      ...(byKey.get(stableKey) || {}),
      ...normalized,
    });
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const aSeq = getMessageSequence(a);
    const bSeq = getMessageSequence(b);
    if (aSeq && bSeq) return aSeq - bSeq;
    if (aSeq) return -1;
    if (bSeq) return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function latestSequence(messages) {
  return Math.max(0, ...messages.map(getMessageSequence));
}

function applyReadReceiptToMessages(messages, receipt, currentUserId) {
  const readerId = receipt.user_id || receipt.userId;
  const readerName = receipt.user_username || receipt.userName || readerId;
  const lastReadSequence = Number(receipt.last_read_sequence_number || receipt.lastReadSequenceNumber || 0);
  if (!readerId || !lastReadSequence) return messages;
  if (readerId === currentUserId) return messages;

  return messages.map((message) => {
    const sequence = getMessageSequence(message);
    if (!sequence || sequence > lastReadSequence || message.senderId !== currentUserId) return message;

    const existing = message.readBy || [];
    if (existing.some((reader) => (reader.id || reader.user_id || reader) === readerId)) return message;

    return {
      ...message,
      readBy: [
        ...existing,
        {
          id: readerId,
          username: readerName,
          profilePhotoUrl: receipt.user_profile_photo_url || "",
          readAt: receipt.read_at || null,
        },
      ],
    };
  });
}

function formatTime(value) {
  if (!value) return "";
  if (/^\d{1,2}:\d{2}/.test(String(value))) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toApiProfile(profile) {
  return {
    username: profile.username.trim(),
    birthday: profile.birthday || null,
  };
}

function UserAvatar({ src, name, className }) {
  if (src) {
    return (
      <span
        className={cx("inline-flex shrink-0 overflow-hidden rounded-full bg-panel2 text-green", className)}
        title={name}
      >
        <img
          src={src}
          alt={name ? `${name} profile photo` : "Profile photo"}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return <Avatar name={name} className={className} />;
}

function RoomAvatar({ room, className }) {
  if (room?.photoUrl) {
    return (
      <span className={cx("inline-flex shrink-0 overflow-hidden bg-panel2", className)} title={room.name}>
        <img src={room.photoUrl} alt={`${room.name} room photo`} className="h-full w-full object-cover" />
      </span>
    );
  }

  return <span className={cx("inline-flex shrink-0 bg-gradient-to-br", room?.accent, className)} />;
}

function StatusPill({ status }) {
  const color =
    status === "connected"
      ? "success"
      : status === "reconnecting" || status === "rate_limited"
        ? "warning"
        : status === "offline"
          ? "danger"
          : "default";
  const tone =
    status === "connected"
      ? "text-green"
      : status === "reconnecting" || status === "rate_limited"
        ? "text-orange"
        : status === "offline"
          ? "text-red"
          : "text-muted";

  return (
    <Chip
      color={color}
      size="sm"
      variant="flat"
      className={cx("h-6 text-xs font-bold", tone)}
    >
      <CircleDot className="mr-1 inline h-3 w-3" />
      {connectionCopy[status] || status}
    </Chip>
  );
}

function ErrorBox({ message, actionLabel, onAction }) {
  if (!message) return null;

  return (
    <Card className="border border-red/30 bg-red/10 shadow-none">
      <CardContent className="px-4 py-3 text-sm text-red">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-5">{message}</p>
        </div>
      {actionLabel && (
        <Button
          type="button"
          onClick={onAction}
          size="sm"
          className="mt-3 bg-panel2 text-xs font-bold uppercase tracking-[1.4px] text-white hover:bg-tile"
        >
          {actionLabel}
        </Button>
      )}
      </CardContent>
    </Card>
  );
}

function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    email: "",
    username: "",
    birthday: "",
    password: "",
  });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);

  function validate() {
    if (!form.email.trim()) return "Email is required.";
    if (mode === "register" && !form.username.trim()) return "Username is required.";
    if (mode === "register" && !form.birthday) return "Birthday is required.";
    if (!form.password) return "Password is required.";
    if (mode === "register" && form.password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      if (mode === "register") {
        await register({
          email: form.email.trim(),
          username: form.username.trim(),
          birthday: form.birthday,
          password: form.password,
        });
        setMode("login");
        setForm((current) => ({ ...current, password: "" }));
        setNotice("Account created. Log in with the same credentials.");
        return;
      }

      const tokens = await login({
        email: form.email.trim(),
        password: form.password,
      });
      let user = fallbackUserFromToken(form.email.trim());
      try {
        user = normalizeUser(await fetchCurrentUser(tokens.access_token));
      } catch {
        user = fallbackUserFromToken(form.email.trim());
      }
      const session = {
        tokens,
        user,
      };
      storeSession(session);
      onAuthenticated(session);
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-ink text-white">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-8 px-5 py-6 md:grid-cols-[1.1fr_0.9fr] md:px-8">
        <section className="flex flex-col justify-between rounded-lg bg-panel p-5 shadow-heavy md:p-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-green text-black">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-normal">Real-Time Chat</h1>
                <p className="text-sm text-muted">Rooms, ordered messages, and live state</p>
              </div>
            </div>

            <div className="mt-16 max-w-2xl">
              <h2 className="text-4xl font-bold leading-tight md:text-6xl">
                Join the room where every message has its place.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted">
                A production-focused client for JWT auth, room membership, WebSocket sessions,
                secure rooms, live messaging, read receipts, and typing presence.
              </p>
            </div>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            {[
              ["JWT", "Access and refresh tokens", ShieldCheck],
              ["Delivery", "Reliable message flow", Radio],
              ["Recovery", "Resume from last read", Signal],
            ].map(([title, body, Icon]) => (
              <div key={title} className="rounded-md bg-panel2 p-4">
                <Icon className="h-5 w-5 text-green" />
                <p className="mt-3 text-sm font-bold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center">
          <form onSubmit={handleSubmit} className="w-full rounded-lg bg-panel p-5 shadow-heavy md:p-7">
            <div className="mb-6 flex rounded-full bg-panel2 p-1">
              {["login", "register"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setMode(item);
                    setError("");
                    setNotice("");
                  }}
                  className={cx(
                    "h-10 flex-1 rounded-full text-sm font-bold uppercase tracking-[1.4px] transition",
                    mode === item ? "bg-green text-black" : "text-muted hover:text-white",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>

            <label className="text-xs font-bold uppercase tracking-[1.4px] text-muted">Email</label>
            <Input
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="mt-2 h-12 w-full rounded-full bg-panel2 px-5 text-sm text-white shadow-insetline outline-none focus:ring-2 focus:ring-white"
              type="email"
              autoComplete="email"
            />

            {mode === "register" && (
              <>
                <label className="mt-5 block text-xs font-bold uppercase tracking-[1.4px] text-muted">
                  Username
                </label>
                <Input
                  value={form.username}
                  onChange={(event) => setForm({ ...form, username: event.target.value })}
                  className="mt-2 h-12 w-full rounded-full bg-panel2 px-5 text-sm text-white shadow-insetline outline-none focus:ring-2 focus:ring-white"
                  autoComplete="username"
                />
                <label className="mt-5 block text-xs font-bold uppercase tracking-[1.4px] text-muted">
                  Birthday
                </label>
                <Input
                  value={form.birthday}
                  onChange={(event) => setForm({ ...form, birthday: event.target.value })}
                  className="mt-2 h-12 w-full rounded-full bg-panel2 px-5 text-sm text-white shadow-insetline outline-none focus:ring-2 focus:ring-white"
                  type="date"
                  autoComplete="bday"
                />
              </>
            )}

            <label className="mt-5 block text-xs font-bold uppercase tracking-[1.4px] text-muted">
              Password
            </label>
            <Input
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="mt-2 h-12 w-full rounded-full bg-panel2 px-5 text-sm text-white shadow-insetline outline-none focus:ring-2 focus:ring-white"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            {notice && <div className="mt-5 rounded-md bg-green/10 px-4 py-3 text-sm text-green">{notice}</div>}
            <ErrorBox message={error} />

            <Button
              type="submit"
              isDisabled={isSubmitting}
              className="mt-7 h-12 w-full bg-green px-5 text-sm font-bold uppercase tracking-[1.6px] text-black transition hover:scale-[1.01] disabled:cursor-wait disabled:opacity-70"
            >
              {isSubmitting && <Spinner color="current" size="sm" />}
              {isSubmitting ? "Working" : mode === "login" ? "Log in" : "Create account"}
            </Button>

          </form>
        </section>
      </div>
    </main>
  );
}

function Sidebar({ user, rooms, activeRoomId, activeView, onNavigate, onSelectRoom, onLogout, mobileOpen, onClose }) {
  return (
    <aside
      className={cx(
        "fixed inset-y-0 left-0 z-40 flex w-[292px] flex-col bg-ink px-3 py-3 transition-transform lg:static lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="mb-3 flex shrink-0 items-center justify-between rounded-[22px] bg-panel p-4 shadow-heavy">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-green text-black">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold">Real-Time Chat</p>
            <p className="text-xs text-muted">Secure workspace</p>
          </div>
        </div>
        <button className="icon-button lg:hidden" onClick={onClose} aria-label="Close rooms">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="shrink-0 space-y-1 rounded-[22px] bg-panel p-2 shadow-heavy">
        {[
          ["rooms", "Rooms", MessageCircle],
          ["people", "People", UsersRound],
          ["alerts", "Alerts", Bell],
          ["settings", "Settings", Settings],
        ].map(([view, label, Icon]) => (
          <button
            key={label}
            onClick={() => onNavigate(view)}
            className={cx(
              "flex h-11 w-full items-center gap-3 rounded-full px-3 text-sm transition",
              activeView === view ? "bg-panel2 font-bold text-white" : "text-muted hover:bg-panel2 hover:text-white",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-[22px] bg-panel p-2 shadow-heavy">
        <div className="flex shrink-0 items-center justify-between px-2 py-2">
          <p className="text-xs font-bold uppercase tracking-[1.4px] text-muted">Your rooms</p>
          <span className="rounded-full bg-panel2 px-2 py-1 text-xs font-bold">{rooms.length}</span>
        </div>
        <div className="mt-1 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className={cx(
                "group flex w-full gap-3 rounded-[18px] p-2 text-left transition",
                activeView === "rooms" && activeRoomId === room.id ? "bg-panel2 text-white" : "text-muted hover:bg-panel2/80 hover:text-white",
              )}
            >
              <RoomAvatar room={room} className="h-12 w-12 rounded-full shadow-medium" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-bold">{room.name}</p>
                  {room.unread > 0 && (
                    <span className="rounded-full bg-green px-2 py-0.5 text-[10px] font-bold text-black">
                      {room.unread}
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{room.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 shrink-0 rounded-[22px] bg-panel p-3 shadow-heavy">
        <div className="flex items-center gap-3">
          <UserAvatar
            src={user.profilePhotoUrl || undefined}
            name={user.username}
            className="h-10 w-10 shrink-0 bg-panel2 text-green"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user.username}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <button className="icon-button" onClick={onLogout} aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function RoomList({
  rooms,
  activeRoomId,
  onSelectRoom,
  onCreateRoom,
  onRetry,
  query,
  onQueryChange,
  isLoading,
  error,
}) {
  const [name, setName] = useState("");
  const [formError, setFormError] = useState("");
  const [isCreating, setCreating] = useState(false);

  const filteredRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rooms;
    return rooms.filter((room) => room.name.toLowerCase().includes(normalized));
  }, [query, rooms]);

  async function submit(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setFormError("Room name must be at least 3 characters.");
      return;
    }

    setFormError("");
    setCreating(true);
    try {
      await onCreateRoom(trimmed);
      setName("");
    } catch (err) {
      setFormError(err.message || "Failed to create room.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="hidden min-w-[292px] max-w-[376px] flex-col border-l border-line/25 border-r border-line/25 bg-panel px-4 py-4 md:flex">
      <div className="app-panel p-4">
        <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-kicker">Joined rooms</p>
          <h2 className="mt-1 text-2xl font-bold">Rooms</h2>
          <p className="mt-1 text-sm text-muted">Your active conversations</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-full bg-green text-black shadow-medium">
          <MessageCircle className="h-5 w-5" />
        </div>
        </div>
      </div>

      <label className="field-pill mt-4 flex h-11 items-center gap-3">
        <Search className="h-4 w-4 text-muted" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-muted"
          placeholder="Search rooms"
        />
      </label>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="field-pill h-11 min-w-0 flex-1"
            placeholder="New room"
            aria-label="New room name"
          />
          <button
            disabled={isCreating}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-green text-black shadow-medium transition hover:scale-[1.03] disabled:opacity-60"
            aria-label={isCreating ? "Creating room" : "Create room"}
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
          </button>
        </div>
        {formError && <p className="px-2 text-xs text-red">{formError}</p>}
      </form>

      <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-panel2 p-4 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading rooms
          </div>
        )}

        {!isLoading && error && (
          <ErrorBox message={error} actionLabel="Retry API" onAction={onRetry} />
        )}

        {!isLoading && !error && filteredRooms.length === 0 && (
          <div className="rounded-[22px] bg-panel2 p-5 text-center shadow-medium">
            <p className="text-sm font-bold">No joined rooms yet</p>
            <p className="mt-1 text-xs leading-5 text-muted">Create a room or start a direct chat to begin.</p>
          </div>
        )}

        {!error &&
          filteredRooms.map((room) => (
            <button
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className={cx(
                "room-card",
                activeRoomId === room.id ? "room-card-active" : "",
              )}
            >
              <div className="flex items-center gap-3">
                <RoomAvatar room={room} className="h-12 w-12 rounded-full shadow-medium" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{room.name}</p>
                  <p className="mt-1 truncate text-xs text-muted">{room.description}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-muted">
                  <UsersRound className="h-3.5 w-3.5" />
                  {room.members} members
                </span>
                <span className="text-xs text-muted">{room.unread > 0 ? `${room.unread} unread` : "Joined"}</span>
              </div>
            </button>
          ))}
      </div>
    </section>
  );
}

function MessageBubble({ message, isMine }) {
  const isPending = message.state === "pending";
  const isFailed = message.state === "failed";
  const hasReaders = (message.readBy || []).length > 0;
  const receiptLabel = isFailed ? "Failed" : isPending ? "Pending" : hasReaders ? "Seen" : "Sent";
  const receiptTone = isFailed ? "danger" : isPending ? "warning" : hasReaders ? "success" : "default";

  return (
    <div className={cx("flex items-end gap-2", isMine ? "justify-end" : "justify-start")}>
      {!isMine && (
        <UserAvatar
          src={message.senderProfilePhotoUrl || undefined}
          name={message.senderName}
          className="mb-1 h-8 w-8 shrink-0 bg-panel text-green"
        />
      )}
      <article
        className={cx(
          "message-bubble break-words",
          isMine ? "message-bubble-mine" : "message-bubble-other",
          isPending ? "opacity-70" : "",
          isFailed ? "message-bubble-failed" : "",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[11px] font-bold opacity-80">{message.senderName}</p>
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5">{message.content}</p>
        <div className={cx("mt-2 flex items-center justify-end gap-2 text-[10px]", isMine && !isFailed ? "text-black/70" : "text-muted")}>
          <span>{formatTime(message.createdAt)}</span>
          {isMine && (
            <Chip
              size="sm"
              variant="flat"
              color={receiptTone}
              className="h-5 rounded-full px-1.5 text-[9px] font-bold"
            >
              {isPending ? <Clock3 className="mr-1 inline h-3 w-3" /> : <CheckCheck className="mr-1 inline h-3 w-3" />}
              {receiptLabel}
            </Chip>
          )}
        </div>
      </article>
      {isMine && (
        <UserAvatar
          src={message.senderProfilePhotoUrl || undefined}
          name={message.senderName}
          className="mb-1 h-8 w-8 shrink-0 bg-green text-black"
        />
      )}
    </div>
  );
}

function ChatHeader({ room, connection, onOpenMenu, onOpenRoomSettings, typingLabel }) {
  return (
    <header className="flex min-h-[86px] items-center justify-between border-b border-line/30 bg-panel px-4 py-3 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button className="icon-button lg:hidden" onClick={onOpenMenu} aria-label="Open rooms">
          <Menu className="h-5 w-5" />
        </button>
        <RoomAvatar room={room} className="h-12 w-12 rounded-full shadow-medium" />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{room.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-panel2 px-2.5 py-1 shadow-medium">
              <StatusPill status={connection} />
              <span className="text-xs text-muted">{typingLabel || `${room.members} members`}</span>
            </div>
            {typingLabel && (
              <span className="rounded-full bg-green/10 px-2.5 py-1 text-xs font-bold text-green">
                typing
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="icon-button hidden sm:grid" onClick={onOpenRoomSettings} aria-label="Room settings">
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

function ChatPanel({
  room,
  messages,
  user,
  onLoadOlder,
  hasOlder,
  isLoadingMessages,
  messageError,
  onSend,
  onTyping,
  connection,
  onOpenMenu,
  onOpenRoomSettings,
  socketError,
  typingUsers,
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, room.id]);

  useEffect(() => {
    if (!draft) {
      onTyping(false);
      return;
    }

    onTyping(true);
    const timeout = setTimeout(() => onTyping(false), 1400);
    return () => clearTimeout(timeout);
  }, [draft, onTyping]);

  function submit(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !room.joined || connection === "offline") return;
    onSend(content);
    setDraft("");
  }

  const typingString = Object.keys(typingUsers)
    .filter((id) => id !== user.id)
    .join(", ");
  const typingLabel = typingString ? `${typingString} is typing...` : "";

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-ink">
      <ChatHeader
        room={room}
        connection={connection}
        onOpenMenu={onOpenMenu}
        onOpenRoomSettings={onOpenRoomSettings}
        typingLabel={typingLabel}
      />

      {socketError && (
        <div className="state-banner bg-red/20 text-red">
          <AlertTriangle className="h-4 w-4" />
          {socketError}
        </div>
      )}

      {connection === "reconnecting" && (
        <div className="state-banner bg-orange text-black">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Replaying missed messages before live delivery resumes.
        </div>
      )}
      {connection === "offline" && (
        <div className="state-banner bg-red text-black">
          <WifiOff className="h-4 w-4" />
          Offline. Messages stay in the composer until the room reconnects.
        </div>
      )}
      {connection === "rate_limited" && (
        <div className="state-banner bg-orange text-black">
          <AlertTriangle className="h-4 w-4" />
          Sending is paused for a moment. Try again shortly.
        </div>
      )}

      <ScrollShadow ref={listRef} className="chat-transcript min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 lg:px-8">
        {hasOlder && (
          <div className="flex justify-center">
            <Button
              onClick={onLoadOlder}
              isDisabled={isLoadingMessages}
              size="sm"
              className="pill-button"
            >
              {isLoadingMessages ? "Loading" : "Load older"}
            </Button>
          </div>
        )}

        {isLoadingMessages && messages.length === 0 && (
          <div className="mx-auto flex w-fit items-center justify-center gap-2 rounded-full bg-panel px-4 py-3 text-sm text-muted shadow-medium">
            <Spinner color="success" size="sm" />
            Loading messages
          </div>
        )}

        {messageError && <ErrorBox message={messageError} />}

        {!isLoadingMessages && !messageError && messages.length === 0 && (
          <Card className="surface-card text-center">
            <CardContent className="p-7">
              <p className="text-sm font-bold">No messages yet</p>
              <p className="mt-1 text-xs leading-5 text-muted">Send the first message in this room.</p>
            </CardContent>
          </Card>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isMine={message.senderId === user.id || message.senderId === user.email}
          />
        ))}
      </ScrollShadow>

      <div className="border-t border-line/30 bg-panel px-4 pb-24 pt-3 md:pb-3 lg:px-6">
        <form onSubmit={submit} className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={1}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(event);
              }
            }}
            className="max-h-28 min-h-12 flex-1 resize-none rounded-[24px] bg-panel2 px-5 py-3 text-sm leading-6 text-white shadow-insetline outline-none placeholder:text-muted focus:ring-2 focus:ring-green/70"
            placeholder={!room.joined ? "Join this room to send" : connection === "offline" ? "Reconnect to send" : "Message this room"}
          />
          <Button
            isDisabled={!draft.trim() || !room.joined || connection === "offline"}
            isIconOnly
            type="submit"
            className="h-12 w-12 shrink-0 rounded-full bg-green text-black shadow-medium transition hover:scale-105 disabled:cursor-not-allowed disabled:bg-tile disabled:text-muted"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </section>
  );
}

function DetailRow({ label, value, Icon }) {
  return (
    <div className="soft-row flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-muted">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="max-w-[55%] truncate text-right text-xs font-bold text-white">{value || "Not set"}</span>
    </div>
  );
}

function SurfacePage({ title, subtitle, icon: Icon, children }) {
  return (
    <section className="min-w-0 flex-1 overflow-y-auto bg-ink px-4 py-5 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="surface-card mb-5 flex items-center gap-4 p-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-panel2 text-green shadow-medium">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="section-kicker">Chat system</p>
            <h2 className="text-2xl font-bold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

function ProfileSettingsPage({ user, onUserUpdated, onLogout }) {
  const [form, setForm] = useState(() => ({
    email: user.email || "",
    username: user.username || "",
    birthday: user.birthday || "",
    profilePhotoUrl: user.profilePhotoUrl || "",
  }));
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [isUploadingPhoto, setUploadingPhoto] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError("");
      setLoading(true);
      try {
        const loaded = normalizeUser(await fetchCurrentUser());
        if (cancelled) return;
        setForm({
          email: loaded.email || "",
          username: loaded.username || "",
          birthday: loaded.birthday || "",
          profilePhotoUrl: loaded.profilePhotoUrl || "",
        });
        onUserUpdated(loaded);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load profile settings.");
          if (err.code === "SESSION_EXPIRED") onLogout();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [onLogout, onUserUpdated]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!form.username.trim()) {
      setError("Username is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = toApiProfile(form);
      const updated = normalizeUser(await updateCurrentUser(payload));
      const merged = { ...user, ...updated, email: updated.email || form.email };
      onUserUpdated(merged);
      setNotice("Profile settings saved.");
      if (form.email !== user.email) {
        setNotice("Profile settings saved. Email changes are waiting on backend support.");
      }
    } catch (err) {
      setError(err.message || "Could not save profile settings.");
      if (err.code === "SESSION_EXPIRED") onLogout();
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setNotice("");

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for your profile photo.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const updated = normalizeUser(await uploadProfilePhoto(file));
      const merged = { ...user, ...updated };
      setForm((current) => ({
        ...current,
        profilePhotoUrl: updated.profilePhotoUrl || current.profilePhotoUrl,
      }));
      onUserUpdated(merged);
      setNotice("Profile photo updated.");
    } catch (err) {
      setError(err.message || "Could not upload profile photo.");
      if (err.code === "SESSION_EXPIRED") onLogout();
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <SurfacePage
      title="Settings"
      subtitle="Manage your profile details for chat presence and account screens"
      icon={Settings}
    >
      <Card className="surface-card">
        <CardContent className="p-5 lg:p-6">
          <div className="mb-6 grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="rounded-[22px] bg-panel2 p-4">
            <UserAvatar
              src={form.profilePhotoUrl || undefined}
              name={form.username || form.email}
                className="h-20 w-20 shrink-0 bg-panel text-green shadow-medium"
            />
              <p className="mt-4 text-lg font-bold">{form.username || "Your profile"}</p>
              <p className="mt-1 break-all text-sm text-muted">{form.email}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                <CircleDot className="h-3.5 w-3.5 text-green" />
                Chat presence profile
              </div>
            </div>
            <div className="rounded-[22px] bg-panel2 p-4">
              <p className="section-kicker">Account controls</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                These details appear beside messages, direct rooms, and people search.
              </p>
            </div>
          </div>

          {isLoading && (
            <div className="mb-4 flex items-center gap-2 rounded-full bg-panel2 px-4 py-3 text-sm text-muted">
              <Spinner color="success" size="sm" />
              Loading profile
            </div>
          )}
          <ErrorBox message={error} />
          {notice && <div className="mb-4 rounded-full bg-green/10 px-4 py-3 text-sm text-green">{notice}</div>}

          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[1.4px] text-muted">Email</span>
              <Input
                value={form.email}
                isDisabled
                type="email"
                aria-label="Email"
                className="field-pill mt-2 h-12"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[1.4px] text-muted">Username</span>
              <Input
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                aria-label="Username"
                className="field-pill mt-2 h-12"
                autoComplete="username"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[1.4px] text-muted">Birthday</span>
              <Input
                value={form.birthday || ""}
                onChange={(event) => setForm({ ...form, birthday: event.target.value })}
                type="date"
                aria-label="Birthday"
                className="field-pill mt-2 h-12"
                autoComplete="bday"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[1.4px] text-muted">Profile photo</span>
              <div className="mt-2 flex min-h-12 items-center justify-between gap-3 rounded-full bg-panel2 px-4 py-2 shadow-insetline">
                <span className="truncate text-sm text-muted">
                  {isUploadingPhoto ? "Uploading photo..." : form.profilePhotoUrl ? "Photo selected" : "Choose an image from your device"}
                </span>
                <label
                  htmlFor="profile-photo-upload"
                  className="cursor-pointer rounded-full bg-green px-4 py-2 text-xs font-bold uppercase tracking-[1.4px] text-black transition hover:scale-[1.01]"
                >
                  Upload
                </label>
                <input
                  id="profile-photo-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handlePhotoChange}
                  disabled={isUploadingPhoto}
                />
              </div>
            </label>
            <div className="md:col-span-2">
              <Button
                type="submit"
                isDisabled={isSaving}
                className="h-11 rounded-full bg-green px-5 text-xs font-bold uppercase tracking-[1.4px] text-black shadow-medium"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving" : "Save profile"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </SurfacePage>
  );
}

function AlertsPage({ roomsError, socketError }) {
  const alerts = [
    roomsError && ["Rooms", roomsError, AlertTriangle, "text-red", "Needs attention"],
    socketError && ["Connection", socketError, WifiOff, "text-red", "Needs attention"],
  ].filter(Boolean);

  return (
    <SurfacePage title="Alerts" subtitle="Connection and account notices" icon={Bell}>
      <div className="surface-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Status center</p>
            <p className="mt-1 text-sm text-muted">Important issues that need your attention appear here.</p>
          </div>
          <span className="rounded-full bg-panel2 px-3 py-1 text-xs font-bold text-muted">{alerts.length ? `${alerts.length} open` : "All clear"}</span>
        </div>
        <div className="grid gap-3">
          {alerts.length === 0 && (
            <div className="soft-row flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-green text-black">
                <CheckCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold">No alerts</p>
                <p className="mt-1 text-sm leading-6 text-muted">Your chat workspace is ready.</p>
              </div>
            </div>
          )}
          {alerts.map(([title, body, Icon, tone, label]) => (
            <div key={title} className="soft-row flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-panel">
                <Icon className={cx("h-5 w-5", tone)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold">{title}</p>
                  <span className="rounded-full bg-panel px-2 py-0.5 text-[10px] font-bold uppercase tracking-[1.2px] text-muted">
                    {label}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SurfacePage>
  );
}

function PeoplePage({ onDirectRoom, onLogout }) {
  const [username, setUsername] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [isSearching, setSearching] = useState(false);
  const [startingId, setStartingId] = useState("");

  async function submit(event) {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError("Enter a username to search.");
      return;
    }

    setError("");
    setSearching(true);
    try {
      const users = await searchUsers(trimmed, 10);
      setResults(users.map(normalizeUser));
    } catch (err) {
      setError(err.message || "Could not search users.");
      if (err.code === "SESSION_EXPIRED") onLogout();
    } finally {
      setSearching(false);
    }
  }

  async function startDirectChat(user) {
    setStartingId(user.id);
    setError("");
    try {
      await onDirectRoom(user);
    } catch (err) {
      setError(err.message || "Could not start a direct chat.");
      if (err.code === "SESSION_EXPIRED") onLogout();
    } finally {
      setStartingId("");
    }
  }

  return (
    <SurfacePage title="People" subtitle="Search by username and open a direct 1:1 room" icon={UsersRound}>
      <Card className="surface-card">
        <CardContent className="p-5">
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
            <label className="field-pill flex min-h-12 flex-1 items-center gap-3">
              <Search className="h-4 w-4 text-muted" />
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-muted"
                placeholder="Search username"
                aria-label="Search username"
              />
            </label>
            <Button
              type="submit"
              isDisabled={isSearching}
              className="h-12 rounded-full bg-green px-5 text-xs font-bold uppercase tracking-[1.4px] text-black shadow-medium"
            >
              {isSearching ? "Searching" : "Search"}
            </Button>
          </form>

          <div className="mt-4">
            <ErrorBox message={error} />
          </div>

          <div className="mt-5 space-y-2">
            {!isSearching && results.length === 0 && (
              <div className="rounded-[22px] bg-panel2 p-6 text-center">
                <UserRound className="mx-auto h-7 w-7 text-muted" />
                <p className="mt-3 text-sm font-bold">No people selected</p>
                <p className="mt-1 text-xs leading-5 text-muted">Search a username to start a 1:1 chat.</p>
              </div>
            )}
            {results.map((person) => (
              <div key={person.id} className="soft-row flex items-center gap-3">
                <UserAvatar src={person.profilePhotoUrl || undefined} name={person.username} className="h-11 w-11 bg-panel text-green shadow-medium" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{person.username}</p>
                  <p className="truncate text-xs text-muted">{person.email || person.id}</p>
                </div>
                <Button
                  onClick={() => startDirectChat(person)}
                  isDisabled={startingId === person.id}
                  size="sm"
                  className="rounded-full bg-green text-xs font-bold uppercase tracking-[1.2px] text-black shadow-medium"
                >
                  <UserPlus className="h-4 w-4" />
                  {startingId === person.id ? "Opening" : "Chat"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </SurfacePage>
  );
}

function RoomSettingsPage({ room, messages, currentUser, onRoomUpdated, onRoomDeleted, onBack, onLogout }) {
  const [name, setName] = useState(room?.name || "");
  const [roomInfo, setRoomInfo] = useState(room);
  const [members, setMembers] = useState([]);
  const [isLoading, setLoading] = useState(Boolean(room));
  const [isSaving, setSaving] = useState(false);
  const [isUploadingRoomPhoto, setUploadingRoomPhoto] = useState(false);
  const [isDeletingRoom, setDeletingRoom] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const ownerId = roomInfo?.createdById || room?.createdById;
  const isOwner = Boolean(ownerId && currentUser?.id && String(ownerId) === String(currentUser.id));

  useEffect(() => {
    if (!room?.id) return;
    let cancelled = false;

    async function load() {
      setError("");
      setLoading(true);
      try {
        const [details, roomMembers] = await Promise.all([fetchRoom(room.id), fetchRoomMembers(room.id)]);
        if (cancelled) return;
        const normalizedRoom = normalizeRoom(details || room);
        setRoomInfo({ ...room, ...normalizedRoom });
        setName(normalizedRoom.name);
        setMembers(Array.isArray(roomMembers) ? roomMembers : roomMembers?.items || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load room info.");
          if (err.code === "SESSION_EXPIRED") onLogout();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [onLogout, room]);

  async function submit(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setError("Room name must be at least 3 characters.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = normalizeRoom(await updateRoom(room.id, { name: trimmed }));
      onRoomUpdated({ ...room, ...updated });
      setRoomInfo({ ...room, ...updated });
      setConfirmDelete(false);
      setNotice("Room settings saved.");
    } catch (err) {
      setError(err.message || "Could not save room settings.");
      if (err.code === "SESSION_EXPIRED") onLogout();
    } finally {
      setSaving(false);
    }
  }

  async function handleRoomPhotoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !room?.id) return;

    setError("");
    setNotice("");

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for the room photo.");
      return;
    }

    setUploadingRoomPhoto(true);
    try {
      const updated = normalizeRoom(await uploadRoomPhoto(room.id, file));
      const merged = { ...room, ...roomInfo, ...updated };
      setRoomInfo(merged);
      onRoomUpdated(merged);
      setNotice("Room photo updated.");
    } catch (err) {
      setError(err.message || "Could not upload room photo.");
      if (err.code === "SESSION_EXPIRED") onLogout();
    } finally {
      setUploadingRoomPhoto(false);
    }
  }

  async function handleDeleteRoom() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setNotice("Click delete again to confirm.");
      return;
    }

    setDeletingRoom(true);
    setError("");
    try {
      await deleteRoom(room.id);
      onRoomDeleted(room.id);
    } catch (err) {
      setError(err.message || "Could not delete room.");
      if (err.code === "SESSION_EXPIRED") onLogout();
    } finally {
      setDeletingRoom(false);
    }
  }

  if (!room) {
    return (
      <SurfacePage title="Room info" subtitle="Select a room before opening its settings" icon={Info}>
        <Card className="surface-card text-center">
          <CardContent className="p-6">
            <p className="text-sm font-bold">No room selected</p>
            <Button onClick={onBack} className="mt-4 rounded-full bg-green text-xs font-bold uppercase tracking-[1.4px] text-black shadow-medium">
              Back to rooms
            </Button>
          </CardContent>
        </Card>
      </SurfacePage>
    );
  }

  return (
    <SurfacePage title="Room info" subtitle="Membership and room settings" icon={Info}>
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card className="surface-card">
          <CardContent className="p-5">
            <div className="mb-5 flex flex-col gap-4 rounded-[22px] bg-panel2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <RoomAvatar room={{ ...room, ...roomInfo }} className="h-16 w-16 rounded-full shadow-medium" />
                <div className="min-w-0">
                  <p className="section-kicker">Room channel</p>
                  <h3 className="text-xl font-bold">{roomInfo?.name || room.name}</h3>
                  <p className="truncate text-sm text-muted">{room.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <label
                  htmlFor="room-photo-upload"
                  className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-panel px-3 text-xs font-bold uppercase tracking-[1.4px] text-muted shadow-medium transition hover:text-white"
                >
                  <ImagePlus className="h-4 w-4" />
                  {isUploadingRoomPhoto ? "Uploading" : "Photo"}
                </label>
                <input
                  id="room-photo-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleRoomPhotoChange}
                  disabled={isUploadingRoomPhoto}
                />
                <Button onClick={onBack} size="sm" className="rounded-full bg-panel text-xs font-bold uppercase tracking-[1.4px] text-muted shadow-medium">
                  Back
                </Button>
              </div>
            </div>

            {isLoading && (
              <div className="mb-4 flex items-center gap-2 rounded-full bg-panel2 px-4 py-3 text-sm text-muted">
                <Spinner color="success" size="sm" />
                Loading room info
              </div>
            )}
            <ErrorBox message={error} />
            {notice && <div className="mb-4 rounded-full bg-green/10 px-4 py-3 text-sm text-green">{notice}</div>}

            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="field-pill h-12 flex-1"
                aria-label="Room name"
              />
              <Button
                type="submit"
                isDisabled={isSaving || roomInfo?.isDirect}
                className="h-12 rounded-full bg-green px-5 text-xs font-bold uppercase tracking-[1.4px] text-black shadow-medium disabled:bg-tile disabled:text-muted"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving" : "Save room"}
              </Button>
            </form>

            <div className="mt-5 grid gap-2 md:grid-cols-2">
              <DetailRow label="Membership" value={roomInfo?.joined ? "Joined" : "Not joined"} Icon={UsersRound} />
              <DetailRow label="Members" value={`${members.length || roomInfo?.members || 0} listed`} Icon={UserRound} />
              <DetailRow label="Messages" value={`${messages.length} loaded`} Icon={CheckCheck} />
              <DetailRow label="Creator" value={roomInfo?.createdByName || roomInfo?.createdById || "Unavailable"} Icon={ShieldCheck} />
              <DetailRow label="Room type" value={roomInfo?.isDirect ? "Direct chat" : "Group room"} Icon={MessageCircle} />
            </div>

            {isOwner && !roomInfo?.isDirect && (
              <div className="mt-5 rounded-[22px] bg-red/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-red">Delete room</p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      This removes the room for everyone. Only the room owner can do this.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleDeleteRoom}
                    isDisabled={isDeletingRoom}
                    className="h-10 rounded-full bg-red px-4 text-xs font-bold uppercase tracking-[1.4px] text-black shadow-medium"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isDeletingRoom ? "Deleting" : confirmDelete ? "Confirm delete" : "Delete room"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardContent className="p-5">
            <p className="section-kicker">Members</p>
            <p className="mt-1 text-sm font-bold">Room membership</p>
            <div className="mt-3 space-y-2">
              {members.length === 0 && (
                <p className="rounded-[18px] bg-panel2 p-4 text-sm text-muted">
                  Member list is not available yet.
                </p>
              )}
              {members.map((member) => {
                const person = normalizeUser(member);
                return (
                  <div key={person.id} className="soft-row flex items-center gap-3">
                    <UserAvatar src={person.profilePhotoUrl || undefined} name={person.username} className="h-9 w-9 bg-panel text-green shadow-medium" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{person.username}</p>
                      <p className="truncate text-xs text-muted">{member.membership_status || member.status || "member"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </SurfacePage>
  );
}

function Inspector({ room, messages, connection }) {
  return (
    <aside className="hidden w-[300px] border-l border-line/25 bg-panel px-4 py-4 xl:block">
      <RoomAvatar room={room} className="h-36 w-full rounded-[28px] shadow-heavy" />
      <h3 className="mt-5 text-2xl font-bold">{room.name}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{room.description}</p>

      <div className="mt-6 space-y-2">
        {[
          ["Connection", connectionCopy[connection], Signal],
          ["Members", `${room.members} active`, UsersRound],
          ["Messages", `${messages.length} loaded`, MessageCircle],
          ["Status", room.joined ? "Joined" : "Unavailable", CheckCheck],
        ].map(([label, value, Icon]) => (
          <div key={label} className="soft-row flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted">
              <Icon className="h-4 w-4" />
              {label}
            </span>
            <span className="text-xs font-bold text-white">{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[22px] bg-panel2 p-4 shadow-medium">
        <p className="section-kicker">Room summary</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Only joined conversations appear in your workspace. Use settings to rename rooms and review members.
        </p>
      </div>
    </aside>
  );
}

function MobileRoomRail({ rooms, activeRoomId, onSelectRoom }) {
  if (rooms.length === 0) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/40 bg-ink/95 px-2 py-2 backdrop-blur md:hidden">
      <div className="flex gap-2 overflow-x-auto">
        {rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => onSelectRoom(room.id)}
            className={cx(
              "flex min-w-[118px] items-center gap-2 rounded-full px-3 py-2 text-left shadow-medium",
              activeRoomId === room.id ? "bg-green text-black" : "bg-panel text-white",
            )}
          >
            <RoomAvatar room={room} className="h-8 w-8 rounded-full" />
            <span className="truncate text-xs font-bold">{room.name}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function ChatApp({ session, onLogout }) {
  const [currentUser, setCurrentUser] = useState(() => normalizeUser(session.user));
  const [rooms, setRooms] = useState([]);
  const [isLoadingRooms, setLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState("");
  const [activeRoomId, setActiveRoomId] = useState("");
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [messagesError, setMessagesError] = useState("");
  const [isLoadingMessages, setLoadingMessages] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [connection, setConnection] = useState("connecting");
  const [socketError, setSocketError] = useState("");
  const [query, setQuery] = useState("");
  const [activeView, setActiveView] = useState("rooms");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const chatSocketRef = useRef(null);

  const user = currentUser;
  const token = session.tokens?.access_token;
  const visibleRooms = useMemo(() => rooms.filter((room) => room.joined === true), [rooms]);
  const activeRoom = visibleRooms.find((room) => room.id === activeRoomId);
  const activeRoomJoined = activeRoom?.joined === true;
  const messages = messagesByRoom[activeRoomId] || [];

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    setRoomsError("");

    try {
      const apiRooms = await fetchRooms();
      const normalizedRooms = apiRooms.map(normalizeRoom);
      const joinedRooms = normalizedRooms.filter((room) => room.joined === true);
      setRooms(normalizedRooms);
      setActiveRoomId((current) => joinedRooms.some((room) => room.id === current) ? current : joinedRooms[0]?.id || "");
    } catch (err) {
      setRooms([]);
      setActiveRoomId("");
      setRoomsError(err.message || "Failed to load rooms.");
      if (err.code === "SESSION_EXPIRED") onLogout();
    } finally {
      setLoadingRooms(false);
    }
  }, [onLogout]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  async function loadMessages(roomId, beforeSequence = null) {
    if (!roomId) return;

    setLoadingMessages(true);
    setMessagesError("");

    try {
      const apiMessages = await fetchMessages(roomId, 50, beforeSequence);
      const messageItems = Array.isArray(apiMessages) ? apiMessages : apiMessages?.items || [];
      const normalized = messageItems.map(normalizeMessage);
      setMessagesByRoom((current) => ({
        ...current,
        [roomId]: beforeSequence ? mergeMessages(normalized, current[roomId] || []) : mergeMessages([], normalized),
      }));
      setHasOlder(normalized.length === 50);

      const sequence = latestSequence(normalized);
      if (sequence) {
        storeLastSequence(user.id, roomId, sequence);
        updateReadState(roomId, sequence).catch(() => {});
      }
    } catch (err) {
      setMessagesError(err.message || "Failed to load messages.");
      if (err.code === "SESSION_EXPIRED") onLogout();
    } finally {
      setLoadingMessages(false);
    }
  }

  useEffect(() => {
    if (!activeRoomId) return;
    if (!activeRoomJoined) {
      setMessagesByRoom((current) => ({ ...current, [activeRoomId]: [] }));
      setMessagesError("This room is not available in your workspace.");
      setHasOlder(false);
      setLoadingMessages(false);
      return;
    }
    loadMessages(activeRoomId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, activeRoomJoined]);

  useEffect(() => {
    if (!activeRoomId || !token || !activeRoomJoined) {
      if (chatSocketRef.current) {
        chatSocketRef.current.disconnect();
        chatSocketRef.current = null;
      }
      if (activeRoomId && !activeRoomJoined) {
        setConnection("idle");
        setSocketError("");
      }
      return;
    }

    if (chatSocketRef.current) {
      chatSocketRef.current.disconnect();
      chatSocketRef.current = null;
    }

    setSocketError("");
    setTypingUsers({});

    const lastSequence = Math.max(getLastSequence(user.id, activeRoomId), latestSequence(messagesByRoom[activeRoomId] || []));
    const socket = new ChatSocket({
      roomId: activeRoomId,
      userId: user.id,
      user,
      token,
      lastSequence,
      onStateChange: setConnection,
      onMessage: (event) => {
        if (event.type === "read.receipt") {
          const receiptRoomId = event.room_id || event.roomId || activeRoomId;
          setMessagesByRoom((current) => ({
            ...current,
            [receiptRoomId]: applyReadReceiptToMessages(current[receiptRoomId] || [], event, user.id),
          }));
          return;
        }

        if (event.type !== "message.created") return;
        const message = normalizeMessage(event);
        setMessagesByRoom((current) => ({
          ...current,
          [activeRoomId]: mergeMessages(current[activeRoomId] || [], [message]),
        }));
        if (message.sequenceNumber) {
          storeLastSequence(user.id, activeRoomId, message.sequenceNumber);
          updateReadState(activeRoomId, message.sequenceNumber).catch(() => {});
          socket.sendReadReceipt(message.sequenceNumber);
        }
      },
      onTyping: (event, isTyping) => {
        const sender = event.sender_username || event.sender_id || "Someone";
        setTypingUsers((current) => {
          const next = { ...current };
          if (isTyping) next[sender] = true;
          else delete next[sender];
          return next;
        });
      },
      onError: (err) => {
        setSocketError(err.message || "Socket error occurred.");
        if (err.code === 4401) onLogout();
      },
    });

    chatSocketRef.current = socket;

    return () => {
      socket.disconnect();
      if (chatSocketRef.current === socket) chatSocketRef.current = null;
    };
    // messages are intentionally excluded to avoid reconnecting on every message
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, token, activeRoomJoined, user, onLogout]);

  async function handleCreateRoom(name) {
    const room = { ...normalizeRoom(await createRoom(name), rooms.length), joined: true };
    setRooms((current) => {
      if (current.some((item) => item.id === room.id)) return current;
      return [room, ...current];
    });
    setActiveRoomId(room.id);
  }

  async function handleSelectRoom(roomId) {
    setActiveRoomId(roomId);
    setActiveView("rooms");
    setMobileOpen(false);
  }

  const handleUserUpdated = useCallback((updatedUser) => {
    const nextUser = normalizeUser(updatedUser);
    setCurrentUser(nextUser);
    storeSession({
      ...session,
      user: nextUser,
    });
  }, [session]);

  function handleRoomUpdated(updatedRoom) {
    const normalized = normalizeRoom(updatedRoom);
    setRooms((current) =>
      current.map((room) => (room.id === normalized.id ? { ...room, ...normalized } : room)),
    );
  }

  function handleRoomDeleted(roomId) {
    setRooms((current) => {
      const nextRooms = current.filter((room) => room.id !== roomId);
      const nextJoined = nextRooms.filter((room) => room.joined === true);
      setActiveRoomId((currentActive) => (currentActive === roomId ? nextJoined[0]?.id || "" : currentActive));
      return nextRooms;
    });
    setMessagesByRoom((current) => {
      const next = { ...current };
      delete next[roomId];
      return next;
    });
    setActiveView("rooms");
  }

  async function handleDirectRoom(person) {
    const room = normalizeRoom(await createDirectRoom(person.id), rooms.length);

    setRooms((current) => {
      const existing = current.filter((item) => item.id !== room.id);
      return [{ ...room, joined: true, isDirect: true }, ...existing];
    });
    setMessagesByRoom((current) => ({ ...current, [room.id]: current[room.id] || [] }));
    setActiveRoomId(room.id);
    setActiveView("rooms");
  }

  function handleNavigate(view) {
    setActiveView(view);
    setMobileOpen(false);
  }

  function handleSend(content) {
    if (!activeRoomId) return;
    if (!activeRoomJoined) {
      setSocketError("This room is not available in your workspace.");
      return;
    }

    const clientMessageId = crypto.randomUUID();
    const pending = normalizeMessage({
      id: `local-${clientMessageId}`,
      client_message_id: clientMessageId,
            room_id: activeRoomId,
            sender_id: user.id,
            sender_username: user.username,
            sender_profile_photo_url: user.profilePhotoUrl,
            content,
            created_at: new Date().toISOString(),
            state: "pending",
    });

    setMessagesByRoom((current) => ({
      ...current,
      [activeRoomId]: mergeMessages(current[activeRoomId] || [], [pending]),
    }));

    const sent = chatSocketRef.current?.sendMessage(content, clientMessageId);
    if (!sent) {
      setMessagesByRoom((current) => ({
        ...current,
        [activeRoomId]: (current[activeRoomId] || []).map((message) =>
          message.clientMessageId === clientMessageId ? { ...message, state: "failed" } : message,
        ),
      }));
      setSocketError("WebSocket is not connected. Reconnect before sending.");
    }
  }

  const handleTyping = useCallback(
    (isTyping) => {
      chatSocketRef.current?.sendTyping(isTyping);
    },
    [],
  );

  async function handleLoadOlder() {
    const firstSequence = Math.min(...messages.map(getMessageSequence).filter(Boolean));
    if (Number.isFinite(firstSequence)) {
      await loadMessages(activeRoomId, firstSequence);
    }
  }

  return (
    <main className="h-screen overflow-hidden bg-ink font-spotify text-white">
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/70 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <div className="flex h-full">
        <Sidebar
          user={user}
          rooms={visibleRooms}
          activeRoomId={activeRoomId}
          activeView={activeView}
          onNavigate={handleNavigate}
          onSelectRoom={handleSelectRoom}
          onLogout={onLogout}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        {activeView === "rooms" && (
          <>
            <RoomList
              rooms={visibleRooms}
              activeRoomId={activeRoomId}
              onSelectRoom={handleSelectRoom}
              onCreateRoom={handleCreateRoom}
              onRetry={loadRooms}
              query={query}
              onQueryChange={setQuery}
              isLoading={isLoadingRooms}
              error={roomsError}
            />
            {activeRoom ? (
              <ChatPanel
                room={activeRoom}
                messages={messages}
                user={user}
                onLoadOlder={handleLoadOlder}
                hasOlder={hasOlder}
                isLoadingMessages={isLoadingMessages}
                messageError={messagesError}
                onSend={handleSend}
                onTyping={handleTyping}
                connection={connection}
                onOpenMenu={() => setMobileOpen(true)}
                onOpenRoomSettings={() => setActiveView("room-settings")}
                socketError={socketError}
                typingUsers={typingUsers}
              />
            ) : (
          <section className="chat-transcript flex min-w-0 flex-1 flex-col items-center justify-center bg-ink px-6 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-panel text-green shadow-heavy">
              <MessageCircle className="h-8 w-8" />
            </div>
            <p className="mt-4 text-lg font-bold">{roomsError ? "Rooms unavailable" : "No room selected"}</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
              {roomsError || "Create a room or start a direct chat to begin."}
            </p>
            {roomsError && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  onClick={loadRooms}
                  className="pill-button"
                >
                  Retry API
                </button>
              </div>
            )}
          </section>
            )}
          </>
        )}
        {activeView === "people" && (
          <PeoplePage onDirectRoom={handleDirectRoom} onLogout={onLogout} />
        )}
        {activeView === "alerts" && (
          <AlertsPage roomsError={roomsError} socketError={socketError || messagesError} />
        )}
        {activeView === "settings" && (
          <ProfileSettingsPage
            user={user}
            onUserUpdated={handleUserUpdated}
            onLogout={onLogout}
          />
        )}
        {activeView === "room-settings" && (
          <RoomSettingsPage
            room={activeRoom}
            messages={messages}
            currentUser={user}
            onRoomUpdated={handleRoomUpdated}
            onRoomDeleted={handleRoomDeleted}
            onBack={() => setActiveView("rooms")}
            onLogout={onLogout}
          />
        )}
        {activeView === "rooms" && activeRoom && (
          <Inspector
            room={activeRoom}
            messages={messages}
            connection={connection}
          />
        )}
      </div>
      {activeView === "rooms" && (
        <MobileRoomRail rooms={visibleRooms} activeRoomId={activeRoomId} onSelectRoom={handleSelectRoom} />
      )}
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(() => {
    const stored = getStoredSession();
    return stored || null;
  });

  function handleAuthenticated(nextSession) {
    setSession(nextSession);
  }

  const handleLogout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  if (!session) {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <ChatApp
      session={session}
      onLogout={handleLogout}
    />
  );
}
