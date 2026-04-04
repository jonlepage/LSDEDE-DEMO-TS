/**
 * Simulated game state — a minimal RPG-like store for demo purposes.
 * Tracks game variables (switches/flags) and a basic inventory.
 * Inspired by RPG Maker's data model, kept intentionally simple.
 */

import type {
	lsdeCharacter,
	lsdeDictionaryinventory,
} from "../../public/blueprints/blueprint.types";

/**
 * Type-safe character ID dictionary.
 * Guaranteed by `satisfies` to cover every character defined in the LSDE blueprint.
 * If a character is added in LSDE and re-exported, tsc will error until it's added here.
 */
export const GAME_ACTORS = {
	l1: "l1",
	l2: "l2",
	l3: "l3",
	l4: "l4",
	boss: "boss",
} as const satisfies Record<lsdeCharacter, lsdeCharacter>;

export interface GameItem {
	readonly itemId: ({} & string) | lsdeDictionaryinventory;
	readonly displayName: string;
	readonly quantity: number;
}

export interface GameStore {
	readonly variables: Map<string, number>;
	readonly switches: Map<string, boolean>;
	readonly inventory: Map<string, GameItem>;
	readonly party: Map<string, boolean>;
}

export function createGameStore(): GameStore {
	return {
		variables: new Map(),
		switches: new Map(),
		inventory: new Map(),
		party: new Map(),
	};
}

export function setGameVariable(
	gameStore: GameStore,
	variableName: string,
	value: number,
): void {
	gameStore.variables.set(variableName, value);
}

export function getGameVariable(
	gameStore: GameStore,
	variableName: string,
): number {
	return gameStore.variables.get(variableName) ?? 0;
}

export function setGameSwitch(
	gameStore: GameStore,
	switchName: string,
	isEnabled: boolean,
): void {
	gameStore.switches.set(switchName, isEnabled);
}

export function getGameSwitch(
	gameStore: GameStore,
	switchName: string,
): boolean {
	return gameStore.switches.get(switchName) ?? false;
}

export function addItemToInventory(
	gameStore: GameStore,
	itemId: string,
	displayName: string,
	quantity: number = 1,
): void {
	const existingItem = gameStore.inventory.get(itemId);
	if (existingItem) {
		gameStore.inventory.set(itemId, {
			...existingItem,
			quantity: existingItem.quantity + quantity,
		});
	} else {
		gameStore.inventory.set(itemId, { itemId, displayName, quantity });
	}
}

export function getInventoryItemQuantity(
	gameStore: GameStore,
	itemId: string,
): number {
	return gameStore.inventory.get(itemId)?.quantity ?? 0;
}

export function addPartyMember(
	gameStore: GameStore,
	characterId: string,
): void {
	gameStore.party.set(characterId, true);
}

export function isPartyMember(
	gameStore: GameStore,
	characterId: string,
): boolean {
	return gameStore.party.get(characterId) ?? false;
}

export function removeItemFromInventory(
	gameStore: GameStore,
	itemId: string,
	quantity: number = 1,
): void {
	const existingItem = gameStore.inventory.get(itemId);
	if (!existingItem) return;

	const remainingQuantity = existingItem.quantity - quantity;
	if (remainingQuantity <= 0) {
		gameStore.inventory.delete(itemId);
	} else {
		gameStore.inventory.set(itemId, {
			...existingItem,
			quantity: remainingQuantity,
		});
	}
}
