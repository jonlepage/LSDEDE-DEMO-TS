/**
 * Demo: simple-choices
 * Two bunnies face a dramatic choice. This scene demonstrates the CHOICE block:
 * l1 sets the stage, the player (l4) picks one of three moral options,
 * and the dialogue branches accordingly before converging to a shared ending.
 * Walk to the red bunny and click to trigger.
 */

import type { Application, Container } from "pixi.js";
import type { DialogueEngine, BlueprintExport } from "@lsde/dialog-engine";
import { createSceneContext } from "../../shared/scene-context";
import { setupCharacters } from "../shared/setup-characters";
import { setupPlayerMovement } from "../shared/setup-player-movement";
import { setupDialogueTrigger } from "../shared/setup-dialogue-trigger";
import {
  createGameActionFacade,
  type CharacterReference,
} from "../../game/game-actions";
import type { BubbleTextHandle } from "../../renderer/ui/bubble-text";
import {
  createDebugPanel,
  registerLiveMonitorTicker,
  registerActionButtons,
} from "../../debug/debug-panel";
import { createGameStore, GAME_ACTORS } from "../../game/game-store";
import type { CameraState } from "../../renderer/camera";
import { currentLanguage, setCurrentLanguage } from "../../engine/i18n";
import { LSDE_SCENES } from "../../../public/blueprints/blueprint.enums";
import {
  trackDialogueShown,
  trackDialogueAdvanced,
  trackChoicesPresented,
  trackChoiceSelected,
  trackSceneCompleted,
} from "../../analytics/posthog";
import { translate } from "../shared/translate";

const PLAYER_CHARACTER_ID = GAME_ACTORS.l4;
const TRIGGER_NPC_CHARACTER_ID = GAME_ACTORS.l1;
const SCENE_UUID = LSDE_SCENES.simpleChoices;

export interface SimpleChoicesDependencies {
  readonly pixiApplication: Application;
  readonly cameraState: CameraState;
  readonly worldContainer: Container;
  readonly dialogueEngine: DialogueEngine;
  readonly blueprintData: BlueprintExport;
}

export interface SceneCleanup {
  readonly teardown: () => void;
}

export async function runScene(
  dependencies: SimpleChoicesDependencies,
): Promise<SceneCleanup> {
  const { pixiApplication, cameraState, worldContainer, dialogueEngine } =
    dependencies;

  const sceneContext = createSceneContext(pixiApplication);
  const screenCenterX = pixiApplication.screen.width / 2;
  const screenCenterY = pixiApplication.screen.height / 2;

  // --- Characters: only l1 and l4 in this scene ---
  const { characters, playerReference, npcObstacles } = await setupCharacters({
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
    playerCharacterId: PLAYER_CHARACTER_ID,
    worldContainer,
    sceneContext,
  });

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
  registerActionButtons(debugPanelState, gameActions, TRIGGER_NPC_CHARACTER_ID);
  sceneContext.addDisposable(() => debugPanelState.pane.dispose());

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

  function startDialogueScene(): void {
    console.log("[simple-choices] Scene triggered!");

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

      trackDialogueShown("simple-choices", block.uuid, characterId);

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
        if (currentChoiceBoxContainer) {
          currentChoiceBoxContainer.destroy({ children: true });
          currentChoiceBoxContainer = null;
        }
      };
    });

    sceneHandle.onExit(() => {
      currentAdvanceFunction = null;
      currentBubbleHandle = null;
      currentChoiceBoxContainer = null;
      trackSceneCompleted("simple-choices");
      console.log("[simple-choices] Scene completed.");
    });

    sceneHandle.start();
  }

  // --- Dialogue trigger: proximity + click on NPC ---
  const triggerNpcReference = characters.get(
    TRIGGER_NPC_CHARACTER_ID,
  ) as CharacterReference;

  setupDialogueTrigger({
    playerReference,
    triggerNpcReference,
    sceneContext,
    onTrigger: startDialogueScene,
  });

  // --- Click: advance dialogue or skip typewriter ---
  //
  // This handler only fires for DIALOG blocks (not CHOICE blocks).
  // When a choice-box is on screen, the player interacts with it directly
  // via the choice buttons — no need to handle clicks here.
  const onPointerDownForDialogue = () => {
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
  };

  sceneContext.addStageListener(
    "pointerdown",
    onPointerDownForDialogue as (...args: unknown[]) => void,
  );

  return {
    teardown: () => {
      sceneContext.dispose();
      characters.clear();
    },
  };
}
