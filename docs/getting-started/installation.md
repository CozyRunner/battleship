# Installation Guide

Follow these steps to set up the Battleship project for local development.

## 1. Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: Version 18.0 or higher.
- **npm** or **pnpm**: For package management.
- **Git**: To clone the repository.

## 2. Cloning the Repository

```bash
git clone https://github.com/your-username/battleship.git
cd battleship
```

## 3. Installing Dependencies

The project is structured as a monorepo or a split client/server setup (depending on final folder structure). For now, install the root dependencies:

```bash
npm install
```

## 4. Environment Configuration

For **local multiplayer development**, create a `.env` file in `apps/web` and add:

```env
VITE_SOCKET_URL=http://localhost:3000
```

Without it, the client connects same-origin at `/api/socket/socket.io` (the production Vercel path).

## 5. Running the Application

### Start the Frontend (Client)

```bash
pnpm dev
```

### Start the Socket.IO Server (local multiplayer only)

```bash
cd apps/web
pnpm dev:socket
```

Open [http://localhost:5173](http://localhost:5173) in your browser to view the application.
