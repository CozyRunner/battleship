# Local Development Setup

This guide provides instructions for setting up the Battleship project on your local machine for development.

## 📋 Prerequisites

Ensure you have the following tools installed:

- **Git** — For version control.
- **vfox** — For Node.js version management.
- **Node.js 25.9.0** — Managed via `.node-version` and `vfox`.
- **pnpm 10+** — Enabled via Corepack.

## 🛠️ Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/CozyRunner/battleship.git
cd battleship
```

### 2. Node.js Version Management (vfox)

The project uses a `.node-version` file. To ensure you're using the correct Node.js version with `vfox`:

```bash
# If you don't have the version installed
vfox install node@25.9.0

# vfox will automatically switch based on the .node-version file in the root
node -v # Should output v25.9.0
```

### 3. Install Dependencies (pnpm)

We use `pnpm` as our package manager within a Turborepo monorepo.

```bash
corepack enable
pnpm install
```

### 4. Running the Development Environment

Start the SvelteKit frontend:

```bash
pnpm dev
```

- **Web Frontend:** [http://localhost:5173](http://localhost:5173)

For local multiplayer development, also start the Socket.IO server (the same
`api/socket.ts` that Vercel runs as a Function):

```bash
cd apps/web
pnpm dev:socket        # Socket.IO server on http://localhost:3000
```

In a separate terminal, point the client at it:

```bash
VITE_SOCKET_URL=http://localhost:3000 pnpm dev
```

## 🧪 Running Tests & Checks

### Unit Tests

```bash
pnpm test
```

### Linting

```bash
pnpm lint
```

### Type Checking

```bash
pnpm check
```

## 📂 Project Reorganization

The project is structured as a monorepo:

- `/apps/web` — Svelte 5 frontend (contains the Socket.IO server at `api/socket.ts`).
- `/docs` — Documentation and design files.
- `/reference` — PRD and API specifications.

## 🚀 Building for Production

To generate a production build:

```bash
pnpm build
```

The output is in `apps/web/.svelte-kit` (SvelteKit) and `apps/web/.vercel/output` (Vercel adapter).
