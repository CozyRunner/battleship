import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedis } from '../src/lib/server/state';
import { RoomManager, type Room } from '../src/lib/server/roomManager';
import { resolveAttack } from '../src/lib/game/engine/attack';
import { isGameOver } from '../src/lib/game/engine/win';
import type { Coordinate, GamePhase, ShipState } from '../src/lib/game/types';

const app = express();
app.use(cors());

const server = createServer(app);

const io = new Server(server, {
	// Vercel strips the `/api/socket` function prefix before delivering the
	// WebSocket upgrade, so Socket.IO keeps its default `/socket.io` path and the
	// client connects to `/api/socket/socket.io`. Set `SOCKET_PATH` only if a
	// deployment does not strip the prefix (then the client's `PUBLIC_SOCKET_PATH`
	// must match).
	path: process.env.SOCKET_PATH ?? '/socket.io',
	transports: ['websocket'],
	serveClient: false,
	cors: {
		origin: process.env.CORS_ORIGIN ?? '*',
		methods: ['GET', 'POST']
	}
});

// Cross-instance broadcast. Vercel functions are ephemeral and pinned per
// connection, so without a pub/sub adapter, two players in the same room could
// end up on different instances and never see each other's moves. When Redis is
// unconfigured we fall back to the default in-memory adapter (local development).
const redis = getRedis();
if (redis) {
	io.adapter(createAdapter(redis.pub, redis.sub));
}

const roomManager = new RoomManager(io, redis?.pub ?? null);

const roomPhase = (status: Room['status']): GamePhase => {
	switch (status) {
		case 'waiting':
			return 'matchmaking';
		case 'placement':
			return 'placement';
		case 'battle':
			return 'battle';
		case 'finished':
			return 'result';
	}
};

app.get('/health', (_req, res) => {
	res.status(200).json({ status: 'ok' });
});

io.on('connection', (socket) => {
	console.log(`User connected: ${socket.id}`);

	socket.on('create_room', async ({ playerName }) => {
		const room = await roomManager.createRoom(socket, playerName);
		socket.emit('room_created', {
			roomId: room.id,
			playerId: room.players[0].id,
			joinCode: room.joinCode
		});
	});

	socket.on('join_room', async ({ joinCode, playerName }) => {
		const room = await roomManager.joinRoom(socket, joinCode, playerName);
		if (room) {
			io.to(room.id).emit('player_joined', {
				roomId: room.id,
				players: room.players.map((p) => ({ id: p.id, name: p.name, ready: p.ready }))
			});

			if (room.players.length === 2) {
				room.status = 'placement';
				await roomManager.saveRoom(room);
				io.to(room.id).emit('phase_changed', 'placement');
			}
		} else {
			socket.emit('error', { message: 'Room not found or full' });
		}
	});

	socket.on('place_ships', async ({ ships }) => {
		const room = await roomManager.getRoomBySocketId(socket.id);
		if (!room) return;

		const player = room.players.find((p) => p.socketId === socket.id);
		if (!player) return;

		player.ships = ships;
		player.ready = true;

		// Populate board from ships for server-side validation
		ships.forEach((ship: ShipState) => {
			ship.coordinates.forEach((coord: Coordinate) => {
				if (player.board[coord.y] && player.board[coord.y][coord.x]) {
					player.board[coord.y][coord.x].occupied = true;
					player.board[coord.y][coord.x].shipId = ship.id;
				}
			});
		});

		await roomManager.saveRoom(room);
		socket.emit('ships_placed', { playerId: player.id });

		const allReady = room.players.length === 2 && room.players.every((p) => p.ready);
		if (allReady) {
			room.status = 'battle';
			room.turn = room.players[0].id; // First player starts
			await roomManager.saveRoom(room);
			io.to(room.id).emit('game_started', {
				turn: room.turn,
				phase: 'battle'
			});
		}
	});

	socket.on('attack', async ({ coordinate }) => {
		const room = await roomManager.getRoomBySocketId(socket.id);
		if (!room || room.status !== 'battle') return;

		const attacker = room.players.find((p) => p.socketId === socket.id);
		if (!attacker || room.turn !== attacker.id) return;

		const targetPlayer = room.players.find((p) => p.id !== attacker.id);
		if (!targetPlayer) return;

		try {
			const result = resolveAttack(targetPlayer.board, coordinate);
			targetPlayer.board = result.board;
			attacker.attacks.push({ coordinate, result: result.result, shipSunk: result.shipSunk });

			if (result.shipSunk) {
				targetPlayer.ships = targetPlayer.ships.map((s) =>
					s.id === result.shipSunk ? { ...s, sunk: true } : s
				);
			}

			io.to(room.id).emit('attack_result', {
				attackerId: attacker.id,
				coordinate,
				result: result.result,
				shipSunk: result.shipSunk
			});

			if (isGameOver(targetPlayer.ships)) {
				room.status = 'finished';
				room.winner = attacker.id;
				await roomManager.saveRoom(room);
				io.to(room.id).emit('game_over', { winnerId: attacker.id });
				return;
			}

			room.turn = targetPlayer.id;
			await roomManager.saveRoom(room);
			io.to(room.id).emit('turn_changed', { turn: room.turn });
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'An unknown error occurred';
			socket.emit('error', { message });
		}
	});

	// Reconnection: the socket that auto-reconnects (possibly to a different
	// function instance) resumes its room from Redis using the join code.
	socket.on('restore', async ({ joinCode, playerId }) => {
		const room = await roomManager.getRoomByJoinCode(joinCode);
		if (!room) {
			socket.emit('error', { message: 'Room not found' });
			return;
		}

		const player = await roomManager.rejoinRoom(socket, room, playerId);
		if (!player) {
			socket.emit('error', { message: 'Player not found in room' });
			return;
		}

		socket.emit('game_restored', {
			roomId: room.id,
			joinCode: room.joinCode,
			playerId: player.id,
			players: room.players.map((p) => ({ id: p.id, name: p.name, ready: p.ready })),
			phase: roomPhase(room.status),
			turn: room.turn,
			winner: room.winner,
			board: player.board,
			ships: player.ships,
			myAttacks: player.attacks
		});

		io.to(room.id).emit('player_rejoined', { playerId: player.id });
	});

	socket.on('disconnect', async () => {
		const roomId = await roomManager.leaveRoom(socket.id);
		if (roomId) {
			io.to(roomId).emit('player_disconnected', { playerId: socket.id });
		}
	});
});

if (import.meta.main) {
	const port = Number(process.env.PORT) || 3000;
	server.listen(port, () => {
		console.log(`Socket.IO server listening on http://localhost:${port}`);
	});
}

export default server;
