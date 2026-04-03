/**
 * Demo: simple-action
 * Three characters (l1, l4, boss) in a dramatic encounter.
 * This scene demonstrates ACTION blocks — LSDE dispatches actions that the game
 * must execute: camera shake, camera movement, character movement, etc.
 *
 * ---------------------------------------------------------------------------
 * KEY EDUCATIONAL POINT: Action execution is a DESIGN DECISION.
 * ---------------------------------------------------------------------------
 * LSDE provides the action data (actionId + params). It does NOT execute them.
 * The developer decides:
 *   - WHAT each actionId maps to in the game engine
 *   - WHEN to call next() — immediately, or after the action completes
 *   - WHETHER to use promises, callbacks, or fire-and-forget
 *
 * In THIS demo, we chose a promise-based approach:
 *   - Each action returns a Promise that resolves when the effect is done
 *   - We await ALL action promises before calling context.resolve() + next()
 *   - This means the dialogue flow PAUSES until all actions finish
 *
 * Other valid approaches a developer could use:
 *   - Fire-and-forget: call next() immediately, actions run in background
 *   - Sequential: await actions one by one instead of Promise.all
 *   - Hybrid: some actions block, others don't (based on actionId)
 *
 * There is no "correct" answer — it depends on your game's pacing needs.
 * ---------------------------------------------------------------------------
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
import { registerMovementTicker } from "../../renderer/movement";
import {
  createDebugPanel,
  registerLiveMonitorTicker,
  registerActionButtons,
} from "../../debug/debug-panel";
import { createGameStore, GAME_ACTORS } from "../../game/game-store";
import type { CameraState } from "../../renderer/camera";
import { LSDE_SCENES } from "../../../public/blueprints/blueprint.enums";
import type { GameActionFacade } from "../../game/game-actions";
import { lsdeActionId } from "../../../public/blueprints/blueprint.types";

const PLAYER_CHARACTER_ID = GAME_ACTORS.l4;
const TRIGGER_NPC_CHARACTER_ID = GAME_ACTORS.l1;
const SCENE_UUID = LSDE_SCENES.simpleAction;

export interface SimpleActionDependencies {
  readonly pixiApplication: Application;
  readonly cameraState: CameraState;
  readonly worldContainer: Container;
  readonly dialogueEngine: DialogueEngine;
  readonly blueprintData: BlueprintExport;
}

export interface SceneCleanup {
  readonly teardown: () => void;
}

// ---------------------------------------------------------------------------
// Action executor — maps LSDE actionIds to game facade calls.
// ---------------------------------------------------------------------------
// Each action from the blueprint has: { actionId, params[] }
// The executor returns a Promise so the handler can await completion.
// This is the bridge between LSDE's abstract actions and your game's concrete API.
//
// If you add a new action signature in LSDE, you add a case here.
// The params array order matches the signature definition in your LSDE project.
// ---------------------------------------------------------------------------

interface BlueprintAction {
  readonly actionId: lsdeActionId;
  readonly params: readonly (string | number | boolean)[];
}

function executeAction(
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
      const characterId = action.params[0] as string;
      const offsetX = action.params[1] as number;
      const offsetY = (action.params[2] as number) ?? 0;
      return gameActions.moveCharacterRelative(characterId, offsetX, offsetY);
    }

    default:
      console.warn(`[simple-action] Unknown actionId: "${action.actionId}"`);
      return Promise.resolve();
  }
}

export async function runScene(
  dependencies: SimpleActionDependencies,
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

  // --- Characters: l1, l4 nearby + boss far away ---
  const { characters, playerReference, npcObstacles } = await setupCharacters({
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
      {
        characterId: GAME_ACTORS.boss,
        displayName: GAME_ACTORS.boss,
        tintColor: 0xf077,
        startX: screenCenterX + 600,
        startY: screenCenterY - 10,
        scale: 6,
      },
    ],
    playerCharacterId: PLAYER_CHARACTER_ID,
    worldContainer,
    sceneContext,
  });

  // --- NPC movement tickers ---
  // The player gets a movement ticker via setupPlayerMovement (with collision).
  // NPCs need their own ticker so moveCharacterRelative() actually moves them.
  // Without this, setMovementTarget() sets a target but nothing processes it.
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
  // Dialogue + action state — multi-track aware
  // ---------------------------------------------------------------------------
  //
  // This scene uses ACTION blocks that can fork the flow into parallel tracks
  // after a CHOICE (e.g. final_decision-AI → dialog branch + action + dialog).
  // We use the same Map-based pattern as multi-tracks to handle simultaneous
  // bubbles from different tracks.
  //
  //   activeBubbles           — all currently visible bubbles, keyed by block UUID
  //   blocksWaitingForInput   — blocks that need a click to advanceg
  //
  // A single click broadcasts to ALL waiting blocks at once ("press to continue").
  // ---------------------------------------------------------------------------

  const activeBubbles = new Map<string, BubbleTextHandle>();
  const blocksWaitingForInput = new Map<string, () => void>();
  let currentChoiceBoxContainer: Container | null = null;

  const locale = blueprintData.primaryLanguage ?? "fr";

  function startDialogueScene(): void {
    console.log("[simple-action] Scene triggered!");

    const sceneHandle = dialogueEngine.scene(SCENE_UUID);

    // --- DIALOG handler (multi-track aware) ---
    sceneHandle.onDialog(({ block, context, next }) => {
      const dialogueText = block.dialogueText?.[locale] ?? "";
      const characterId = context.character?.id;
      const characterName = context.character?.name ?? "???";

      if (!dialogueText.trim()) {
        next();
        return;
      }

      // Show the bubble regardless of track type.
      if (characterId && characters.has(characterId)) {
        const bubbleHandle = gameActions.showBubbleOnCharacter(
          characterId,
          characterName,
          dialogueText,
        );
        activeBubbles.set(block.uuid, bubbleHandle);
      }

      // Decide how to advance based on block properties:
      //   • isAsync + no waitInput → auto-advance (immediately or after timeout)
      //   • isAsync + waitInput    → joins the input queue, user click advances it
      //   • main track (not async) → always waits for user input
      const isAsyncBlock = block.nativeProperties?.isAsync === true;
      const timeoutMs = block.nativeProperties?.timeout;
      const needsUserInput =
        block.nativeProperties?.waitInput === true || !isAsyncBlock;

      if (needsUserInput) {
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
      if (timeoutMs && timeoutMs > 0) {
        setTimeout(() => next(), timeoutMs);
      } else {
        next();
      }

      const blockUuid = block.uuid;
      return () => {
        const handle = activeBubbles.get(blockUuid);
        if (handle) {
          gameActions.removeBubbleFromWorld(handle);
          activeBubbles.delete(blockUuid);
        }
      };
    });

    // --- CHOICE handler ---
    sceneHandle.onChoice(({ context, next }) => {
      // context.character may be undefined when the CHOICE block follows an
      // ACTION block — LSDE may not forward the character through non-DIALOG
      // blocks. Fall back to the player character so the choice box always
      // appears on-screen regardless of scene flow.
      const characterId = context.character?.id ?? PLAYER_CHARACTER_ID;

      const visibleChoices = context.choices.filter(
        (choice) => choice.visible !== false,
      );

      const choiceEntries = visibleChoices.map((choice) => ({
        choiceUuid: choice.uuid,
        text:
          choice.dialogueText?.[locale] ||
          choice.label ||
          (choice as unknown as { content?: string }).content ||
          choice.uuid,
      }));

      if (characterId && characters.has(characterId)) {
        currentChoiceBoxContainer = gameActions.showChoicesOnCharacter(
          characterId,
          choiceEntries,
          (selectedChoiceUuid: string) => {
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

    // --- ACTION handler ---
    //
    // This is the core of this demo. When LSDE dispatches an ACTION block:
    //   1. We receive block.actions[] — an array of ExportAction
    //   2. We execute each action via our executeAction() mapper
    //   3. We await ALL promises (actions run in parallel)
    //   4. We call context.resolve() to signal success → "then" port
    //   5. We call next() to advance the flow
    //
    // The key insight: next() is called AFTER all actions complete.
    // This means the dialogue flow PAUSES while camera moves, characters walk, etc.
    // If you wanted non-blocking actions, you'd call next() before awaiting.
    sceneHandle.onAction(({ block, context, next }) => {
      // CRITICAL: prevent the global onAction handler from firing.
      // Without this, the two-tier system runs BOTH handlers in sequence:
      //   1. This scene handler fires (starts async work, returns immediately)
      //   2. The global handler fires and calls context.resolve() + next() IMMEDIATELY
      // That causes the flow to advance before our promises resolve.
      context.preventGlobalHandler();

      console.log(`[ACTION] started: ${block.label}`, block.actions);

      const actionPromises = (block.actions ?? []).map((action) =>
        executeAction(action as BlueprintAction, gameActions),
      );

      Promise.all(actionPromises)
        .then(() => {
          console.log(`[ACTION] completed: ${block.label}, calling next()`);
          context.resolve();
        })
        .catch((error) => {
          console.error("[simple-action] Action failed:", error);
          context.reject(error);
        })
        .finally(() => next());
    });

    sceneHandle.onExit(() => {
      blocksWaitingForInput.clear();
      activeBubbles.clear();
      currentChoiceBoxContainer = null;
      console.log("[simple-action] Scene completed.");
    });

    sceneHandle.start();
  }

  // --- Dialogue trigger ---
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
  // Same pattern as multi-tracks: a single click advances every block in
  // blocksWaitingForInput at once. If any bubble's typewriter is still
  // animating, the first click skips all typewriters to full text.
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
    // Snapshot first, then clear, then call advance() — calling advance()
    // may synchronously dispatch new blocks that add fresh entries.
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
