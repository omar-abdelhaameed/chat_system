import { getRoomSessionId } from "../storage";

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8000";

export class ChatSocket {
  constructor({ roomId, userId, token, lastSequence = 0, onMessage, onStateChange, onTyping, onError }) {
    this.roomId = roomId;
    this.userId = userId;
    this.token = token;
    this.lastSequence = lastSequence;
    this.sessionId = getRoomSessionId(userId || "anonymous", roomId);
    
    this.onMessage = onMessage;
    this.onStateChange = onStateChange;
    this.onTyping = onTyping;
    this.onError = onError;
    
    this.socket = null;
    this.state = "offline";
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.intentionalClose = false;

    this.connect();
  }

  setState(newState) {
    if (this.state !== newState) {
      this.state = newState;
      if (this.onStateChange) this.onStateChange(newState);
    }
  }

  connect() {
    if (this.socket) {
      this.socket.close();
    }
    
    this.intentionalClose = false;
    this.setState(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    const params = new URLSearchParams({
      token: this.token,
      session_id: this.sessionId,
      last_sequence: String(this.lastSequence),
    });
    const url = `${WS_BASE_URL}/ws/rooms/${encodeURIComponent(this.roomId)}?${params.toString()}`;
    
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.setState("connected");
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message.created") {
          this.lastSequence = Math.max(this.lastSequence, data.sequence_number);
          if (this.onMessage) this.onMessage(data);
        } else if (data.type === "typing.started") {
          if (this.onTyping) this.onTyping(data, true);
        } else if (data.type === "typing.stopped") {
          if (this.onTyping) this.onTyping(data, false);
        } else if (data.type === "error") {
          if (data.code === "RATE_LIMIT_EXCEEDED") {
            this.setState("rate_limited");
            setTimeout(() => {
              if (this.state === "rate_limited") this.setState("connected");
            }, 3000);
          }
          if (this.onError) this.onError(data);
        } else if (data.type === "read.receipt") {
          if (this.onMessage) this.onMessage(data);
        }
      } catch (err) {
        console.error("Failed to parse message", err);
      }
    };

    this.socket.onclose = (event) => {
      if (this.intentionalClose) {
        this.setState("offline");
        return;
      }

      if (event.code === 4401) {
        if (this.onError) this.onError({ code: 4401, message: "Invalid token or session expired" });
        this.setState("offline");
        return; // Don't reconnect on auth error
      }
      
      if (event.code === 4403) {
        if (this.onError) this.onError({ code: 4403, message: "Not a room member" });
        this.setState("offline");
        return; // Don't reconnect on forbidden
      }

      this.setState("offline");
      this.attemptReconnect();
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.onError) this.onError({ message: "Max reconnect attempts reached" });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    setTimeout(() => {
      if (!this.intentionalClose) {
        this.connect();
      }
    }, delay);
  }

  send(payload) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
      return true;
    } else {
      console.warn("Socket is not open. State:", this.socket?.readyState);
      return false;
    }
  }

  sendMessage(content, clientMessageId) {
    return this.send({
      type: "message.send",
      client_message_id: clientMessageId,
      content
    });
  }

  sendTyping(isTyping) {
    return this.send({
      type: isTyping ? "typing.started" : "typing.stopped"
    });
  }

  sendReadReceipt(sequenceNumber) {
    return this.send({
      type: "read.receipt",
      last_read_sequence_number: sequenceNumber
    });
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setState("offline");
  }
}
