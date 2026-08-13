<script lang="ts">
	import { playerStore } from '../../stores/playerStore';
	import { startSinglePlayerGame } from '../../game/gameController';
	import { connectSocket, createRoom, joinRoom, disconnectSocket } from '../../socket/client';
	import { generateRandomName } from '../../game/utils';

	let playerName = $state(generateRandomName());
	let joinCode = $state('');
	let mode = $state<'main' | 'multiplayer'>('main');

	function randomizeName() {
		playerName = generateRandomName();
	}

	function handleSinglePlayer() {
		playerStore.update((s) => ({ ...s, name: playerName }));
		startSinglePlayerGame();
	}

	function handleMultiplayer() {
		mode = 'multiplayer';
		connectSocket();
	}

	function handleCreateRoom() {
		playerStore.update((s) => ({ ...s, name: playerName }));
		createRoom(playerName);
	}

	function handleJoinRoom() {
		if (!joinCode) return;
		playerStore.update((s) => ({ ...s, name: playerName }));
		joinRoom(joinCode, playerName);
	}
</script>

<div
	class="animate-fade-in w-full max-w-md rounded-3xl border-2 border-slate-700 bg-slate-800 p-10 shadow-2xl"
>
	<h2 class="mb-8 text-center text-4xl font-black tracking-tighter text-white uppercase italic">
		Prepare for Battle
	</h2>

	<div class="space-y-6">
		<div>
			<label
				for="playerName"
				class="mb-2 ml-1 block text-xs font-bold tracking-widest text-slate-500 uppercase"
			>
				Your Callsign
			</label>
			<div class="flex gap-2">
				<input
					id="playerName"
					type="text"
					bind:value={playerName}
					placeholder="Enter name..."
					class="w-full rounded-xl border-2 border-slate-700 bg-slate-900 px-4 py-3 font-bold text-white transition-colors outline-none focus:border-blue-500"
				/>
				<button
					class="rounded-xl border-2 border-slate-700 bg-slate-900 px-4 transition-all hover:bg-slate-700 active:scale-95"
					onclick={randomizeName}
					title="Randomize Callsign"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-slate-400"
					>
						<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" />
						<path d="m18 2 4 4-4 4" />
						<path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
						<path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
						<path d="m18 14 4 4-4 4" />
					</svg>
				</button>
			</div>
		</div>

		{#if mode === 'main'}
			<div class="grid grid-cols-1 gap-4 pt-4">
				<button
					class="w-full rounded-xl bg-blue-600 py-4 text-xl font-bold text-white shadow-lg shadow-blue-900/40 transition-all hover:bg-blue-500 active:scale-95"
					onclick={handleSinglePlayer}
				>
					Single Player
				</button>
				<button
					class="w-full rounded-xl border border-slate-600 bg-slate-700 py-4 text-xl font-bold text-white transition-all hover:bg-slate-600 active:scale-95"
					onclick={handleMultiplayer}
				>
					Multiplayer
				</button>
			</div>
		{:else}
			<div class="animate-slide-up space-y-6 pt-4">
				<button
					class="w-full rounded-xl bg-blue-600 py-4 text-xl font-bold text-white shadow-lg shadow-blue-900/40 transition-all hover:bg-blue-500 active:scale-95"
					onclick={handleCreateRoom}
				>
					Create New Room
				</button>

				<div class="relative flex items-center py-2">
					<div class="flex-grow border-t border-slate-700"></div>
					<span class="mx-4 flex-shrink text-xs font-bold tracking-widest text-slate-500 uppercase"
						>or</span
					>
					<div class="flex-grow border-t border-slate-700"></div>
				</div>

				<div class="space-y-3">
					<input
						type="text"
						bind:value={joinCode}
						placeholder="Enter Room Code"
						class="w-full rounded-xl border-2 border-slate-700 bg-slate-900 px-4 py-3 text-center font-bold tracking-widest text-white uppercase transition-colors outline-none focus:border-red-500"
					/>
					<button
						class="w-full rounded-xl bg-red-600 py-4 text-xl font-bold text-white shadow-lg shadow-red-900/40 transition-all hover:bg-red-500 active:scale-95"
						onclick={handleJoinRoom}
					>
						Join Room
					</button>
				</div>

				<button
					class="w-full pt-2 text-sm font-bold text-slate-400 transition-colors hover:text-white"
					onclick={() => {
						disconnectSocket();
						mode = 'main';
					}}
				>
					← Back to Main Menu
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.animate-fade-in {
		animation: fadeIn 0.3s ease-out forwards;
	}
	.animate-slide-up {
		animation: slideUp 0.3s ease-out forwards;
	}
</style>
