# Deployment & CI/CD

This document details the hosting strategy, environment configuration, and automated pipeline for the Battleship project.

## 1. Deployment Architecture

The entire application — frontend and multiplayer backend — deploys to a **single Vercel project**.

### SvelteKit App (Vercel)

- **Framework**: SvelteKit (`@sveltejs/adapter-vercel`)
- **Root directory**: `apps/web`
- **Responsibilities**:
  - Hosting the UI, static assets, and client-side logic.
  - Serving the **Socket.IO WebSocket server** as a Vercel Function at `api/socket.ts`.

### Real-time Layer

- **WebSockets**: The Socket.IO server runs inside `api/socket.ts` (a Node.js Vercel Function). Vercel routes `/api/socket` (and its sub-paths) to the function and strips the `/api/socket` prefix before delivery, so Socket.IO keeps its default `/socket.io` path server-side and the client connects to `/api/socket/socket.io`.
- **Transport**: The client forces `transports: ['websocket']`. Vercel Functions are ephemeral and a single WebSocket connection is pinned to one instance, so HTTP long-polling (which relies on sticky sessions) is not supported.
- **State**: Room/game state lives in **Redis** (`@socket.io/redis-adapter` pub/sub), so connections pinned to different function instances can still join the same rooms and broadcast to each other. When Redis is unconfigured (local development), an in-memory fallback is used.
- **Reconnection**: Clients persist their join code + player id and call the `restore` event on reconnect; the function re-attaches the socket to its room and emits `game_restored`.

## 2. Prerequisites

- A [Vercel](https://vercel.com/) account (WebSockets require the Node.js runtime + [Fluid Compute](https://vercel.com/docs/fluid-compute), on by default for new projects).
- A Redis instance with Pub/Sub support, e.g. [Upstash Redis from the Vercel Marketplace](https://vercel.com/marketplace/redis) or Redis Cloud.
- The project repository pushed to a GitHub account.

## 3. Deployment (Vercel)

1. **Import Project**: Log in to the Vercel Dashboard and click "Add New" > "Project".
2. **Connect GitHub**: Select the `battleship` repository.
3. **Configure Project**:
   - **Framework Preset**: `SvelteKit` (auto-detected).
   - **Root Directory**: `apps/web`.
   - **Build & Output Settings**: Use the default `pnpm run build`; Vercel detects the monorepo and root `pnpm-lock.yaml`.
4. **Permissions**: WebSocket Functions require the **WebSockets** permission. When WebSockets is not enabled for your project, enable it in **Project Settings** (or during the first deploy, accept the permission prompt).
5. **Environment Variables** — see the table in [Section 4](#4-environment-variables).
6. **Deploy**: Click "Deploy".

### Function Configuration

`apps/web/vercel.json` configures the Socket.IO function:

```json
{
  "functions": {
    "api/socket.ts": {
      "maxDuration": 800
    }
  }
}
```

`maxDuration` is set as high as possible because a WebSocket connection is closed when its Vercel Function hits the maximum duration.

## 4. Environment Variables

| Variable             | Description                                                                                                                                            | Location              |
| :------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- |
| `REDIS_URL`          | Redis connection string for room state + pub/sub. `UPSTASH_REDIS_URL` and `KV_URL` are accepted as fallbacks.                                          | Vercel                |
| `SOCKET_PATH`        | Optional. Socket.IO server path (default `/socket.io`). Only change if a deployment does not strip the `/api/socket` prefix.                           | Vercel                |
| `CORS_ORIGIN`        | Optional. Allowed origin for Socket.IO (default `*`).                                                                                                  | Vercel                |
| `VITE_SOCKET_URL`    | Local dev only. Points the client at a standalone socket server (e.g. `http://localhost:3000`). Defaults to the page origin (`/api/socket/socket.io`). | Local `.env`          |
| `PUBLIC_SOCKET_PATH` | Optional. Overrides the client Socket.IO path (default `/api/socket/socket.io`, or `/socket.io` when `VITE_SOCKET_URL` is set).                        | Vercel / Local `.env` |

## 5. Local Development

```bash
pnpm dev               # frontend on http://localhost:5173
cd apps/web && pnpm dev:socket   # standalone Socket.IO server on http://localhost:3000
```

With `VITE_SOCKET_URL=http://localhost:3000 pnpm dev` the client targets the local
server using the `/socket.io` path. Without it, the client connects same-origin at
`/api/socket/socket.io`.

`api/socket.ts` starts listening only when executed directly (`import.meta.main`),
so Vercel can import it as a Function without side effects.

## 6. CI/CD Pipeline

We use GitHub Actions (`.github/workflows/ci.yml`) for automated quality checks:

1. **Lint**: `pnpm run lint`.
2. **Type-check**: `pnpm run check` (svelte-check + `tsc -p tsconfig.api.json` for the Function code).
3. **Test**: `pnpm run test` (Vitest).
4. **Build**: Multi-package build via `turbo`.
5. **Deploy**: Vercel auto-deploys on `main` branch pushes.

### Branching Strategy

- **main**: Production-ready code. Auto-deploys to production.
- **develop**: Integration branch for new features.
- **feature/_ / fix/_**: Topic branches for individual tasks.
