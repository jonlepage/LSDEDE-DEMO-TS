/**
 * Demo: multi-tracks
 * Same four bunnies, but this scene demonstrates parallel dialogue tracks.
 * The entry block dispatches to multiple tracks simultaneously.
 * Walk to the red bunny and press Enter to trigger.
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
import { LSDE_SCENES } from "../../../public/blueprints/blueprint.enums";

const PLAYER_CHARACTER_ID = GAME_ACTORS.l4;
const TRIGGER_NPC_CHARACTER_ID = GAME_ACTORS.l1;
const SCENE_UUID = LSDE_SCENES.multiTracks;

export interface MultiTracksDependencies {
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
  dependencies: MultiTracksDependencies,
): Promise<SceneCleanup> {
  const {
    pixiApplication,
    cameraState,
    worldContainer,
    dialogueEngine,
    blueprintData,
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
        tintColor: 0xffffff,
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

  const debugPanelState = createDebugPanel();
  registerLiveMonitorTicker(debugPanelState, pixiApplication);
  registerActionButtons(debugPanelState, gameActions, TRIGGER_NPC_CHARACTER_ID);
  sceneContext.addDisposable(() => debugPanelState.pane.dispose());

  // ---------------------------------------------------------------------------
  // Dialogue state — multi-track aware
  // ---------------------------------------------------------------------------
  //
  // LSDE dispatches blocks on parallel tracks simultaneously. Unlike a simple
  // linear scene where one bubble is visible at a time, a multi-track scene
  // can have several bubbles on screen at once (one per active track).
  //
  // Key insight: the handler does NOT need to know which track a block belongs
  // to. It only needs to know whether the block expects user input or should
  // auto-advance. LSDE tells us via `block.nativeProperties`:
  //
  //   • isAsync = true  → parallel track, no user input needed
  //   • timeout = N     → auto-advance after N ms (applies to both async & main)
  //   • waitForBlocks   → LSDE handles this internally (defers dispatch)
  //
  // The handler's job: show the bubble, decide how to call next(), and return
  // a cleanup function that destroys THAT bubble when its track advances.
  // ---------------------------------------------------------------------------

  // All currently visible bubbles, keyed by block UUID.
  // Multiple bubbles can coexist when tracks run in parallel.
  const activeBubbles = new Map<string, BubbleTextHandle>();

  // Only the main-track (non-async) block listens for user input.
  // We store its advance function so the click handler can call it.
  let mainTrackAdvanceFunction: (() => void) | null = null;

  const locale = blueprintData.primaryLanguage ?? "fr";

  function startDialogueScene(): void {
    console.log("[multi-tracks] Scene triggered!");

    const sceneHandle = dialogueEngine.scene(SCENE_UUID);

    sceneHandle.onDialog(({ block, context, next }) => {
      const dialogueText = block.dialogueText?.[locale] ?? "";
      const characterId = context.character?.id;
      const characterName = context.character?.name ?? "???";

      if (!dialogueText.trim()) {
        next();
        return;
      }

      // --- Show the bubble regardless of track type ---
      if (characterId && characters.has(characterId)) {
        const bubbleHandle = gameActions.showBubbleOnCharacter(
          characterId,
          characterName,
          dialogueText,
        );
        activeBubbles.set(block.uuid, bubbleHandle);
      }

      // --- Decide how to advance based on block properties ---
      //
      // Async blocks run on a parallel track and never require user input.
      // If the block has a timeout, we wait that duration before advancing —
      // this keeps the bubble visible for the specified time.
      // If no timeout, we advance immediately (the bubble stays visible until
      // the engine calls our cleanup function when the track moves on).
      const isAsyncBlock = block.nativeProperties?.isAsync === true;
      const timeoutMs = block.nativeProperties?.timeout;

      if (isAsyncBlock) {
        // Async track: auto-advance. The bubble remains on screen until cleanup.
        if (timeoutMs && timeoutMs > 0) {
          setTimeout(() => next(), timeoutMs);
        } else {
          next();
        }
      } else {
        // Main track: wait for user click/tap to advance.
        // If the block has a timeout, auto-advance after that duration —
        // the user can still click earlier to skip ahead.
        mainTrackAdvanceFunction = next;

        if (timeoutMs && timeoutMs > 0) {
          const autoAdvanceTimer = setTimeout(() => {
            if (mainTrackAdvanceFunction === next) {
              mainTrackAdvanceFunction = null;
              next();
            }
          }, timeoutMs);

          // If the user clicks before timeout, cancel the timer.
          // We store the original next and wrap it below in click handler,
          // but we also need to clear the timer on cleanup.
          const originalCleanup = () => clearTimeout(autoAdvanceTimer);
          const blockUuid = block.uuid;

          return () => {
            originalCleanup();
            const handle = activeBubbles.get(blockUuid);
            if (handle) {
              gameActions.removeBubbleFromWorld(handle);
              activeBubbles.delete(blockUuid);
            }
            if (mainTrackAdvanceFunction === next) {
              mainTrackAdvanceFunction = null;
            }
          };
        }
      }

      // --- Cleanup: called by LSDE when THIS block's track advances ---
      //
      // Each block gets its own cleanup function. This is critical for
      // multi-track: when track A advances, only track A's bubble is removed.
      // Track B's bubble stays on screen undisturbed.
      const blockUuid = block.uuid;
      return () => {
        const handle = activeBubbles.get(blockUuid);
        if (handle) {
          gameActions.removeBubbleFromWorld(handle);
          activeBubbles.delete(blockUuid);
        }
        // Only clear the main-track advance if it's still ours
        if (mainTrackAdvanceFunction === next) {
          mainTrackAdvanceFunction = null;
        }
      };
    });

    sceneHandle.onExit(() => {
      // Scene complete — clear any remaining state.
      // LSDE cancels async tracks automatically on scene exit, but our
      // local references should be cleaned up for good measure.
      mainTrackAdvanceFunction = null;
      activeBubbles.clear();
      console.log("[multi-tracks] Scene completed.");
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

  // --- Click: advance main-track dialogue only ---
  //
  // In a multi-track scene, clicking only affects the main track.
  // Async tracks auto-advance on their own schedule (timeout or immediate).
  // This separation is what makes parallel dialogue feel natural: the player
  // controls the conversation pace while background chatter flows freely.
  const onPointerDownForDialogue = () => {
    if (!mainTrackAdvanceFunction) return;

    // Find the main-track bubble (the one whose next === mainTrackAdvanceFunction).
    // If the typewriter is still revealing text, skip to full text first.
    // On the next click, advance to the next block.
    for (const bubbleHandle of activeBubbles.values()) {
      if (!bubbleHandle.typewriterState.isComplete) {
        bubbleHandle.skipTypewriter();
        return;
      }
    }

    mainTrackAdvanceFunction();
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
