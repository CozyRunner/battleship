# Configuration & Settings

This document covers both environment-level configuration and in-game user settings.

## 1. Environment Variables

The application requires the following environment variables for deployment and local development.

### Shared / Global

- `NODE_ENV`: Either `development` or `production`.

### Backend (Vercel Function at `api/socket.ts`)

- `REDIS_URL`: Redis connection string (room state + pub/sub). `UPSTASH_REDIS_URL` and `KV_URL` are accepted as fallbacks.
- `SOCKET_PATH`: Optional. Socket.IO server path (default `/socket.io`).
- `CORS_ORIGIN`: Optional. Allowed origin for Socket.IO (default `*`).

### Frontend (Vercel / local)

- `VITE_SOCKET_URL`: Local dev only. Points the client at a standalone Socket.IO server (e.g., `http://localhost:3000`). Defaults to the page origin at `/api/socket/socket.io`.
- `PUBLIC_SOCKET_PATH`: Optional. Overrides the client Socket.IO path.

---

## 2. In-Game Settings

Users can customize their experience through the **Settings Panel**, which persists data to `localStorage`.

### Audio

- **Master Volume**: 0.0 to 1.0.
- **Mute All**: Toggle to disable all sound effects.

### Visuals

- **Animation Speed**: `Slow`, `Normal`, or `Fast`.
- **Show Grid Numbers**: Toggle coordinate labels (A-J, 1-10) on/off.
- **High Performance Mode**: Disables complex particles and ripple effects for older devices.

### Gameplay

- **Auto-Rotate Ships**: Automatically flips ships if they don't fit in the current orientation during a drag.
- **Default Difficulty**: Sets the initial AI level for single-player matches.
