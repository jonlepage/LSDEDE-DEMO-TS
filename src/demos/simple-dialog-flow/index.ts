import type { BubbleTextHandle } from "../../renderer/ui/bubble-text";
import { GAME_ACTORS } from "../../game/game-store";
import { currentLanguage } from "../../engine/i18n";
import { LSDE_SCENES } from "../../../public/blueprints/blueprint.enums";
import {
	trackDialogueShown,
	trackDialogueAdvanced,
	trackSceneCompleted,
} from "../../analytics/posthog";
import { translate } from "../shared/translate";
import type { DemoDependencies, SceneCleanup } from "../shared/types";
import { setupScene } from "../shared/setup-scene";

const TRIGGER_NPC_CHARACTER_ID = GAME_ACTORS.l1;
const SCENE_UUID = LSDE_SCENES.simpleDialogFlow;

export async function runScene( dependencies: DemoDependencies )
: Promise<SceneCleanup> {
	const { pixiApplication, cameraState, worldContainer, dialogueEngine } = dependencies;


	const SCREEN_CENTER_X = pixiApplication.screen.width / 2;
	const SCREEN_CENTER_Y = pixiApplication.screen.height / 2;
	const {
		characters, 
		gameActions,
		cleanup,
	} = await setupScene({
		characterConfigurations: [
			{
				characterId: GAME_ACTORS.l1,
				displayName: GAME_ACTORS.l1,
				tintColor: 0xff6b6b,
				startX: SCREEN_CENTER_X - 200,
				startY: SCREEN_CENTER_Y - 60,
			},
			{
				characterId: GAME_ACTORS.l2,
				displayName: GAME_ACTORS.l2,
				tintColor: 0x4ecdc4,
				startX: SCREEN_CENTER_X - 50,
				startY: SCREEN_CENTER_Y - 20,
			},
			{
				characterId: GAME_ACTORS.l3,
				displayName: GAME_ACTORS.l3,
				tintColor: 0xffe66d,
				startX: SCREEN_CENTER_X + 100,
				startY: SCREEN_CENTER_Y + 20,
			},
			{
				characterId: GAME_ACTORS.l4,
				displayName: GAME_ACTORS.l4,
				tintColor: 0x666666,
				startX: SCREEN_CENTER_X,
				startY: SCREEN_CENTER_Y + 80,
			},
		],
		triggerId: TRIGGER_NPC_CHARACTER_ID,
		cameraState,
		worldContainer,
		pixiApplication,
		startDialogueScene,
		onPointerDownForDialogue,
	});


	// --- Dialogue state ---
	let isDialogueActive = false;
	let currentBubbleHandle: BubbleTextHandle | null = null;
	let currentAdvanceFunction: (() => void) | null = null;

	return cleanup;

	function startDialogueScene(): void {
		const sceneHandle = dialogueEngine.scene(SCENE_UUID);

		sceneHandle.onDialog(({ block, context, next }) => {
			const dialogueText = translate(block.dialogueText, currentLanguage);
			const characterId = context.character?.id;
			const characterName = context.character?.name ?? "???";
	



			isDialogueActive = true;
			currentAdvanceFunction = next;

			if (characterId && characters.has(characterId)) {
				currentBubbleHandle = gameActions.showBubbleOnCharacter(
					characterId,
					characterName,
					dialogueText,
				);
			}

			return () => {
				if (currentBubbleHandle) {
					gameActions.removeBubbleFromWorld(currentBubbleHandle);
					currentBubbleHandle = null;
				}
				isDialogueActive = false;
				currentAdvanceFunction = null;
			};
		});

		sceneHandle.onExit(() => {
			isDialogueActive = false;
			currentAdvanceFunction = null;
			currentBubbleHandle = null;
			trackSceneCompleted("simple-dialog-flow");
		});

		sceneHandle.start();
	}


	// --- Click: advance dialogue when active ---
	function onPointerDownForDialogue() {
		if (!isDialogueActive || !currentAdvanceFunction) return;

		if (currentBubbleHandle &&
			!currentBubbleHandle.typewriterState.isComplete) {
			currentBubbleHandle.skipTypewriter();
		} else {
			trackDialogueAdvanced("simple-dialog-flow", "broadcast");
			currentAdvanceFunction();
		}
	}


}
