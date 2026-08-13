import { io, Socket } from 'socket.io-client';
import { writable, get } from 'svelte/store';
import { setPhase, setTurn, setWinner } from '../stores/gameStore';
import { playerStore, enemyStore } from '../stores/playerStore';
import { createBoard } from '../game/engine/board';
import type { Board, ShipState, Coordinate } from '../game/types';

type AttackRecord = { coordinate: Coordinate; result: 'hit' | 'miss'; shipSunk?: string };

export const socketStore = writable<Socket | null>(null);
export const roomIdStore = writable<string | null>(null);
export const joinCodeStore = writable<string | null>(null);
export const playerIdStore = writable<string | null>(null);

const SESSION_KEY = 'battleship.session';

// Local dev talks to the standalone dev server (api/socket.ts's `import.meta.main`
// branch, default path `/socket.io`). Production talks to the Vercel function at
// the same origin. Vercel strips the `/api/socket` prefix before delivering the
// WebSocket upgrade, so Socket.IO keeps its default `/socket.io` path server-side
// and the client prefixes it: `/api/socket/socket.io`.
const SOCKET_URL =
	import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');
const SOCKET_PATH =
	import.meta.env.PUBLIC_SOCKET_PATH ||
	(import.meta.env.VITE_SOCKET_URL ? '/socket.io' : '/api/socket/socket.io');

type Session = { joinCode: string; playerId: string };

function loadSession(): Session | null {
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		return raw ? (JSON.parse(raw) as Session) : null;
	} catch {
		return null;
	}
}

function saveSession(session: Session) {
	try {
		localStorage.setItem(SESSION_KEY, JSON.stringify(session));
	} catch {
		// Storage unavailable (private mode); reconnection will simply not restore.
	}
}

function clearSession() {
	try {
		localStorage.removeItem(SESSION_KEY);
	} catch {
		// Ignore
	}
}

export function connectSocket() {
	const existing = get(socketStore);
	if (existing) return existing;

	const socket = io(SOCKET_URL, { path: SOCKET_PATH, transports: ['websocket'] });

	const myId = () => get(playerIdStore) ?? socket.id;

	socket.on('connect', () => {
		console.log('Connected to server');
		socketStore.set(socket);

		const session = loadSession();
		if (session) {
			socket.emit('restore', { joinCode: session.joinCode, playerId: session.playerId });
		}
	});

	socket.on('room_created', ({ roomId, playerId, joinCode }) => {
		roomIdStore.set(roomId);
		playerIdStore.set(playerId);
		joinCodeStore.set(joinCode);
		saveSession({ joinCode, playerId });
		setPhase('matchmaking');
	});

	socket.on('player_joined', ({ players }) => {
		const opponent = players.find((p: { id: string; name: string }) => p.id !== myId());
		if (opponent) {
			enemyStore.update((s) => ({ ...s, name: opponent.name }));
		}
		if (players.length === 2) {
			setPhase('placement');
		}
	});

	socket.on('phase_changed', (phase: 'placement' | 'battle' | 'result') => {
		setPhase(phase);
	});

	socket.on('game_started', ({ turn }) => {
		setPhase('battle');
		setTurn(turn === myId() ? 'player' : 'enemy');
	});

	socket.on('attack_result', ({ attackerId, coordinate, result, shipSunk }) => {
		const isMyAttack = attackerId === myId();
		const targetStore = isMyAttack ? enemyStore : playerStore;

		targetStore.update((s) => {
			const newBoard = s.board.map((row) => row.map((c) => ({ ...c })));
			newBoard[coordinate.y][coordinate.x].hit = true;
			if (result === 'hit') {
				newBoard[coordinate.y][coordinate.x].occupied = true;
			}

			let newShips = s.ships;
			if (shipSunk) {
				newShips = s.ships.map((ship) => (ship.id === shipSunk ? { ...ship, sunk: true } : ship));
			}

			return { ...s, board: newBoard, ships: newShips };
		});
	});

	socket.on('turn_changed', ({ turn }) => {
		setTurn(turn === myId() ? 'player' : 'enemy');
	});

	socket.on('game_over', ({ winnerId }) => {
		setWinner(winnerId === myId() ? 'player' : 'enemy');
		setPhase('result');
		clearSession();
	});

	socket.on('game_restored', (payload) => {
		const { roomId, joinCode, playerId, players, phase, turn, winner, board, ships, myAttacks } =
			payload as {
				roomId: string;
				joinCode: string;
				playerId: string;
				players: { id: string; name: string; ready: boolean }[];
				phase: 'matchmaking' | 'placement' | 'battle' | 'result';
				turn: string | null;
				winner: string | null;
				board: Board;
				ships: ShipState[];
				myAttacks: AttackRecord[];
			};

		roomIdStore.set(roomId);
		joinCodeStore.set(joinCode);
		playerIdStore.set(playerId);
		saveSession({ joinCode, playerId });

		const me = players.find((p) => p.id === playerId);
		const opponent = players.find((p) => p.id !== playerId);

		playerStore.set({
			id: playerId,
			name: me?.name ?? 'Player',
			board,
			ships,
			attacks: myAttacks.map((a) => a.coordinate),
			ready: me?.ready ?? false
		});

		// The opponent's fleet stays hidden; rebuild the enemy board from our own
		// attack history so hit/miss markers survive a reconnect.
		const enemyBoard = createBoard();
		myAttacks.forEach((a) => {
			enemyBoard[a.coordinate.y][a.coordinate.x].hit = true;
			if (a.result === 'hit') {
				enemyBoard[a.coordinate.y][a.coordinate.x].occupied = true;
			}
		});

		enemyStore.set({
			id: opponent?.id ?? 'enemy',
			name: opponent?.name ?? 'Opponent',
			board: enemyBoard,
			ships: [],
			attacks: [],
			ready: opponent?.ready ?? false
		});

		setPhase(phase);
		if (turn) setTurn(turn === playerId ? 'player' : 'enemy');
		if (winner) setWinner(winner === playerId ? 'player' : 'enemy');
	});

	socket.on('player_disconnected', ({ playerId }) => {
		if (playerId === myId()) return;
		alert('Opponent disconnected. Waiting for them to reconnect...');
	});

	socket.on('player_rejoined', ({ playerId }) => {
		if (playerId === myId()) return;
		alert('Opponent has reconnected!');
	});

	socket.on('error', ({ message }) => {
		alert(message);
	});

	socket.on('disconnect', () => {
		socketStore.set(null);
	});

	return socket;
}

export function disconnectSocket() {
	clearSession();
	roomIdStore.set(null);
	joinCodeStore.set(null);
	playerIdStore.set(null);
	socketStore.update((socket) => {
		socket?.disconnect();
		return null;
	});
}

export function createRoom(playerName: string) {
	const socket = get(socketStore);
	if (socket) {
		socket.emit('create_room', { playerName });
	}
}

export function joinRoom(joinCode: string, playerName: string) {
	const socket = get(socketStore);
	if (socket) {
		socket.emit('join_room', { joinCode, playerName });
	}
}

export function emitAttack(coordinate: Coordinate) {
	const socket = get(socketStore);
	if (socket) {
		socket.emit('attack', { coordinate });
	}
}

export function emitShipsPlaced(ships: ShipState[]) {
	const socket = get(socketStore);
	if (socket) {
		socket.emit('place_ships', { ships });
	}
}
