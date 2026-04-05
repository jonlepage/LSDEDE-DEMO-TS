/**
 * Shared action executor — maps LSDE actionIds to game facade calls.
 *
 * Each action from the blueprint has: { actionId, params[] }
 * The executor returns a Promise so the handler can await completion.
 * This is the bridge between LSDE's abstract actions and your game's concrete API.
 *
 * If you add a new action signature in LSDE, you add a case here.
 * The params array order matches the signature definition in your LSDE project.
 */

import type { GameActionFacade } from "../../game/game-actions";

export interface BlueprintAction {
	readonly actionId: string;
	readonly params: readonly (string | number | boolean | null)[];
}

export function executeAction(
	action: BlueprintAction,
	gameActions: GameActionFacade,
): Promise<void> {
	switch (action.actionId) {
	case "shakeCamera": {
		const intensity = action.params[0] as number;
		const duration = action.params[1] as number;
		return gameActions.shakeCamera(intensity, duration);
	}

	case "moveCameraToLabel": {
		// In our demo, "labels" are character IDs — the narrative designer
		// placed camera targets on characters. A real game might have named
		// waypoints, but for this demo characters ARE the labels.
		// params[1] is an optional duration in seconds from the blueprint.
		const targetLabel = action.params[0] as string;
		const durationSeconds = action.params[1] as number | undefined;
		return gameActions.moveCameraToCharacter(targetLabel, durationSeconds);
	}

	case "moveCharacterAt": {
		// Moves a character relative to its current position.
		// params[0] = characterId, params[1] = offsetX, params[2] = offsetY (optional)
		// params[3] = isAbsolute (optional) — if true, offsets are relative to world center
		const characterId = action.params[0] as string;
		const offsetX = action.params[1] as number;
		const offsetY = (action.params[2] as number) ?? 0;
		const isAbsolute = action.params[3] === true;

		if (isAbsolute) {
			const worldCenterX = gameActions.getWorldCenter().x;
			const worldCenterY = gameActions.getWorldCenter().y;
			return gameActions.moveCharacterToWorldPosition(
				characterId,
				worldCenterX + offsetX,
				worldCenterY + offsetY,
			);
		}
		return gameActions.moveCharacterRelative(characterId, offsetX, offsetY);
	}

	default:
		console.warn(`[execute-action] Unknown actionId: "${action.actionId}"`);
		return Promise.resolve();
	}
}
