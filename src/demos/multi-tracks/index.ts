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
import {
  trackDialogueShown,
  trackDialogueAdvanced,
  trackSceneCompleted,
} from "../../analytics/posthog";

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
        startX: screenCenterX - 5,
        startY: screenCenterY - 5,
      },
      {
        characterId: GAME_ACTORS.l3,
        displayName: GAME_ACTORS.l3,
        tintColor: 0xffe66d,
        startX: screenCenterX - 500,
        startY: screenCenterY - 33,
      },
      {
        characterId: GAME_ACTORS.l4,
        displayName: GAME_ACTORS.l4,
        tintColor: 0x666666,
        startX: screenCenterX - 444,
        startY: screenCenterY + 22,
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

  // Blocks waiting for user input to advance, keyed by block UUID.
  // A single click broadcasts to ALL entries: the main-track block AND every
  // async block with waitInput=true advance simultaneously.
  // This models "press to continue" — every track that needs acknowledgement
  // reacts to the same player interaction at once.
  const blocksWaitingForInput = new Map<string, () => void>();

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

      trackDialogueShown("multi-tracks", block.uuid, characterId);

      // --- Decide how to advance based on block properties ---
      //
      // Three cases determine when next() is called:
      //
      //   1. waitInput (any track)  → block joins the input queue, user click advances it
      //   2. async WITHOUT waitInput → auto-advance (immediately, or after timeout)
      //   3. main track (not async) → always waits for user input (implicit waitInput)
      //
      // waitInput is a passive flag — LSDE does not enforce it.
      // It tells the game: "this block needs a player interaction before proceeding",
      // even if it runs on an async track. This lets the narrative designer create
      // async bubbles that pause until the player acknowledges them.
      const isAsyncBlock = block.nativeProperties?.isAsync === true;
      const timeoutMs = block.nativeProperties?.timeout;
      const needsUserInput =
        block.nativeProperties?.waitInput === true || !isAsyncBlock;

      if (needsUserInput) {
        // This block waits for user click to advance.
        // If it also has a timeout, auto-advance after that duration
        // (the user can still click earlier to skip ahead).
        const blockUuid = block.uuid;
        blocksWaitingForInput.set(blockUuid, next);

        let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
        if (timeoutMs && timeoutMs > 0) {
          autoAdvanceTimer = setTimeout(() => {
            if (blocksWaitingForInput.delete(blockUuid)) {
              next();
            }
          }, timeoutMs);
        }

        return () => {
          if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
          blocksWaitingForInput.delete(blockUuid);
          const handle = activeBubbles.get(blockUuid);
          if (handle) {
            gameActions.removeBubbleFromWorld(handle);
            activeBubbles.delete(blockUuid);
          }
        };
      }

      // Async track without waitInput: auto-advance.
      // The bubble remains on screen until LSDE calls our cleanup.
      if (timeoutMs && timeoutMs > 0) {
        setTimeout(() => next(), timeoutMs);
      } else {
        next();
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
      };
    });

    sceneHandle.onExit(() => {
      // Scene complete — clear any remaining state.
      // LSDE cancels async tracks automatically on scene exit, but our
      // local references should be cleaned up for good measure.
      blocksWaitingForInput.clear();
      activeBubbles.clear();
      trackSceneCompleted("multi-tracks");
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

  // --- Click: broadcast advance to ALL blocks waiting for input ---
  //
  // A single click advances every block in blocksWaitingForInput at once:
  // the main-track block AND any async blocks with waitInput=true.
  // This is NOT a queue — it's a broadcast. All waiting tracks react
  // to the same player interaction simultaneously, which feels natural:
  // "press to continue" dismisses everything that was waiting.
  //
  // If any bubble's typewriter is still animating, the first click
  // skips all typewriters to full text. The second click advances.
  const onPointerDownForDialogue = () => {
    if (blocksWaitingForInput.size === 0) return;

    // First pass: if any waiting bubble is still typing, skip them all.
    for (const blockUuid of blocksWaitingForInput.keys()) {
      const bubbleHandle = activeBubbles.get(blockUuid);
      if (bubbleHandle && !bubbleHandle.typewriterState.isComplete) {
        for (const uuid of blocksWaitingForInput.keys()) {
          activeBubbles.get(uuid)?.skipTypewriter();
        }
        return;
      }
    }

    // Second pass: advance every waiting block at once.
    // Important: snapshot first, then clear, then call advance().
    // Calling advance() may synchronously dispatch the next blocks,
    // which would add new entries to blocksWaitingForInput.
    // If we clear() after advancing, we'd wipe those fresh entries.
    trackDialogueAdvanced("multi-tracks", "broadcast");
    const toAdvance = [...blocksWaitingForInput.values()];
    blocksWaitingForInput.clear();
    for (const advance of toAdvance) {
      advance();
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
