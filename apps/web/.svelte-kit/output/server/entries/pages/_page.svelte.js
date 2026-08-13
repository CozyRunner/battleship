import "../../chunks/index-server.js";
import { D as get, H as escape_html, V as attr, a as ensure_array_like, c as store_get, i as derived, k as writable, l as stringify, n as attr_class, r as attr_style, u as unsubscribe_stores } from "../../chunks/dev.js";
import "../../chunks/index-server2.js";
import { t as settingsStore } from "../../chunks/settingsStore.js";
import "socket.io-client";
import { Howl } from "howler";
import * as Comlink from "comlink";
var gameStore = writable({
	phase: "menu",
	turn: null,
	winner: null
});
function setPhase(phase) {
	gameStore.update((state) => ({
		...state,
		phase
	}));
}
function setTurn(turn) {
	gameStore.update((state) => ({
		...state,
		turn
	}));
}
function setWinner(winner) {
	gameStore.update((state) => ({
		...state,
		winner
	}));
}
//#endregion
//#region src/lib/game/types.ts
var FLEET_CONFIG = [
	{
		id: "carrier",
		name: "Carrier",
		length: 5
	},
	{
		id: "battleship",
		name: "Battleship",
		length: 4
	},
	{
		id: "cruiser",
		name: "Cruiser",
		length: 3
	},
	{
		id: "submarine",
		name: "Submarine",
		length: 3
	},
	{
		id: "destroyer",
		name: "Destroyer",
		length: 2
	}
];
//#endregion
//#region src/lib/game/engine/board.ts
/**
* Creates a new empty board of the given size.
* @param size The size of the board (width and height).
* @returns A new Board initialized with empty cells.
*/
function createBoard(size = 10) {
	const board = [];
	for (let y = 0; y < size; y++) {
		const row = [];
		for (let x = 0; x < size; x++) row.push({
			occupied: false,
			hit: false
		});
		board.push(row);
	}
	return board;
}
/**
* Gets a cell from the board at the specified coordinate.
* @param board The board to search.
* @param coord The coordinate to look up.
* @returns The Cell at the coordinate, or null if out of bounds.
*/
function getCell(board, coord) {
	const { x, y } = coord;
	if (y < 0 || y >= board.length || x < 0 || x >= board[y].length) return null;
	return board[y][x];
}
//#endregion
//#region src/lib/stores/playerStore.ts
function createPlayerStore(id, name) {
	const initialShips = FLEET_CONFIG.map((d) => ({
		id: d.id,
		definitionId: d.id,
		coordinates: [],
		hits: 0,
		sunk: false
	}));
	const initialState = {
		id,
		name,
		board: createBoard(),
		ships: initialShips,
		attacks: [],
		ready: false
	};
	const { subscribe, set, update } = writable(initialState);
	return {
		subscribe,
		set,
		update,
		reset: () => set(initialState),
		updateBoard: (board) => update((s) => ({
			...s,
			board
		})),
		addAttack: (coord) => update((s) => ({
			...s,
			attacks: [...s.attacks, coord]
		})),
		setShips: (ships) => update((s) => ({
			...s,
			ships
		})),
		setReady: (ready) => update((s) => ({
			...s,
			ready
		}))
	};
}
var playerStore = createPlayerStore("player", "Player");
var enemyStore = createPlayerStore("enemy", "Opponent");
//#endregion
//#region src/lib/socket/client.ts
var socketStore = writable(null);
writable(null);
var joinCodeStore = writable(null);
writable(null);
typeof window !== "undefined" && window.location.origin;
function emitAttack(coordinate) {
	const socket = get(socketStore);
	if (socket) socket.emit("attack", { coordinate });
}
var placementStore = writable({
	placedShips: [],
	selectedShip: null,
	currentOrientation: "H"
});
var aiStore = writable({
	difficulty: "medium",
	mode: "hunt",
	targetQueue: [],
	previousAttacks: [],
	sunkShipIds: []
});
//#endregion
//#region src/lib/game/engine/attack.ts
/**
* Resolves an attack at the given coordinate.
* @param board The current board state.
* @param coord The coordinate being attacked.
* @returns The new board state, the result of the attack, and the ID of the ship if it was sunk.
* @throws Error if the attack is invalid (out of bounds or already attacked).
*/
function resolveAttack(board, coord) {
	const cell = getCell(board, coord);
	if (!cell) throw new Error(`Attack out of bounds at (${coord.x}, ${coord.y})`);
	if (cell.hit) throw new Error(`Coordinate (${coord.x}, ${coord.y}) has already been attacked`);
	const newBoard = board.map((row) => row.map((c) => ({ ...c })));
	const { x, y } = coord;
	const targetCell = newBoard[y][x];
	targetCell.hit = true;
	const result = targetCell.occupied ? "hit" : "miss";
	let shipSunk;
	if (result === "hit" && targetCell.shipId) {
		const shipId = targetCell.shipId;
		if (!newBoard.some((row) => row.some((c) => c.shipId === shipId && !c.hit))) shipSunk = shipId;
	}
	return {
		board: newBoard,
		result,
		shipSunk
	};
}
//#endregion
//#region src/lib/game/engine/win.ts
/**
* Checks if the game is over by determining if all ships are sunk.
* @param ships The current state of all ships in a fleet.
* @returns True if all ships are sunk, false otherwise.
*/
function isGameOver(ships) {
	if (ships.length === 0) return false;
	return ships.every((ship) => ship.sunk);
}
//#endregion
//#region src/lib/audio/audioManager.ts
var AudioManager = class {
	sounds = {};
	constructor() {
		this.sounds = {
			thud: new Howl({ src: ["/audio/thud.mp3"] }),
			cannon: new Howl({ src: ["/audio/cannon.mp3"] }),
			explosion: new Howl({ src: ["/audio/explosion.mp3"] }),
			splash: new Howl({ src: ["/audio/splash.mp3"] }),
			victory: new Howl({ src: ["/audio/victory.mp3"] }),
			defeat: new Howl({ src: ["/audio/defeat.mp3"] }),
			engage: new Howl({ src: ["/audio/cannon.mp3"] })
		};
	}
	play(name) {
		const { soundEnabled } = get(settingsStore);
		if (soundEnabled && this.sounds[name]) this.sounds[name].play();
	}
};
var audioManager = new AudioManager();
//#endregion
//#region src/lib/game/gameController.ts
var aiWorkerApi = null;
function getAiWorker() {
	if (typeof window === "undefined") return null;
	if (!aiWorkerApi) {
		const worker = new Worker(new URL("./ai/aiWorker.ts", import.meta.url), { type: "module" });
		aiWorkerApi = Comlink.wrap(worker);
	}
	return aiWorkerApi;
}
/**
* Handles an attack from the current player.
*/
async function handleAttack(targetId, coord) {
	const { phase, turn, winner } = get(gameStore);
	if (phase !== "battle" || winner || turn !== (targetId === "enemy" ? "player" : "enemy")) return;
	if (get(socketStore)) {
		emitAttack(coord);
		return;
	}
	const targetStore = targetId === "player" ? playerStore : enemyStore;
	const targetData = get(targetStore);
	try {
		audioManager.play("cannon");
		const result = resolveAttack(targetData.board, coord);
		targetStore.updateBoard(result.board);
		if (result.result === "hit") audioManager.play("explosion");
		else audioManager.play("splash");
		if (result.shipSunk) {
			const updatedShips = targetData.ships.map((s) => s.id === result.shipSunk ? {
				...s,
				sunk: true
			} : s);
			targetStore.setShips(updatedShips);
		}
		if (isGameOver(get(targetStore).ships)) {
			setWinner(get(gameStore).turn);
			setPhase("result");
			audioManager.play("victory");
			return;
		}
		const nextTurn = targetId;
		setTurn(nextTurn);
		if (nextTurn === "enemy") await handleAiTurn();
	} catch (error) {
		console.error("Invalid attack:", error);
	}
}
/**
* Logic for the AI to take its turn.
*/
async function handleAiTurn() {
	const aiApi = getAiWorker();
	if (!aiApi) return;
	await new Promise((resolve) => setTimeout(resolve, 600));
	const playerBoard = get(playerStore).board;
	const currentAiState = get(aiStore);
	try {
		audioManager.play("cannon");
		const move = await aiApi.selectAiMove(playerBoard, currentAiState.difficulty, currentAiState);
		const result = resolveAttack(playerBoard, move);
		playerStore.updateBoard(result.board);
		if (result.result === "hit") audioManager.play("explosion");
		else audioManager.play("splash");
		if (result.shipSunk) {
			const updatedShips = get(playerStore).ships.map((s) => s.id === result.shipSunk ? {
				...s,
				sunk: true
			} : s);
			playerStore.setShips(updatedShips);
		}
		const nextAiState = await aiApi.updateAiState(currentAiState, move, result.result, result.shipSunk);
		aiStore.set(nextAiState);
		if (isGameOver(get(playerStore).ships)) {
			setWinner("enemy");
			setPhase("result");
			audioManager.play("defeat");
			return;
		}
		setTurn("player");
	} catch (error) {
		console.error("AI Turn Error:", error);
	}
}
//#endregion
//#region src/lib/components/board/Cell.svelte
function Cell($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { x, y, hit = false, occupied = false, shipId = "", isEnemy = false, canAttack = false, onclick } = $$props;
		const shipColors = {
			carrier: "from-slate-500 to-slate-700",
			battleship: "from-blue-600 to-blue-800",
			cruiser: "from-emerald-600 to-emerald-800",
			submarine: "from-amber-600 to-amber-800",
			destroyer: "from-rose-600 to-rose-800"
		};
		let shipType = derived(() => shipId.split("-").pop() || "");
		let gradient = derived(() => shipColors[shipType()] || "from-slate-400 to-slate-600");
		let statusClass = derived(() => {
			if (hit) return occupied ? "bg-red-500" : "bg-blue-300";
			if (occupied && !isEnemy) return `bg-gradient-to-br ${gradient()}`;
			return "bg-blue-950/20";
		});
		let hoverClass = derived(() => canAttack && !hit ? "hover:bg-blue-400/40 cursor-pointer" : "");
		let animationsEnabled = derived(() => store_get($$store_subs ??= {}, "$settingsStore", settingsStore).animationsEnabled);
		$$renderer.push(`<div${attr_class(`relative aspect-square w-full border border-blue-900/30 transition-all duration-200 ${stringify(statusClass())} ${stringify(hoverClass())}`, "svelte-1gxn1wb")}${attr("aria-label", `Cell ${stringify(String.fromCharCode(65 + x))}${stringify(y + 1)}`)}>`);
		if (occupied && !isEnemy && !hit) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="absolute inset-0 flex items-center justify-center opacity-20 svelte-1gxn1wb"><div class="h-2/3 w-2/3 rounded-sm border border-white svelte-1gxn1wb"></div></div> <div class="absolute top-0 left-0 h-0.5 w-full bg-white/10 svelte-1gxn1wb"></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (hit) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div${attr_class(`absolute inset-0 flex items-center justify-center ${stringify(animationsEnabled() ? "animate-in zoom-in-50 duration-300" : "")}`, "svelte-1gxn1wb")}>`);
			if (occupied) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="relative flex h-full w-full items-center justify-center svelte-1gxn1wb">`);
				if (animationsEnabled()) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<div class="absolute h-4/5 w-4/5 animate-pulse rounded-full bg-orange-500/20 blur-sm svelte-1gxn1wb"></div>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> <span class="text-xl font-black text-white drop-shadow-md">✕</span></div>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<div${attr_class(`h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] ${stringify(animationsEnabled() ? "animate-bounce" : "")}`, "svelte-1gxn1wb")}></div>`);
			}
			$$renderer.push(`<!--]--></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
