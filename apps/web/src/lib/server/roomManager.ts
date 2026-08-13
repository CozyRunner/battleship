import type { Socket } from 'socket.io';
import type { Redis } from 'ioredis';
import { createBoard } from '../game/engine/board';
import type { Board, Coordinate, ShipState } from '../game/types';

export type AttackRecord = {
	coordinate: Coordinate;
	result: 'hit' | 'miss';
	shipSunk?: string;
};

export type RoomPlayer = {
	id: string;
	name: string;
	socketId: string;
	ready: boolean;
	connected: boolean;
	board: Board;
	ships: ShipState[];
	attacks: AttackRecord[];
};

export type RoomStatus = 'waiting' | 'placement' | 'battle' | 'finished';

export type Room = {
	id: string;
	joinCode: string;
	players: RoomPlayer[];
	status: RoomStatus;
	turn: string | null; // Player ID
	winner: string | null; // Player ID
	createdAt: number;
};

const ROOM_KEY = (id: string) => `bs:room:${id}`;
const CODE_KEY = (code: string) => `bs:code:${code.toUpperCase()}`;
const SOCKET_KEY = (socketId: string) => `bs:socket:${socketId}`;
const ROOM_TTL_SECONDS = 60 * 60 * 2; // abandoned rooms expire after 2 hours

type RoomBackend = {
	getRoom(roomId: string): Promise<Room | null>;
	setRoom(room: Room): Promise<void>;
	deleteRoom(roomId: string): Promise<void>;
	getRoomIdByCode(code: string): Promise<string | null>;
	getRoomIdBySocket(socketId: string): Promise<string | null>;
	setSocket(socketId: string, roomId: string): Promise<void>;
	deleteSocket(socketId: string): Promise<void>;
};

class MemoryBackend implements RoomBackend {
	private rooms = new Map<string, Room>();
	private byCode = new Map<string, string>();
	private bySocket = new Map<string, string>();

	async getRoom(roomId: string): Promise<Room | null> {
		return this.rooms.get(roomId) ?? null;
	}

	async setRoom(room: Room): Promise<void> {
		this.rooms.set(room.id, room);
		this.byCode.set(room.joinCode, room.id);
	}

	async deleteRoom(roomId: string): Promise<void> {
		const room = this.rooms.get(roomId);
		if (room) this.byCode.delete(room.joinCode);
		this.rooms.delete(roomId);
	}

	async getRoomIdByCode(code: string): Promise<string | null> {
		return this.byCode.get(code.toUpperCase()) ?? null;
	}

	async getRoomIdBySocket(socketId: string): Promise<string | null> {
		return this.bySocket.get(socketId) ?? null;
	}

	async setSocket(socketId: string, roomId: string): Promise<void> {
		this.bySocket.set(socketId, roomId);
	}

	async deleteSocket(socketId: string): Promise<void> {
		this.bySocket.delete(socketId);
	}
}

class RedisBackend implements RoomBackend {
	constructor(private redis: Redis) {}

	async getRoom(roomId: string): Promise<Room | null> {
		const raw = await this.redis.get(ROOM_KEY(roomId));
		return raw ? (JSON.parse(raw) as Room) : null;
	}

	async setRoom(room: Room): Promise<void> {
		await this.redis.set(ROOM_KEY(room.id), JSON.stringify(room), 'EX', ROOM_TTL_SECONDS);
		await this.redis.set(CODE_KEY(room.joinCode), room.id, 'EX', ROOM_TTL_SECONDS);
	}

	async deleteRoom(roomId: string): Promise<void> {
		const room = await this.getRoom(roomId);
		if (room) await this.redis.del(CODE_KEY(room.joinCode));
		await this.redis.del(ROOM_KEY(roomId));
	}

	async getRoomIdByCode(code: string): Promise<string | null> {
		return this.redis.get(CODE_KEY(code));
	}

	async getRoomIdBySocket(socketId: string): Promise<string | null> {
		return this.redis.get(SOCKET_KEY(socketId));
	}

	async setSocket(socketId: string, roomId: string): Promise<void> {
		await this.redis.set(SOCKET_KEY(socketId), roomId, 'EX', ROOM_TTL_SECONDS);
	}

	async deleteSocket(socketId: string): Promise<void> {
		await this.redis.del(SOCKET_KEY(socketId));
	}
}

export class RoomManager {
	private io: import('socket.io').Server;
	private backend: RoomBackend;

	constructor(io: import('socket.io').Server, redis: Redis | null) {
		this.io = io;
		this.backend = redis ? new RedisBackend(redis) : new MemoryBackend();
	}

	private static createPlayer(socketId: string, name: string): RoomPlayer {
		return {
			id: socketId,
			name,
			socketId,
			ready: false,
			connected: true,
			board: createBoard(),
			ships: [],
			attacks: []
		};
	}

	async createRoom(socket: Socket, playerName: string): Promise<Room> {
		const room: Room = {
			id: Math.random().toString(36).substring(2, 9),
			joinCode: Math.random().toString(36).substring(2, 6).toUpperCase(),
			players: [RoomManager.createPlayer(socket.id, playerName)],
			status: 'waiting',
			turn: null,
			winner: null,
			createdAt: Date.now()
		};

		await this.backend.setRoom(room);
		await this.backend.setSocket(socket.id, room.id);
		socket.join(room.id);

		return room;
	}

	async joinRoom(socket: Socket, joinCode: string, playerName: string): Promise<Room | null> {
		const room = await this.getRoomByJoinCode(joinCode);
		if (!room || room.players.length >= 2 || room.status !== 'waiting') {
			return null;
		}

		room.players.push(RoomManager.createPlayer(socket.id, playerName));
		await this.backend.setRoom(room);
		await this.backend.setSocket(socket.id, room.id);
		socket.join(room.id);

		return room;
	}

	/**
	 * Re-attach a previously disconnected socket to an existing room. The player is
	 * matched by their stable player `id` (or name), so a reconnect that lands on a
	 * different Vercel function instance can resume the game from Redis.
	 */
	async rejoinRoom(socket: Socket, room: Room, playerId: string): Promise<RoomPlayer | null> {
		const player = room.players.find((p) => p.id === playerId || p.name === playerId);
		if (!player) return null;

		const prevSocketId = player.socketId;
		player.socketId = socket.id;
		player.connected = true;

		await this.backend.setRoom(room);
		if (prevSocketId !== socket.id) {
			await this.backend.deleteSocket(prevSocketId);
		}
		await this.backend.setSocket(socket.id, room.id);
		socket.join(room.id);

		return player;
	}

	async getRoom(roomId: string): Promise<Room | null> {
		return this.backend.getRoom(roomId);
	}

	async getRoomByJoinCode(joinCode: string): Promise<Room | null> {
		const roomId = await this.backend.getRoomIdByCode(joinCode);
		return roomId ? this.backend.getRoom(roomId) : null;
	}

	async getRoomBySocketId(socketId: string): Promise<Room | null> {
		const roomId = await this.backend.getRoomIdBySocket(socketId);
		return roomId ? this.backend.getRoom(roomId) : null;
	}

	async leaveRoom(socketId: string): Promise<string | null> {
		const room = await this.getRoomBySocketId(socketId);
		if (!room) return null;

		const player = room.players.find((p) => p.socketId === socketId);
		if (player) player.connected = false;

		await this.backend.setRoom(room);
		await this.backend.deleteSocket(socketId);
		return room.id;
	}

	async saveRoom(room: Room): Promise<void> {
		await this.backend.setRoom(room);
	}

	async deleteRoom(roomId: string): Promise<void> {
		await this.backend.deleteRoom(roomId);
	}
}
