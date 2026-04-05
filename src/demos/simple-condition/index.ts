/**
 * Demo: simple-condition
 * Two characters (l1, l4) in a scene that demonstrates CONDITION blocks.
 *
 * ---------------------------------------------------------------------------
 * KEY EDUCATIONAL POINT: Condition evaluation is YOUR responsibility.
 * ---------------------------------------------------------------------------
 * LSDE provides the condition data (key, operator, value) but does NOT evaluate
 * game state. The developer must:
 *   - Parse the condition key (e.g. "inventory.carrot") into a game state lookup
 *   - Compare the current value against the expected value using the operator
 *   - Call context.resolve(result) to tell the engine which port to follow
 *
 * In THIS demo, the condition checks: inventory.carrot >= 1
 *   - The key "inventory.carrot" maps to the game store's inventory dictionary
 *   - The operator ">=" and value "1" are compared against the item's quantity
 *   - If the player HAS a carrot → true port → l1 is happy
 *   - If the player does NOT → false port → l1 demands you find it
 *
 * The condition evaluator bridges LSDE dictionary keys to your game's data model.
 * A real game would have a single evaluator handling variables, switches, inventory,
 * quest flags, etc. — mapping every LSDE dictionary group to the right store.
 *
 * Use the debug panel "Add Carrot" / "Remove Carrot" buttons to change inventory
 * state between dialogue runs and observe the branching behavior.
 * ---------------------------------------------------------------------------
 */

import type { ConditionBlock } from "@lsde/dialog-engine";
import { LsdeUtils } from "@lsde/dialog-engine";
import type { CharacterReference } from "../../game/game-actions";
import type { BubbleTextHandle } from "../../renderer/ui/bubble-text";
import { GAME_ACTORS } from "../../game/game-store";
import { currentLanguage } from "../../engine/i18n";
import { LSDE_SCENES } from "../../../public/blueprints/blueprint.enums";
import {
	trackDialogueAdvanced,
	trackConditionEvaluated,
} from "../../analytics/posthog";
import { translate } from "../shared/translate";
import { evaluateGameCondition } from "../shared/evaluate-game-condition";
import { setupDialogueTrigger } from "../shared/setup-dialogue-trigger";
import type { DemoDependencies, SceneCleanup } from "../shared/types";
import { setupScene } from "../shared/setup-scene";
import { setupPickableCarrot } from "./setup-pickable-carrot";

const TRIGGER_NPC_CHARACTER_ID = GAME_ACTORS.l1;
const SCENE_UUID = LSDE_SCENES.simpleCondition;

export async function runScene(dependencies: DemoDependencies): Promise<SceneCleanup> {
	const { pixiApplication, dialogueEngine, worldContainer, cameraState } = dependencies;

	const screenCenterX = pixiApplication.screen.width / 2;
	const screenCenterY = pixiApplication.screen.height / 2;

	// --- Scene setup (characters, movement, debug panel) ---
	const {
		characters, playerReference, gameStore, gameActions,
		debugPanelState, sceneContext, cleanup,
	} = await setupScene({
		characterConfigurations: [
			{
				characterId: GAME_ACTORS.l1,
				displayName: GAME_ACTORS.l1,
				tintColor: 0xff6b6b,
				startX: screenCenterX - 100,
				startY: screenCenterY - 20,
			},
			{
				characterId: GAME_ACTORS.l4,
				displayName: GAME_ACTORS.l4,
				tintColor: 0x777777,
				startX: screenCenterX - 260,
				startY: screenCenterY + 40,
			},
		],
		triggerId: TRIGGER_NPC_CHARACTER_ID,
		pixiApplication,
		cameraState,
		worldContainer,
	});

	// --- Demo-specific: pickable carrot item + inventory debug buttons ---
	setupPickableCarrot({
		pixiApplication,
		worldContainer,
		playerReference,
		characters,
		sceneContext,
		gameActions,
		gameStore,
		debugPanelState,
		screenCenterX,
		screenCenterY,
	});

	// ---------------------------------------------------------------------------
	// Dialogue state
	// ---------------------------------------------------------------------------
	let currentBubbleHandle: BubbleTextHandle | null = null;
	let currentAdvanceFunction: (() => void) | null = null;

	function cleanupCurrentBubble(): void {
		if (currentBubbleHandle) {
			gameActions.removeBubbleFromWorld(currentBubbleHandle);
			currentBubbleHandle = null;
		}
	}

	// ---------------------------------------------------------------------------
	// Dialogue handlers
	// ---------------------------------------------------------------------------

	function startDialogueScene(): void {
		const sceneHandle = dialogueEngine.scene(SCENE_UUID);

		// --- DIALOG handler ---
		sceneHandle.onDialog(({ block, context, next }) => {
			const dialogueText = translate(block.dialogueText, currentLanguage);
			const characterId = context.character?.id ?? "";
			const characterName = context.character?.name ?? "???";

			currentAdvanceFunction = next;

			if (characters.has(characterId)) {
				currentBubbleHandle = gameActions.showBubbleOnCharacter(characterId, characterName, dialogueText);
			}

			return () => {
				cleanupCurrentBubble();
				currentAdvanceFunction = null;
			};
		});

		// --- CONDITION handler ---
		// This is the core of this demo. When LSDE dispatches a CONDITION block:
		//   1. We receive block.conditions[] — a 2D array of ExportCondition groups
		//   2. We evaluate each condition against our game state via evaluateGameCondition()
		//   3. We use LsdeUtils.evaluateConditionGroups() to handle AND/OR chaining + group logic
		//   4. We call context.resolve(result) to tell the engine which port to follow
		//   5. We call next() to advance the flow
		//
		// For a single condition group (our case): resolve(true) → true port, resolve(false) → false port.
		// For multiple groups (switch mode): resolve(matchingIndex) or resolve(-1) for default.
		sceneHandle.onCondition(({ block, context, next }) => {
			context.preventGlobalHandler();

			const conditionBlock = block as ConditionBlock;

			const result = LsdeUtils.evaluateConditionGroups(conditionBlock.conditions ?? [], (condition) => evaluateGameCondition(condition, gameActions), !!block.nativeProperties?.enableDispatcher);

			context.resolve(result);
			trackConditionEvaluated("simple-condition", block.uuid, result);
			next();
		});

		sceneHandle.onExit(() => {
			cleanupCurrentBubble();
			currentAdvanceFunction = null;
			dialogueTriggerHandle.resetTrigger();
		});

		sceneHandle.start();
	}

	function onPointerDownForDialogue(): void {
		if (!currentAdvanceFunction) return;

		if (currentBubbleHandle && !currentBubbleHandle.typewriterState.isComplete) {
			currentBubbleHandle.skipTypewriter();
		} else {
			trackDialogueAdvanced("simple-condition", "broadcast");
			currentAdvanceFunction();
		}
	}

	// ---------------------------------------------------------------------------
	// Wiring: connect dialogue trigger + pointer listener
	// ---------------------------------------------------------------------------
	const triggerNpcReference = characters.get(TRIGGER_NPC_CHARACTER_ID) as CharacterReference;

	const dialogueTriggerHandle = setupDialogueTrigger({
		playerReference,
		triggerNpcReference,
		sceneContext,
		onTrigger: startDialogueScene,
	});

	sceneContext.addStageListener("pointerdown", onPointerDownForDialogue as (...args: unknown[]) => void);

	return cleanup;
}
