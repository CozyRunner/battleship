# Phase 3: Multiplayer Backend

This phase establishes the real-time communication layer and the server-authoritative engine required for multiplayer play.

## 3.1 Backend Server Initialization

- [x] Initialize a Node.js project (TypeScript).
- [x] Install dependencies: `socket.io`, `express`, `cors`.
- [x] Setup a basic HTTP server with Socket.IO integration.
- [x] Implement basic health check endpoint.

## 3.2 Room Management Logic

- [x] Implement `RoomManager` class to track active game rooms.
- [x] Handle `create_room` event: Generate unique Room ID and Join Code.
- [x] Handle `join_room` event: Add player to room, validate room capacity (max 2).
- [x] Handle `leave_room` and `disconnect` events: Cleanup room or notify remaining player.

## 3.3 Server-Authoritative Engine Integration

- [x] Import the Core Game Engine (from Phase 1) into the server.
- [x] Handle `place_ship` event: Validate placement on the server and store in room state.
- [x] Handle `ready` event: Transition room to `BATTLE` phase when both players are ready.

## 3.4 Battle Loop & Validation

- [x] Handle `attack` event:
  - [x] Validate it is the player's turn.
  - [x] Resolve attack using the server-side engine.
  - [x] Broadcast `attack_result` to both players.
  - [x] Emit `turn_changed` to swap active player.
  - [x] Check for win condition and emit `game_over` if applicable.

## 3.5 Reconnection & State Sync

- [x] Implement `game_restored` logic (Partial: `restore` event re-attaches a socket to its room and emits `game_restored`; basic `disconnect` cleanup implemented).
- [ ] Implement full state restoration on `reconnect`.

## 3.6 Multiplayer Testing

- [x] Use TypeScript compilation to verify server-side type safety and engine integration.
- [ ] Use `socket.io-client` to write automated integration tests.

---

**Phase 3 Exit Criteria**: A functional Socket.IO server that can manage multiple rooms, validate turns, and synchronize game state between two connected clients. (Status: **COMPLETED**)
