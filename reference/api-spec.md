# Battleship Web Game — API Specification

## 1. Overview

This document defines the Socket.IO event protocol for multiplayer communication between client and server.

---

## 2. Connection

### 2.1 Client Connection

```
Client connects to: wss://<server-url>/socket.io/
```

### 2.2 Connection Events

| Event      | Direction     | Payload        | Description            |
| ---------- | ------------- | -------------- | ---------------------- |
| connect    | Server→Client | -              | Successfully connected |
| disconnect | Server→Client | reason: string | Client disconnected    |
| reconnect  | Server→Client | -              | Client reconnected     |

---

## 3. Room Management

### 3.1 Create Room

**Client → Server:** `create_room`

```typescript
{
  playerName: string;
  shipPlacements?: ShipPlacement[]; // optional, can set later
}
```

**Server → Client:** `room_created`

```typescript
{
  roomId: string;
  playerId: string;
  joinCode: string; // short code for sharing
}
```

### 3.2 Join Room

**Client → Server:** `join_room`

```typescript
{
  joinCode: string;
  playerName: string;
}
```

**Server → Client:** `player_joined`

```typescript
{
  playerId: string;
  playerName: string;
  players: PlayerInfo[];
}
```

### 3.3 Leave Room

A player is marked disconnected when their socket disconnects.

**Server → Client:** `player_disconnected`

```typescript
{
  playerId: string;
}
```

**Server → Client:** `player_rejoined` (when a disconnected player restores)

```typescript
{
  playerId: string;
}
```

---

## 4. Game Setup

### 4.1 Place Ships

**Client → Server:** `place_ship`

```typescript
{
  roomId: string;
  ships: ShipPlacement[];
}
```

```typescript
type ShipPlacement = {
  shipId: string;
  coordinates: Coordinate[];
};
```

**Server → Client:** `ships_placed`

```typescript
{
  playerId: string;
  ships: ShipPlacement[];
}
```

### 4.2 Ready

**Client → Server:** `ready`

```typescript
{
  roomId: string;
}
```

**Server → Client:** `game_started`

```typescript
{
  startingPlayerId: string;
  yourBoard: BoardState;
  enemyBoardPreview: "hidden"; // no info revealed yet
}
```

---

## 5. Gameplay

### 5.1 Attack

**Client → Server:** `attack`

```typescript
{
  roomId: string;
  coordinate: Coordinate;
}
```

```typescript
type Coordinate = {
  x: number; // 0-9
  y: number; // 0-9
};
```

**Server → Client:** `attack_result`

```typescript
{
  attackerId: string;
  coordinate: Coordinate;
  result: "hit" | "miss";
  shipHit?: {
    shipId: string;
    sunk: boolean;
  };
}
```

### 5.2 Turn Change

**Server → Client:** `turn_changed`

```typescript
{
  currentPlayerId: string;
  timeRemaining?: number; // optional turn timer
}
```

### 5.3 Ship Sunk

**Server → Client:** `ship_sunk`

```typescript
{
  sunkByPlayerId: string;
  ship: {
    shipId: string;
    coordinates: Coordinate[];
  };
}
```

---

## 6. Game End

### 6.1 Game Over

**Server → Client:** `game_over`

```typescript
{
  winnerId: string;
  winnerName: string;
  finalState: {
    yourBoard: BoardState;
    enemyBoard: BoardState; // now fully revealed
  }
  stats: {
    totalTurns: number;
    hits: number;
    misses: number;
    accuracy: number;
  }
}
```

### 6.2 Rematch

**Client → Server:** `rematch_request`

```typescript
{
  roomId: string;
}
```

**Server → Client:** `rematch_started`

```typescript
{
  newRoomId: string;
  startingPlayerId: string;
}
```

---

## 7. Error Handling

### 7.1 Error Event

**Server → Client:** `error`

```typescript
{
  code: string;
  message: string;
  details?: any;
}
```

### 7.2 Error Codes

| Code                   | Description                  |
| ---------------------- | ---------------------------- |
| ROOM_NOT_FOUND         | Room ID invalid              |
| ROOM_FULL              | Room has 2 players           |
| NOT_YOUR_TURN          | Attack outside turn          |
| INVALID_COORDINATE     | Coordinate out of bounds     |
| ALREADY_ATTACKED       | Coordinate already targeted  |
| INVALID_SHIP_PLACEMENT | Ships overlap/out of bounds  |
| PLAYER_NOT_IN_ROOM     | Player not in specified room |

---

## 8. Reconnection

### 8.1 Reconnect Flow

**Client reconnects → Server automatically restores:**

**Server → Client:** `game_restored`

```typescript
{
  roomId: string;
  gameState: {
    phase: GamePhase;
    currentPlayerId: string;
    yourBoard: BoardState;
    enemyBoard: PartialBoardState; // only revealed cells
    ships: ShipState[];
  };
}
```

---

## 9. Data Types Summary

```typescript
type BoardState = Cell[][]; // 10x10 grid

type Cell = {
  occupied: boolean;
  shipId?: string;
  hit: boolean;
};

type ShipState = {
  id: string;
  length: number;
  coordinates: Coordinate[];
  hits: number;
  sunk: boolean;
};

type GamePhase = "placement" | "battle" | "result";

type Coordinate = {
  x: number; // 0-9 (A-J)
  y: number; // 0-9 (1-10)
};

type PlayerInfo = {
  id: string;
  name: string;
  ready: boolean;
  shipsPlaced: boolean;
};
```
