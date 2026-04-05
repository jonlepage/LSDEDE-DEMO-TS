/**
 * Shared scene setup — creates character sprites from a configuration array.
 * Registers them in a Map and separates player from NPC obstacles.
 */

import type { Container } from "pixi.js";
import { createCharacterSprite } from "../../renderer/characters";
import { createMovementState } from "../../renderer/movement";
import { createCollidable } from "../../renderer/collision";
import type { CollidableSprite } from "../../renderer/collision";
import type { CharacterReference } from "../../game/game-actions";
import type { SceneContext } from "../../shared/scene-context";

export interface MovementProfile {
	readonly speed: number;
	readonly hopStride: number;
	readonly hopHeight: number;
}

export interface CharacterConfiguration {
	readonly characterId: string;
	readonly displayName: string;
	readonly tintColor: number;
	readonly startX: number;
	readonly startY: number;
	readonly scale?: number;
	readonly movementProfile?: MovementProfile;
}

export interface SetupCharactersOptions {
	readonly characterConfigurations: ReadonlyArray<CharacterConfiguration>;
	readonly playerCharacterId: string;
	readonly worldContainer: Container;
	readonly sceneContext: SceneContext;
}

export interface SetupCharactersResult {
	readonly characters: Map<string, CharacterReference>;
	readonly playerReference: CharacterReference;
	readonly npcObstacles: CollidableSprite[];
}

export async function setupCharacters(
	options: SetupCharactersOptions,
): Promise<SetupCharactersResult> {
	const {
		characterConfigurations,
		playerCharacterId,
		worldContainer,
		sceneContext,
	} = options;

	const characters = new Map<string, CharacterReference>();
	const npcObstacles: CollidableSprite[] = [];

	for (const config of characterConfigurations) {
		const movementState = config.movementProfile
			? createMovementState({
				movementSpeed: config.movementProfile.speed,
				hopStrideDistance: config.movementProfile.hopStride,
				hopMaxHeight: config.movementProfile.hopHeight,
			})
			: createMovementState();

		// Randomize hop phase so characters with profiles don't bounce in lockstep.
		if (config.movementProfile) {
			movementState.distanceSinceLastHop =
				Math.random() * movementState.hopStrideDistance;
		}

		const sprite = await createCharacterSprite({
			characterId: config.characterId,
			displayName: config.displayName,
			tintColor: config.tintColor,
			startX: config.startX,
			startY: config.startY,
			scale: config.scale ?? undefined,
		});

		sceneContext.addSprite(sprite, worldContainer);
		characters.set(config.characterId, {
			characterId: config.characterId,
			sprite,
			movementState,
		});

		if (config.characterId !== playerCharacterId) {
			npcObstacles.push(createCollidable(sprite));
		}
	}

	const playerReference = characters.get(playerCharacterId);
	if (!playerReference) {
		throw new Error(
			`Player character "${playerCharacterId}" not found in configurations`,
		);
	}

	return { characters, playerReference, npcObstacles };
}