//#region src/lib/components/board/Board.svelte
function Board($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { board, isEnemy = false, canAttack = false, onattack } = $$props;
		function handleCellClick(x, y) {
			if (canAttack && onattack) onattack({
				x,
				y
			});
		}
		$$renderer.push(`<div class="grid grid-cols-10 gap-0 overflow-hidden rounded-lg border-2 border-blue-900 bg-blue-900 shadow-xl svelte-vm5i0v"><!--[-->`);
		const each_array = ensure_array_like(board);
		for (let y = 0, $$length = each_array.length; y < $$length; y++) {
			let row = each_array[y];
			$$renderer.push(`<!--[-->`);
			const each_array_1 = ensure_array_like(row);
			for (let x = 0, $$length = each_array_1.length; x < $$length; x++) {
				let cell = each_array_1[x];
				Cell($$renderer, {
					x,
					y,
					hit: cell.hit,
					occupied: cell.occupied,
					shipId: cell.shipId,
					isEnemy,
					canAttack,
					onclick: () => handleCellClick(x, y)
				});
			}
			$$renderer.push(`<!--]-->`);
		}
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
//#region src/lib/components/board/PlacementGrid.svelte
function PlacementGrid($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let hoveredCoord = null;
		let currentBoard = derived(() => {
			let board = createBoard();
			store_get($$store_subs ??= {}, "$placementStore", placementStore).placedShips.forEach((ps) => {
				const { x, y } = ps.coord;
				for (let i = 0; i < ps.definition.length; i++) {
					const cx = ps.orientation === "H" ? x + i : x;
					const cy = ps.orientation === "V" ? y + i : y;
					if (board[cy]?.[cx]) {
						board[cy][cx].occupied = true;
						board[cy][cx].shipId = ps.definition.id;
					}
				}
			});
			return board;
		});
		let isValidPlacement = derived(() => {
			return false;
		});
		$$renderer.push(`<div class="grid w-full max-w-[500px] grid-cols-10 gap-0 overflow-hidden rounded-xl border-2 border-blue-900 bg-blue-900 shadow-2xl"><!--[-->`);
		const each_array = ensure_array_like(Array.from({ length: 10 }, (_, i) => i));
		for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
			let y = each_array[$$index_1];
			$$renderer.push(`<!--[-->`);
			const each_array_1 = ensure_array_like(Array.from({ length: 10 }, (_, i) => i));
			for (let $$index = 0, $$length = each_array_1.length; $$index < $$length; $$index++) {
				let x = each_array_1[$$index];
				const cell = currentBoard()[y][x];
				const isPreview = store_get($$store_subs ??= {}, "$placementStore", placementStore).selectedShip && hoveredCoord;
				$$renderer.push(`<div${attr_class(`aspect-square border border-blue-800/30 transition-all duration-150 ${stringify(cell.occupied ? "bg-slate-600" : "bg-blue-950/40")} ${stringify(isPreview ? isValidPlacement() ? "bg-green-500/60" : "bg-red-500/60" : "")} cursor-crosshair hover:bg-blue-800/20`)}>`);
				if (cell.occupied) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<div class="h-full w-full border border-white/10 bg-slate-500/20 shadow-inner"></div>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></div>`);
			}
			$$renderer.push(`<!--]-->`);
		}
		$$renderer.push(`<!--]--></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
//#region src/lib/components/ship/Ship.svelte
function Ship($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { ship, orientation = "H", isDragging = false, sunk = false, ondoubleclick } = $$props;
		const shipColors = {
			carrier: "from-slate-600 to-slate-800",
			battleship: "from-blue-700 to-blue-900",
			cruiser: "from-emerald-700 to-emerald-900",
			submarine: "from-amber-700 to-amber-900",
			destroyer: "from-rose-700 to-rose-900"
		};
		let gradient = derived(() => shipColors[ship.id] || "from-slate-500 to-slate-700");
		let animationsEnabled = derived(() => store_get($$store_subs ??= {}, "$settingsStore", settingsStore).animationsEnabled);
		$$renderer.push(`<div${attr_class(`ship flex ${stringify(orientation === "V" ? "flex-col" : "flex-row")} cursor-grab gap-0 active:cursor-grabbing ${stringify(isDragging ? "opacity-50" : "")} drop-shadow-lg`, "svelte-1v358il", {
			"animate-sink": sunk && animationsEnabled(),
			"opacity-40": sunk,
			"grayscale": sunk
		})}><!--[-->`);
		const each_array = ensure_array_like(Array.from({ length: ship.length }, (_, index) => index));
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let i = each_array[$$index];
			$$renderer.push(`<div${attr_class(`h-10 w-10 border border-white/10 bg-gradient-to-br ${stringify(gradient())} relative overflow-hidden transition-all duration-500`, "svelte-1v358il", {
				"rounded-l-2xl": orientation === "H" && i === 0,
				"rounded-r-2xl": orientation === "H" && i === ship.length - 1,
				"rounded-t-2xl": orientation === "V" && i === 0,
				"rounded-b-2xl": orientation === "V" && i === ship.length - 1
			})}><div class="absolute top-0 left-0 h-1 w-full bg-white/20 svelte-1v358il"></div> <div class="absolute inset-0 flex items-center justify-center opacity-30 svelte-1v358il">`);
			if (orientation === "H" && i > 0 && i < ship.length - 1 || orientation === "V" && i > 0 && i < ship.length - 1) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="h-1/2 w-1/2 rounded-sm border-2 border-white svelte-1v358il"></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> `);
			if (i === 0) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="absolute inset-0 bg-white/5 svelte-1v358il"${attr_style(`clip-path: ${stringify(orientation === "H" ? "polygon(100% 0, 0 50%, 100% 100%)" : "polygon(0 100%, 50% 0, 100% 100%)")}`)}></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (i === ship.length - 1) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="absolute inset-0 bg-black/10 svelte-1v358il"${attr_style(`clip-path: ${stringify(orientation === "H" ? "polygon(0 0, 10% 0, 10% 100%, 0 100%)" : "polygon(0 0, 100% 0, 100% 10%, 0 10%)")}`)}></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
//#region src/lib/components/board/ShipPlacementPanel.svelte
function ShipPlacementPanel($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let selectedId = derived(() => store_get($$store_subs ??= {}, "$placementStore", placementStore).selectedShip?.id);
		let placedIds = derived(() => store_get($$store_subs ??= {}, "$placementStore", placementStore).placedShips.map((ps) => ps.definition.id));
		$$renderer.push(`<div class="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl"><div class="flex items-center justify-between"><h3 class="text-xl font-bold tracking-tight text-white uppercase">Your Fleet</h3> <button class="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-600">Rotate (R)</button></div> <div class="flex flex-col gap-4"><!--[-->`);
		const each_array = ensure_array_like(FLEET_CONFIG);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let ship = each_array[$$index];
			const isPlaced = placedIds().includes(ship.id);
			const isSelected = selectedId() === ship.id;
			$$renderer.push(`<button${attr_class(`group relative flex items-center justify-between rounded-xl border-2 p-4 transition-all ${stringify(isPlaced ? "cursor-not-allowed border-slate-700 bg-slate-800/50 opacity-40" : isSelected ? "border-blue-500 bg-blue-900/20 shadow-lg shadow-blue-900/20" : "border-slate-700 bg-slate-700/30 hover:border-slate-500 hover:bg-slate-700/50")}`)}${attr("disabled", isPlaced, true)}><div class="flex flex-col items-start"><span${attr_class(`text-sm font-bold ${stringify(isSelected ? "text-blue-400" : "text-slate-300")} transition-colors group-hover:text-white`)}>${escape_html(ship.name)}</span> <span class="text-xs text-slate-500">${escape_html(ship.length)} Units</span></div> <div class="origin-right scale-75">`);
			Ship($$renderer, {
				ship,
				orientation: "H"
			});
			$$renderer.push(`<!----></div> `);
			if (isPlaced) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-900/20"><span class="rounded bg-slate-700 px-2 py-0.5 text-[10px] font-black text-white uppercase">Deployed</span></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></button>`);
		}
		$$renderer.push(`<!--]--></div> <div class="mt-2 rounded-lg border border-slate-700 bg-slate-900/50 p-3"><p class="text-xs leading-relaxed text-slate-400 italic">Select a ship and click on the board to deploy. Use double-click or the 'R' key to rotate.</p></div></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
//#region src/lib/components/board/PlacementView.svelte
function PlacementView($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let isComplete = derived(() => store_get($$store_subs ??= {}, "$placementStore", placementStore).placedShips.length === FLEET_CONFIG.length);
		let currentDifficulty = derived(() => store_get($$store_subs ??= {}, "$aiStore", aiStore).difficulty);
		let isMultiplayer = derived(() => store_get($$store_subs ??= {}, "$socketStore", socketStore) !== null);
		let isReady = derived(() => store_get($$store_subs ??= {}, "$playerStore", playerStore).ready);
		const difficulties = [
			{
				id: "easy",
				label: "Easy"
			},
			{
				id: "medium",
				label: "Medium"
			},
			{
				id: "hard",
				label: "Hard"
			},
			{
				id: "expert",
				label: "Pro"
			}
		];
		$$renderer.push(`<div class="animate-fade-in flex w-full max-w-6xl flex-col items-center justify-center gap-12 lg:flex-row lg:items-start svelte-avv4jl"><div class="flex w-full max-w-[500px] flex-col gap-8"><div class="text-center lg:text-left"><h2 class="text-3xl font-black tracking-tight text-white uppercase">Deploy Your Fleet</h2> <p class="mt-1 font-medium text-slate-400">Position your ships for the upcoming battle.</p></div> `);
		PlacementGrid($$renderer, {});
		$$renderer.push(`<!----> `);
		if (!isMultiplayer()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<fieldset class="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4"><legend class="mb-3 block text-xs font-bold tracking-widest text-slate-500 uppercase">Combat Difficulty</legend> <div class="grid grid-cols-4 gap-2"><!--[-->`);
			const each_array = ensure_array_like(difficulties);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let diff = each_array[$$index];
				$$renderer.push(`<button${attr_class(`rounded-lg border px-1 py-2 text-xs font-bold transition-all ${stringify(currentDifficulty() === diff.id ? "border-blue-400 bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "border-slate-600 bg-slate-700 text-slate-400 hover:bg-slate-600")}`)}>${escape_html(diff.label)}</button>`);
			}
			$$renderer.push(`<!--]--></div></fieldset>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <div class="flex gap-4"><button class="flex-1 rounded-xl border border-slate-600 bg-slate-700 py-4 font-bold text-white transition-all hover:bg-slate-600 active:scale-95">Reset Layout</button> <button class="flex-[2] rounded-xl bg-blue-600 py-4 font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-500 active:scale-95 disabled:bg-slate-800 disabled:text-slate-600"${attr("disabled", !isComplete() || isReady(), true)}>${escape_html(isReady() ? "Awaiting Opponent..." : "Engage Target")}</button></div></div> `);
		ShipPlacementPanel($$renderer, {});
		$$renderer.push(`<!----></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
//#region src/lib/components/ui/StatusBar.svelte
function StatusBar($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let phase = derived(() => store_get($$store_subs ??= {}, "$gameStore", gameStore).phase);
		let turn = derived(() => store_get($$store_subs ??= {}, "$gameStore", gameStore).turn);
		let winner = derived(() => store_get($$store_subs ??= {}, "$gameStore", gameStore).winner);
		let isMultiplayer = derived(() => store_get($$store_subs ??= {}, "$socketStore", socketStore) !== null);
		function getMessage() {
			if (winner()) {
				if (winner() === "player") return "Victory! You sank the enemy fleet!";
				return `Defeat! ${store_get($$store_subs ??= {}, "$enemyStore", enemyStore).name} destroyed your fleet.`;
			}
			if (phase() === "matchmaking") return "Waiting for opponent...";
			if (phase() === "placement") return "Deploy your fleet to the grid.";
			if (phase() === "battle") {
				if (turn() === "player") return "Your turn! Select a target.";
				return isMultiplayer() ? `${store_get($$store_subs ??= {}, "$enemyStore", enemyStore).name} is choosing a target...` : "AI is calculating...";
			}
			return "Welcome to Battleship.";
		}
		$$renderer.push(`<div class="flex w-full items-center justify-between rounded-b-xl border-t border-slate-700 bg-slate-800 px-6 py-4 text-white shadow-md"><div class="flex flex-col"><span class="text-sm font-semibold tracking-widest text-slate-400 uppercase">Game Status</span> <span class="text-xl font-bold tracking-tight">${escape_html(getMessage())}</span></div> <div class="flex gap-8"><div class="flex flex-col items-center"><span class="text-xs text-slate-400 uppercase">Your Ships</span> <span class="font-mono text-2xl text-green-400">${escape_html(store_get($$store_subs ??= {}, "$playerStore", playerStore).ships.filter((s) => !s.sunk).length)} / 5</span></div> <div class="flex flex-col items-center"><span class="text-xs text-slate-400 uppercase">Enemy Ships</span> <span class="font-mono text-2xl text-red-400">${escape_html(store_get($$store_subs ??= {}, "$enemyStore", enemyStore).ships.filter((s) => !s.sunk).length)} / 5</span></div></div></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
//#region src/lib/game/utils.ts
/**
* Generates a random nautical-themed callsign for the player.
*/
function generateRandomName() {
	const ranks = [
		"Admiral",
		"Captain",
		"Commander",
		"Commodore",
		"Lieutenant",
		"Ensign"
	];
	const adjectives = [
		"Brave",
		"Bold",
		"Swift",
		"Iron",
		"Silent",
		"Fierce",
		"Valiant",
		"Mighty",
		"Grim",
		"Noble"
	];
	const nouns = [
		"Kraken",
		"Shark",
		"Wave",
		"Storm",
		"Anchor",
		"Trident",
		"Falcon",
		"Ghost",
		"Reaper",
		"Vanguard"
	];
	const rank = ranks[Math.floor(Math.random() * ranks.length)];
	const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
	const noun = nouns[Math.floor(Math.random() * nouns.length)];
	return Math.random() > .5 ? `${rank} ${adj} ${noun}` : `${rank} ${noun}`;
}
//#endregion
//#region src/lib/components/ui/GameMenu.svelte
function GameMenu($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let playerName = generateRandomName();
		let joinCode = "";
		let mode = "main";
		$$renderer.push(`<div class="animate-fade-in w-full max-w-md rounded-3xl border-2 border-slate-700 bg-slate-800 p-10 shadow-2xl svelte-xxm2lq"><h2 class="mb-8 text-center text-4xl font-black tracking-tighter text-white uppercase italic">Prepare for Battle</h2> <div class="space-y-6"><div><label for="playerName" class="mb-2 ml-1 block text-xs font-bold tracking-widest text-slate-500 uppercase">Your Callsign</label> <div class="flex gap-2"><input id="playerName" type="text"${attr("value", playerName)} placeholder="Enter name..." class="w-full rounded-xl border-2 border-slate-700 bg-slate-900 px-4 py-3 font-bold text-white transition-colors outline-none focus:border-blue-500"/> <button class="rounded-xl border-2 border-slate-700 bg-slate-900 px-4 transition-all hover:bg-slate-700 active:scale-95" title="Randomize Callsign"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"></path><path d="m18 2 4 4-4 4"></path><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"></path><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"></path><path d="m18 14 4 4-4 4"></path></svg></button></div></div> `);
		if (mode === "main") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="grid grid-cols-1 gap-4 pt-4"><button class="w-full rounded-xl bg-blue-600 py-4 text-xl font-bold text-white shadow-lg shadow-blue-900/40 transition-all hover:bg-blue-500 active:scale-95">Single Player</button> <button class="w-full rounded-xl border border-slate-600 bg-slate-700 py-4 text-xl font-bold text-white transition-all hover:bg-slate-600 active:scale-95">Multiplayer</button></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="animate-slide-up space-y-6 pt-4 svelte-xxm2lq"><button class="w-full rounded-xl bg-blue-600 py-4 text-xl font-bold text-white shadow-lg shadow-blue-900/40 transition-all hover:bg-blue-500 active:scale-95">Create New Room</button> <div class="relative flex items-center py-2"><div class="flex-grow border-t border-slate-700"></div> <span class="mx-4 flex-shrink text-xs font-bold tracking-widest text-slate-500 uppercase">or</span> <div class="flex-grow border-t border-slate-700"></div></div> <div class="space-y-3"><input type="text"${attr("value", joinCode)} placeholder="Enter Room Code" class="w-full rounded-xl border-2 border-slate-700 bg-slate-900 px-4 py-3 text-center font-bold tracking-widest text-white uppercase transition-colors outline-none focus:border-red-500"/> <button class="w-full rounded-xl bg-red-600 py-4 text-xl font-bold text-white shadow-lg shadow-red-900/40 transition-all hover:bg-red-500 active:scale-95">Join Room</button></div> <button class="w-full pt-2 text-sm font-bold text-slate-400 transition-colors hover:text-white">← Back to Main Menu</button></div>`);
		}
		$$renderer.push(`<!--]--></div></div>`);
	});
}
//#endregion
//#region src/lib/components/ui/Matchmaking.svelte
function Matchmaking($$renderer) {
	var $$store_subs;
	let code = derived(() => store_get($$store_subs ??= {}, "$joinCodeStore", joinCodeStore));
	$$renderer.push(`<div class="animate-fade-in w-full max-w-md rounded-3xl border-2 border-slate-700 bg-slate-800 p-12 text-center shadow-2xl svelte-1sm8gb7"><div class="mb-8"><div class="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-600/20"><div class="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div></div> <h2 class="mb-2 text-3xl font-black tracking-tight text-white uppercase">Establishing Link</h2> <p class="font-medium text-slate-400">Waiting for an opponent to join the frequency.</p></div> <div class="mb-8 rounded-2xl border-2 border-slate-700 bg-slate-900 p-6"><span class="mb-3 block text-xs font-bold tracking-widest text-slate-500 uppercase">Your Join Code</span> <div class="flex items-center justify-between gap-4"><span class="font-mono text-4xl font-black tracking-widest text-blue-400 uppercase">${escape_html(code() || "----")}</span> <button class="rounded-xl bg-slate-800 p-3 text-slate-300 transition-colors hover:bg-slate-700 active:scale-95" title="Copy Code"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button></div></div> <p class="text-sm font-medium text-slate-500">Share this code with a friend to start the engagement.</p></div>`);
	if ($$store_subs) unsubscribe_stores($$store_subs);
}
//#endregion
//#region src/routes/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		derived(() => store_get($$store_subs ??= {}, "$settingsStore", settingsStore).animationsEnabled);
		function onAttack(coord) {
			handleAttack("enemy", coord);
		}
		$$renderer.push(`<div class="flex flex-col items-center p-8"><header class="mb-12 text-center"><h1 class="bg-gradient-to-br from-blue-400 to-blue-600 bg-clip-text text-6xl font-black tracking-tighter text-transparent uppercase italic">Battleship</h1> <p class="mt-2 font-medium text-slate-400">Strategic Naval Warfare</p></header> <div class="w-full max-w-6xl">`);
		if (store_get($$store_subs ??= {}, "$gameStore", gameStore).phase === "menu") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="flex items-center justify-center py-20">`);
			GameMenu($$renderer, {});
			$$renderer.push(`<!----></div>`);
		} else if (store_get($$store_subs ??= {}, "$gameStore", gameStore).phase === "matchmaking") {
			$$renderer.push("<!--[1-->");
			$$renderer.push(`<div class="flex items-center justify-center py-20">`);
			Matchmaking($$renderer, {});
			$$renderer.push(`<!----></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div>`);
			StatusBar($$renderer, {});
			$$renderer.push(`<!----> `);
			if (store_get($$store_subs ??= {}, "$gameStore", gameStore).phase === "placement") {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="mt-12">`);
				PlacementView($$renderer, {});
				$$renderer.push(`<!----></div>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<div class="mt-12 grid grid-cols-1 items-start gap-16 md:grid-cols-2"><section class="flex flex-col items-center"><h2 class="mb-6 flex items-center gap-2 text-2xl font-bold text-blue-400"><span class="h-6 w-2 rounded-full bg-blue-500"></span> ${escape_html(store_get($$store_subs ??= {}, "$playerStore", playerStore).name)} Waters</h2> `);
				Board($$renderer, { board: store_get($$store_subs ??= {}, "$playerStore", playerStore).board });
				$$renderer.push(`<!----></section> <section class="flex flex-col items-center"><h2 class="mb-6 flex items-center gap-2 text-2xl font-bold text-red-400"><span class="h-6 w-2 rounded-full bg-red-500"></span> ${escape_html(store_get($$store_subs ??= {}, "$enemyStore", enemyStore).name)} Territory</h2> `);
				Board($$renderer, {
					board: store_get($$store_subs ??= {}, "$enemyStore", enemyStore).board,
					isEnemy: true,
					canAttack: store_get($$store_subs ??= {}, "$gameStore", gameStore).phase === "battle" && store_get($$store_subs ??= {}, "$gameStore", gameStore).turn === "player",
					onattack: onAttack
				});
				$$renderer.push(`<!----></section></div>`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></div> `);
		if (store_get($$store_subs ??= {}, "$gameStore", gameStore).phase === "result") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"><div class="w-full max-w-lg rounded-3xl border-2 border-slate-700 bg-slate-800 p-12 text-center shadow-2xl"><h2 class="mb-6 text-5xl font-black tracking-tighter uppercase">${escape_html(store_get($$store_subs ??= {}, "$gameStore", gameStore).winner === "player" ? "Mission Success" : "Mission Failure")}</h2> <p class="mb-10 text-xl font-medium text-slate-300">${escape_html(store_get($$store_subs ??= {}, "$gameStore", gameStore).winner === "player" ? "You have successfully eliminated the enemy fleet." : "Your fleet has been completely destroyed.")}</p> <button class="w-full rounded-xl bg-blue-600 py-4 text-xl font-bold text-white shadow-lg shadow-blue-900/40 transition-all hover:bg-blue-500 active:scale-95">New Match</button></div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _page as default };
