/**
 * Demo: simple-choices
 * Two bunnies face a dramatic choice. This scene demonstrates the CHOICE block:
 * l1 sets the stage, the player (l4) picks one of three moral options,
 * and the dialogue branches accordingly before converging to a shared ending.
 * Walk to the red bunny and click to trigger.
 */

import type { Container } from "pixi.js";
import type { CharacterReference } from "../../game/game-actions";
import type { BubbleTextHandle } from "../../renderer/ui/bubble-text";
import { GAME_ACTORS } from "../../game/game-store";
import { currentLanguage } from "../../engine/i18n";
import { LSDE_SCENES } from "../../../public/blueprints/blueprint.enums";
import {
	trackDialogueAdvanced,
	trackChoicesPresented,
	trackChoiceSelected,
} from "../../analytics/posthog";
import { translate } from "../shared/translate";
import { setupDialogueTrigger } from "../shared/setup-dialogue-trigger";
import type { DemoDependencies, SceneCleanup } from "../shared/types";
import { setupScene } from "../shared/setup-scene";

const TRIGGER_NPC_CHARACTER_ID = GAME_ACTORS.l1;
const SCENE_UUID = LSDE_SCENES.simpleChoices;

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
					startX: screenCenterX - 120,
					startY: screenCenterY - 30,
				},
				{
					characterId: GAME_ACTORS.l4,
					displayName: GAME_ACTORS.l4,
					tintColor: 0xffffff,
					startX: screenCenterX + 80,
					startY: screenCenterY + 40,
				},
			],
			triggerId: TRIGGER_NPC_CHARACTER_ID,
			pixiApplication,
			cameraState: dependencies.cameraState,
			worldContainer: dependencies.worldContainer,
		});

	// ---------------------------------------------------------------------------
	// Dialogue + choice state
	// ---------------------------------------------------------------------------
	//
	// This demo is linear (no parallel tracks), so a single bubble handle is fine.
	// The new element here is the CHOICE block: when the engine dispatches it,
	// we show a choice-box UI instead of a speech bubble. The player clicks an
	// option, we call context.selectChoice(uuid) + next(), and the engine follows
	// the matching branch.
	// ---------------------------------------------------------------------------

	let currentBubbleHandle: BubbleTextHandle | null = null;
	let currentAdvanceFunction: (() => void) | null = null;
	let currentChoiceBoxContainer: Container | null = null;

	// ---------------------------------------------------------------------------
	// Cleanup helpers
	// ---------------------------------------------------------------------------

	function cleanupCurrentBubble(): void {
		if (currentBubbleHandle) {
			gameActions.removeBubbleFromWorld(currentBubbleHandle);
			currentBubbleHandle = null;
		}
	}

	function cleanupCurrentChoiceBox(): void {
		if (currentChoiceBoxContainer) {
			currentChoiceBoxContainer.destroy({ children: true });
			currentChoiceBoxContainer = null;
		}
	}

	// ---------------------------------------------------------------------------
	// Dialogue handlers
	// ---------------------------------------------------------------------------

	function startDialogueScene(): void {
		const sceneHandle = dialogueEngine.scene(SCENE_UUID);

		// --- DIALOG handler: show speech bubble, wait for click to advance ---
		sceneHandle.onDialog(({ block, context, next }) => {
			const dialogueText = translate(block.dialogueText, currentLanguage);
			const characterId = context.character?.id;
			const characterName = context.character?.name ?? "???";

			if (!dialogueText.trim()) {
				next();
				return;
			}

			currentAdvanceFunction = next;


			if (characterId && characters.has(characterId)) {
				currentBubbleHandle = gameActions.showBubbleOnCharacter(
					characterId,
					characterName,
					dialogueText,
				);
			}

			return () => {
				cleanupCurrentBubble();
				currentAdvanceFunction = null;
			};
		});

		// --- CHOICE handler: show choice-box, player picks an option ---
		//
		// The engine provides context.choices — an array of RuntimeChoiceItem with
		// { choiceUuid, text, visible }. We filter to visible choices, display them
		// in a choice-box UI, and when the player clicks one:
		//   1. context.selectChoice(uuid) — tells LSDE which port to follow
		//   2. next() — advances the flow along the selected branch
		//
		// The cleanup function removes the choice-box when the block advances.
		sceneHandle.onChoice(({ context, next }) => {
			const characterId = context.character?.id;

			// Filter to visible choices only (invisible choices have visible === false)
			const visibleChoices = context.choices.filter(
				(choice) => choice.visible !== false,
			);

			trackChoicesPresented(
				"simple-choices",
				"choice-block",
				visibleChoices.length,
			);

			// RuntimeChoiceItem has dialogueText (localized map) and label.
			// Some blueprints only export "content" (raw text) without localized maps,
			// so we fall back through all available text sources.
			const choiceEntries = visibleChoices.map((choice) => ({
				choiceUuid: choice.uuid,
				text:
					choice.dialogueText?.[currentLanguage] ||
					choice.label ||
					(choice as unknown as { content?: string }).content ||
					choice.uuid,
			}));

			// Show the choice-box above the character who is presenting the choice
			if (characterId && characters.has(characterId)) {
				currentChoiceBoxContainer = gameActions.showChoicesOnCharacter(
					characterId,
					choiceEntries,
					(selectedChoiceUuid: string) => {
						// Tell LSDE which choice was picked — the engine follows the
						// connection whose fromPort matches this UUID.
						const choiceIndex = choiceEntries.findIndex(
							(entry) => entry.choiceUuid === selectedChoiceUuid,
						);
						trackChoiceSelected(
							"simple-choices",
							"choice-block",
							selectedChoiceUuid,
							choiceIndex,
						);
						context.selectChoice(selectedChoiceUuid);
						next();
					},
				);
			}

			return () => {
				cleanupCurrentChoiceBox();
			};
		});

		sceneHandle.onExit(() => {
			cleanupCurrentBubble();
			cleanupCurrentChoiceBox();
			currentAdvanceFunction = null;
		});

		sceneHandle.start();
	}

	// --- Click: advance dialogue or skip typewriter ---
	//
	// This handler only fires for DIALOG blocks (not CHOICE blocks).
	// When a choice-box is on screen, the player interacts with it directly
	// via the choice buttons — no need to handle clicks here.
	function onPointerDownForDialogue(): void {
		if (!currentAdvanceFunction) return;

		if (
			currentBubbleHandle &&
			!currentBubbleHandle.typewriterState.isComplete
		) {
			currentBubbleHandle.skipTypewriter();
		} else {
			trackDialogueAdvanced("simple-choices", "broadcast");
			currentAdvanceFunction();
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
		onPointerDownForDialogue as (...args: unknown[]) => void,
	);

	return cleanup;
}
