/**
 * Simulated game state — a minimal RPG-like store for demo purposes.
 * Tracks characters, game variables (switches/flags), and a basic inventory.
 * Inspired by RPG Maker's data model, kept intentionally simple.
 */

export interface GameCharacter {
  readonly characterId: string;
  readonly displayName: string;
  readonly spriteColor: string;
  readonly portraitPath?: string;
}

export interface GameItem {
  readonly itemId: string;
  readonly displayName: string;
  readonly quantity: number;
}

export interface GameStore {
  readonly characters: Map<string, GameCharacter>;
  readonly variables: Map<string, number>;
  readonly switches: Map<string, boolean>;
  readonly inventory: Map<string, GameItem>;
}

export function createGameStore(): GameStore {
  const store: GameStore = {
    characters: new Map(),
    variables: new Map(),
    switches: new Map(),
    inventory: new Map(),
  };

  return store;
}

export function registerCharacter(
  gameStore: GameStore,
  character: GameCharacter,
): void {
  gameStore.characters.set(character.characterId, character);
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
