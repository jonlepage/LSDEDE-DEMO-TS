/**
 * Demo: simple-dialog-flow
 * Four colored bunnies in a conversation scene.
 * Walk the player (white) to the red bunny and press Enter to trigger the dialogue.
 * LSDE engine plays the scene: bubbles appear on speaking characters, click to advance.
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
  trackSceneCompleted,
} from "../../analytics/posthog";

const PLAYER_CHARACTER_ID = GAME_ACTORS.l4;
const TRIGGER_NPC_CHARACTER_ID = GAME_ACTORS.l1;
const SCENE_UUID = LSDE_SCENES.simpleDialogFlow;

export interface SimpleDialogFlowDependencies {
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
  dependencies: SimpleDialogFlowDependencies,
): Promise<SceneCleanup> {
  const {
    pixiApplication,
    cameraState,
    worldContainer,
    dialogueEngine,
  } = dependencies;

  const sceneContext = createSceneContext(pixiApplication);
  const screenCenterX = pixiApplication.screen.width / 2;
  const screenCenterY = pixiApplication.screen.height / 2;

  // --- Characters ---
  const { characters, playerReference, npcObstacles } = await setupCharacters({
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

  // --- Dialogue state ---
  let isDialogueActive = false;
  let currentBubbleHandle: BubbleTextHandle | null = null;
  let currentAdvanceFunction: (() => void) | null = null;

  function startDialogueScene(): void {
    console.log("[simple-dialog-flow] Scene triggered!");

    const sceneHandle = dialogueEngine.scene(SCENE_UUID);

    sceneHandle.onDialog(({ block, context, next }) => {
      const dialogueText = block.dialogueText?.[currentLanguage] ?? "";
      const characterId = context.character?.id;
      const characterName = context.character?.name ?? "???";

      if (!dialogueText.trim()) {
        next();
        return;
      }

      trackDialogueShown("simple-dialog-flow", block.uuid, characterId);

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
      console.log("[simple-dialog-flow] Scene completed.");
    });

    sceneHandle.start();
  }

  // --- Dialogue trigger: proximity + Enter ---
  const triggerNpcReference = characters.get(
    TRIGGER_NPC_CHARACTER_ID,
  ) as CharacterReference;

  setupDialogueTrigger({
    playerReference,
    triggerNpcReference,
    sceneContext,
    onTrigger: startDialogueScene,
  });

  // --- Click: advance dialogue when active ---
  const onPointerDownForDialogue = () => {
    if (!isDialogueActive || !currentAdvanceFunction) return;

    if (
      currentBubbleHandle &&
      !currentBubbleHandle.typewriterState.isComplete
    ) {
      currentBubbleHandle.skipTypewriter();
    } else {
      trackDialogueAdvanced("simple-dialog-flow", "broadcast");
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
