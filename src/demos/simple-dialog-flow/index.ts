/**
 * Demo: simple-dialog-flow
 * Four colored bunnies in a conversation scene.
 * Walk the player (white) to the red bunny and press Enter to trigger the dialogue.
 * LSDE engine plays the scene: bubbles appear on speaking characters, click to advance.
 */

import type { Application, Container } from "pixi.js";
import type { DialogueEngine, BlueprintExport } from "@lsde/dialog-engine";
import { createSceneContext } from "../../shared/scene-context";
import { createCharacterSprite } from "../../renderer/characters";
import {
  createMovementState,
  setMovementTarget,
  registerMovementTicker,
} from "../../renderer/movement";
import { createCollidable, resolveCollisions } from "../../renderer/collision";
import { setCameraFollowTarget } from "../../renderer/camera";
import type { CameraState } from "../../renderer/camera";
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
import { createGameStore } from "../../game/game-store";
import type { CollidableSprite } from "../../renderer/collision";

const PLAYER_CHARACTER_ID = "l4";
const TRIGGER_NPC_CHARACTER_ID = "l1";
const INTERACTION_DISTANCE = 80;

const CHARACTER_CONFIGURATIONS = [
  { characterId: "l1", displayName: "l1", tintColor: 0xff6b6b },
  { characterId: "l2", displayName: "l2", tintColor: 0x4ecdc4 },
  { characterId: "l3", displayName: "l3", tintColor: 0xffe66d },
  { characterId: "l4", displayName: "l4", tintColor: 0xffffff },
];

const SCENE_UUID = "268a4c3e-7693-4ce7-8d36-4b0fd2e4a052";

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
    blueprintData,
  } = dependencies;

  const sceneContext = createSceneContext(pixiApplication);
  const gameStore = createGameStore();
  const characters = new Map<string, CharacterReference>();

  const screenCenterX = pixiApplication.screen.width / 2;
  const screenCenterY = pixiApplication.screen.height / 2;

  const npcObstacles: CollidableSprite[] = [];

  for (
    let charIndex = 0;
    charIndex < CHARACTER_CONFIGURATIONS.length;
    charIndex++
  ) {
    const config = CHARACTER_CONFIGURATIONS[charIndex];
    const movementState = createMovementState();
    const isPlayer = config.characterId === PLAYER_CHARACTER_ID;

    const sprite = await createCharacterSprite({
      characterId: config.characterId,
      displayName: config.displayName,
      tintColor: config.tintColor,
      startX: isPlayer ? screenCenterX : screenCenterX - 200 + charIndex * 150,
      startY: isPlayer
        ? screenCenterY + 80
        : screenCenterY - 60 + charIndex * 40,
    });

    sceneContext.addSprite(sprite, worldContainer);
    characters.set(config.characterId, {
      characterId: config.characterId,
      sprite,
      movementState,
    });

    if (!isPlayer) {
      npcObstacles.push(createCollidable(sprite));
    }
  }

  const playerReference = characters.get(PLAYER_CHARACTER_ID)!;
  const triggerNpcReference = characters.get(TRIGGER_NPC_CHARACTER_ID)!;
  const playerCollidable = createCollidable(playerReference.sprite);

  const unregisterMovement = registerMovementTicker(
    pixiApplication,
    playerReference.sprite,
    playerReference.movementState,
    (proposedX: number, proposedY: number) =>
      resolveCollisions(playerCollidable, proposedX, proposedY, npcObstacles),
  );
  sceneContext.addDisposable(unregisterMovement);

  setCameraFollowTarget(cameraState, playerReference.sprite);

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

  // --- Dialogue state ---
  let isDialogueActive = false;
  let currentBubbleHandle: BubbleTextHandle | null = null;
  let currentAdvanceFunction: (() => void) | null = null;
  let isSceneTriggered = false;

  const locale = blueprintData.primaryLanguage ?? "fr";

  function isPlayerNearTriggerNpc(): boolean {
    const deltaX = playerReference.sprite.x - triggerNpcReference.sprite.x;
    const deltaY = playerReference.sprite.y - triggerNpcReference.sprite.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY) < INTERACTION_DISTANCE;
  }

  function startDialogueScene(): void {
    if (isSceneTriggered) return;
    isSceneTriggered = true;

    console.log("❤[simple-dialog-flow] Scene triggered!");

    const sceneHandle = dialogueEngine.scene(SCENE_UUID);

    sceneHandle.onDialog(({ block, context, next }) => {
      const dialogueText = block.dialogueText?.[locale] ?? "";
      const characterId = context.character?.id;
      const characterName = context.character?.name ?? "???";

      console.log(
        `[DIALOG] label=${block.label} char=${characterId ?? "none"} text="${dialogueText.slice(0, 40)}..."`,
      );

      if (!dialogueText.trim()) {
        console.log("[DIALOG] Empty text — auto-advancing");
        next();
        return;
      }

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
      isSceneTriggered = false;
      console.log("✅[simple-dialog-flow] Scene completed.");
    });

    sceneHandle.start();
  }

  // --- Input: click to move OR advance dialogue ---
  const onPointerDown = (event: { global: { x: number; y: number } }) => {
    if (isDialogueActive && currentAdvanceFunction) {
      if (
        currentBubbleHandle &&
        !currentBubbleHandle.typewriterState.isComplete
      ) {
        currentBubbleHandle.skipTypewriter();
      } else {
        currentAdvanceFunction();
      }
    } else if (!isSceneTriggered) {
      const worldPosition = worldContainer.toLocal(event.global);
      setMovementTarget(
        playerReference.movementState,
        worldPosition.x,
        worldPosition.y,
      );
    }
  };

  // --- Input: Enter key triggers dialogue when near NPC ---
  const onKeyDown = (event: KeyboardEvent) => {
    if (
      event.key === "Enter" &&
      !isSceneTriggered &&
      isPlayerNearTriggerNpc()
    ) {
      startDialogueScene();
    }
  };

  pixiApplication.stage.eventMode = "static";
  pixiApplication.stage.hitArea = pixiApplication.screen;
  sceneContext.addStageListener(
    "pointerdown",
    onPointerDown as (...args: unknown[]) => void,
  );

  window.addEventListener("keydown", onKeyDown);
  sceneContext.addDisposable(() =>
    window.removeEventListener("keydown", onKeyDown),
  );

  return {
    teardown: () => {
      sceneContext.dispose();
      characters.clear();
    },
  };
}
