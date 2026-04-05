import type { Application, Container } from "pixi.js";
import { createSceneContext } from "../../shared/scene-context";
import type { CharacterConfiguration } from "./setup-characters";
import { setupCharacters } from "./setup-characters";
import type { CameraState } from "../../renderer/camera";
import { createDebugPanel, registerLiveMonitorTicker, registerActionButtons } from "../../debug/debug-panel";
import { setCurrentLanguage } from "../../engine/i18n";
import type { CharacterReference } from "../../game/game-actions";
import { createGameActionFacade } from "../../game/game-actions";
import { GAME_ACTORS, createGameStore } from "../../game/game-store";
import { setupPlayerMovement } from "./setup-player-movement";
import { registerMovementTicker } from "../../renderer/movement";
import type { CollidableSprite } from "../../renderer/collision";
import type { SceneCleanup } from "./types";
interface SetupSceneParams {
	pixiApplication: Application;
	cameraState: CameraState;
	worldContainer: Container;
	triggerId: string;
	characterConfigurations: ReadonlyArray<CharacterConfiguration>;
	/** When true, registers a movement ticker for each NPC so moveCharacterRelative() works. */
	registerNpcMovementTickers?: boolean;
}

interface SetupSceneResult {
	characters: Map<string, CharacterReference>;
	playerReference: CharacterReference;
	npcObstacles: CollidableSprite[];
	sceneContext: ReturnType<typeof createSceneContext>;
	gameStore: ReturnType<typeof createGameStore>;
	gameActions: ReturnType<typeof createGameActionFacade>;
	debugPanelState: ReturnType<typeof createDebugPanel>;
	cleanup:SceneCleanup
}


const PLAYER_CHARACTER_ID = GAME_ACTORS.l4;

export async function setupScene(params: SetupSceneParams): Promise<SetupSceneResult> {
	const {
		pixiApplication,
		cameraState, worldContainer, triggerId, characterConfigurations,
		registerNpcMovementTickers = false,
	} = params;
	const sceneContext = createSceneContext(pixiApplication);

	// --- Characters ---
	const { characters, playerReference, npcObstacles } = await setupCharacters({
		characterConfigurations,
		playerCharacterId: PLAYER_CHARACTER_ID,
		worldContainer,
		sceneContext,
	});

	// --- NPC movement tickers (optional) ---
	// When enabled, each NPC gets a movement ticker so moveCharacterRelative() works.
	// Without this, setMovementTarget() sets a target but nothing processes it.
	if (registerNpcMovementTickers) {
		for (const [characterId, characterRef] of characters) {
			if (characterId !== PLAYER_CHARACTER_ID) {
				const unregisterNpcMovement = registerMovementTicker(
					pixiApplication,
					characterRef.sprite,
					characterRef.movementState,
				);
				sceneContext.addDisposable(unregisterNpcMovement);
			}
		}
	}

	// --- Player movement + collision + camera ---
	setupPlayerMovement({
		pixiApplication,
		cameraState,
		worldContainer,
		playerReference,
		npcObstacles,
		sceneContext,
	});

	// --- Facade + debug ---
	const gameStore = createGameStore();
	const gameActions = createGameActionFacade({
		pixiApplication,
		cameraState,
		worldContainer,
		gameStore,
		characters,
	});

	const debugPanelState = createDebugPanel({
		onLanguageChanged: setCurrentLanguage,
	});
	registerLiveMonitorTicker(debugPanelState, pixiApplication);
	registerActionButtons(debugPanelState, gameActions, triggerId);
	sceneContext.addDisposable(() => debugPanelState.pane.dispose());


	return {
		characters,
		playerReference,
		npcObstacles,
		gameStore,
		gameActions,
		debugPanelState,
		sceneContext,
		cleanup: {
			teardown: () => {
				sceneContext.dispose();
				characters.clear();
			},
		},

	};

}