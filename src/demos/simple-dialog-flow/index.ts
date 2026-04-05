/**
 * Demo: simple-dialog-flow
 * Four bunnies have a linear conversation. This scene demonstrates the basic
 * DIALOG block: each character speaks in turn, the player clicks to advance,
 * and the scene ends after the last line.
 * Walk to the red bunny and click to trigger.
 */

import type { BubbleTextHandle } from "../../renderer/ui/bubble-text";
import type { CharacterReference } from "../../game/game-actions";
import { GAME_ACTORS } from "../../game/game-store";
import { currentLanguage } from "../../engine/i18n";
import { LSDE_SCENES } from "../../../public/blueprints/blueprint.enums";
import { translate } from "../shared/translate";
import { setupDialogueTrigger } from "../shared/setup-dialogue-trigger";
import type { DemoDependencies, SceneCleanup } from "../shared/types";
import { setupScene } from "../shared/setup-scene";

const TRIGGER_NPC_CHARACTER_ID = GAME_ACTORS.l1;
const SCENE_UUID = LSDE_SCENES.simpleDialogFlow;

export async function runScene(
	dependencies: DemoDependencies,
): Promise<SceneCleanup> {
	const { pixiApplication, dialogueEngine } = dependencies;

	const screenCenterX = pixiApplication.screen.width / 2;
	const screenCenterY = pixiApplication.screen.height / 2;

	// --- Scene setup (characters, movement, debug panel) ---
	const { characters, playerReference, gameActions, sceneContext, cleanup } =
		await setupScene({
			characterConfigurations: [
				{
					characterId: GAME_ACTORS.l1,
					displayName: GAME_ACTORS.l1,
					tintColor: 0xff6b6b,
					startX: screenCenterX - 200,
					startY: screenCenterY - 60,
				},
				{
					characterId: GAME_ACTORS.l2,
					displayName: GAME_ACTORS.l2,
					tintColor: 0x4ecdc4,
					startX: screenCenterX - 50,
					startY: screenCenterY - 20,
				},
				{
					characterId: GAME_ACTORS.l3,
					displayName: GAME_ACTORS.l3,
					tintColor: 0xffe66d,
					startX: screenCenterX + 100,
					startY: screenCenterY + 20,
				},
				{
					characterId: GAME_ACTORS.l4,
					displayName: GAME_ACTORS.l4,
					tintColor: 0x666666,
					startX: screenCenterX,
					startY: screenCenterY + 80,
				},
			],
			triggerId: TRIGGER_NPC_CHARACTER_ID,
			pixiApplication,
			cameraState: dependencies.cameraState,
			worldContainer: dependencies.worldContainer,
		});

	// ---------------------------------------------------------------------------
	// Dialogue state usually linked to your game states machine ECS,Store, etc.
	// This architecture is suitable for a demo, but not for a real game.
	// no cleancode or SOLID, but it has the advantage of being straightforward and easy to understand.
	// ---------------------------------------------------------------------------
	let activeBubbleHandle: BubbleTextHandle | null = null;
	let advanceDialogue: (() => void) | null = null;

	function cleanupCurrentBubble(): void {
		if (activeBubbleHandle) {
			gameActions.removeBubbleFromWorld(activeBubbleHandle);
			activeBubbleHandle = null;
		}
	}

	function startDialogueScene(): void {
		const scene = dialogueEngine.scene(SCENE_UUID);

		scene.onDialog(({ block, context, next }) => {
			const dialogueText = translate(block.dialogueText, currentLanguage);
			const characterId = context.character?.id ?? "";
			const characterName = context.character?.name ?? "???";

			advanceDialogue = next;

			if ( characters.has(characterId) ) {
				activeBubbleHandle = gameActions.showBubbleOnCharacter(
					characterId,
					characterName,
					dialogueText,
				);
			}

			return function cleanup() {
				cleanupCurrentBubble();
				advanceDialogue = null;
			};
		});

		scene.onExit(() => {
			cleanupCurrentBubble();
			advanceDialogue = null;
		});

		scene.start();
	}

	function onPointerDownForDialogue(): void {
		if (!advanceDialogue) return;

		if (
			activeBubbleHandle &&
			!activeBubbleHandle.typewriterState.isComplete
		) {
			activeBubbleHandle.skipTypewriter();
		} else {
			advanceDialogue();
		}
	}

	// ---------------------------------------------------------------------------
	// Wiring: connect dialogue trigger + pointer listener
	// ---------------------------------------------------------------------------
	const triggerNpcReference = characters.get(
		TRIGGER_NPC_CHARACTER_ID,
	) as CharacterReference;

	setupDialogueTrigger({
		playerReference,
		triggerNpcReference,
		sceneContext,
		onTrigger: startDialogueScene,
	});

	sceneContext.addStageListener(
		"pointerdown",
		onPointerDownForDialogue,
	);

	return cleanup;
}
