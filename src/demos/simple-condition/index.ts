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

import { Graphics, Sprite, Text } from "pixi.js";
import type { Application, Container, FederatedPointerEvent } from "pixi.js";
import type {
  DialogueEngine,
  BlueprintExport,
  ConditionBlock,
} from "@lsde/dialog-engine";
import { LsdeUtils } from "@lsde/dialog-engine";
import { createSceneContext } from "../../shared/scene-context";
import { setupCharacters } from "../shared/setup-characters";
import { setupPlayerMovement } from "../shared/setup-player-movement";
import { setupDialogueTrigger } from "../shared/setup-dialogue-trigger";
import {
  createGameActionFacade,
  type CharacterReference,
  type GameActionFacade,
} from "../../game/game-actions";
import { createMovementState } from "../../renderer/movement";
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
import type { ExportCondition } from "../../../public/blueprints/blueprint.types";
import {
  trackDialogueShown,
  trackDialogueAdvanced,
  trackConditionEvaluated,
  trackItemPickedUp,
  trackSceneCompleted,
} from "../../analytics/posthog";

const PLAYER_CHARACTER_ID = GAME_ACTORS.l4;
const TRIGGER_NPC_CHARACTER_ID = GAME_ACTORS.l1;
const SCENE_UUID = LSDE_SCENES.simpleCondition;
const CARROT_ID = "carrot";
const CARROT_PICKUP_DISTANCE = 60;

export interface SimpleConditionDependencies {
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
// Condition evaluator — maps LSDE condition keys to game facade lookups.
// ---------------------------------------------------------------------------
// Each condition from the blueprint has: { key, operator, value }
//   - key:      a dot-separated path like "inventory.carrot" or "variables.score"
//   - operator: a comparison string like ">=", "==", "!="
//   - value:    the expected value as a string (always string in the export)
//
// The first segment of the key identifies the dictionary group (inventory,
// variables, switches). The second segment is the item/variable name.
// This is the bridge between LSDE's abstract conditions and your game's state.
// ---------------------------------------------------------------------------

function evaluateGameCondition(
  condition: ExportCondition,
  gameActions: GameActionFacade,
): boolean {
  const { key, operator, value } = condition;
  const dotIndex = key.indexOf(".");
  const dictionaryGroup = dotIndex !== -1 ? key.slice(0, dotIndex) : "";
  const itemKey = dotIndex !== -1 ? key.slice(dotIndex + 1) : key;

  let currentValue: number;
  switch (dictionaryGroup) {
    case "inventory":
      currentValue = gameActions.getItemQuantity(itemKey);
      break;
    default:
      // Fall back to game variables for any non-inventory key.
      currentValue = gameActions.getVariable(key);
      break;
  }

  const targetValue = Number(value);
  switch (operator) {
    case ">=":
      return currentValue >= targetValue;
    case "<=":
      return currentValue <= targetValue;
    case ">":
      return currentValue > targetValue;
    case "<":
      return currentValue < targetValue;
    case "==":
      return currentValue === targetValue;
    case "!=":
      return currentValue !== targetValue;
    default:
      console.warn(
        `[simple-condition] Unknown operator: "${operator}" in condition key "${key}"`,
      );
      return false;
  }
}

export async function runScene(
  dependencies: SimpleConditionDependencies,
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

  // --- Characters: l1 (NPC) + l4 (player) ---
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

  // --- Inventory debug buttons ---
  const inventoryFolder = debugPanelState.pane.addFolder({
    title: "Inventory",
    expanded: true,
  });
  const inventoryMonitor = { carrot: 0 };
  inventoryFolder.addBinding(inventoryMonitor, "carrot", { readonly: true });
  inventoryFolder.addButton({ title: "Add Carrot" }).on("click", () => {
    gameActions.addItem(CARROT_ID, "Carrot");
    inventoryMonitor.carrot = gameActions.getItemQuantity(CARROT_ID);
  });
  inventoryFolder.addButton({ title: "Remove Carrot" }).on("click", () => {
    gameActions.removeItem(CARROT_ID);
    inventoryMonitor.carrot = gameActions.getItemQuantity(CARROT_ID);
  });

  sceneContext.addDisposable(() => debugPanelState.pane.dispose());

  // --- Carrot item: a pickable orange rectangle on the scene ---
  // The carrot is registered as a "character" so the facade can camera-target it.
  // Walking near it and clicking picks it up → adds to inventory.
  const carrotGraphics = new Graphics();
  carrotGraphics.rect(0, 0, 14, 22).fill(0xff8800);
  const carrotTexture =
    pixiApplication.renderer.generateTexture(carrotGraphics);
  carrotGraphics.destroy();

  const carrotSprite = new Sprite(carrotTexture);
  carrotSprite.anchor.set(0.5, 1);
  carrotSprite.position.set(screenCenterX + 200, screenCenterY + 10);
  carrotSprite.scale.set(2);
  carrotSprite.label = CARROT_ID;
  sceneContext.addSprite(carrotSprite, worldContainer);

  const carrotReference: CharacterReference = {
    characterId: CARROT_ID,
    sprite: carrotSprite,
    movementState: createMovementState(0),
  };
  characters.set(CARROT_ID, carrotReference);

  // Pickup hint — shown only when the player is in range.
  const pickupHint = new Text({
    text: "🥕 pick up!",
    style: { fontSize: 12, fill: "#ffffff" },
  });
  pickupHint.anchor.set(0.5, 1);
  pickupHint.position.set(0, -(carrotSprite.height / 2 + 4));
  pickupHint.visible = false;
  carrotSprite.addChild(pickupHint);

  let carrotPickedUp = false;

  function isPlayerNearCarrot(): boolean {
    const deltaX = playerReference.sprite.x - carrotSprite.x;
    const deltaY = playerReference.sprite.y - carrotSprite.y;
    return (
      Math.sqrt(deltaX * deltaX + deltaY * deltaY) < CARROT_PICKUP_DISTANCE
    );
  }

  // Show/hide hint based on proximity each frame.
  sceneContext.addTickerCallback(() => {
    if (!carrotPickedUp) {
      pickupHint.visible = isPlayerNearCarrot();
    }
  });

  // Click on carrot while in range to pick it up.
  carrotSprite.eventMode = "static";
  carrotSprite.cursor = "pointer";
  carrotSprite.on("pointerdown", (event: FederatedPointerEvent) => {
    event.stopPropagation();
    if (carrotPickedUp || !isPlayerNearCarrot()) return;
    carrotPickedUp = true;
    gameActions.addItem(CARROT_ID, "Carrot");
    inventoryMonitor.carrot = gameActions.getItemQuantity(CARROT_ID);
    trackItemPickedUp("simple-condition", CARROT_ID);
    characters.delete(CARROT_ID);
    carrotSprite.destroy({ children: true });
    console.log(
      "[simple-condition] Carrot picked up! inventory.carrot =",
      inventoryMonitor.carrot,
    );
  });

  // --- Dialogue state ---
  let isDialogueActive = false;
  let currentBubbleHandle: BubbleTextHandle | null = null;
  let currentAdvanceFunction: (() => void) | null = null;

  function startDialogueScene(): void {
    console.log("[simple-condition] Scene triggered!");

    const sceneHandle = dialogueEngine.scene(SCENE_UUID);

    // --- DIALOG handler ---
    sceneHandle.onDialog(({ block, context, next }) => {
      const dialogueText = block.dialogueText?.[currentLanguage] ?? "";
      const characterId = context.character?.id;
      const characterName = context.character?.name ?? "???";

      if (!dialogueText.trim()) {
        next();
        return;
      }

      isDialogueActive = true;
      currentAdvanceFunction = next;

      trackDialogueShown("simple-condition", block.uuid, characterId);

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

      const result = LsdeUtils.evaluateConditionGroups(
        conditionBlock.conditions ?? [],
        (condition) => evaluateGameCondition(condition, gameActions),
        !!block.nativeProperties?.enableDispatcher,
      );

      console.log(
        `[CONDITION] ${conditionBlock.label}: evaluated →`,
        result,
        `(inventory.carrot = ${gameActions.getItemQuantity("carrot")})`,
      );

      context.resolve(result);
      trackConditionEvaluated("simple-condition", block.uuid, result);
      next();
    });

    sceneHandle.onExit(() => {
      isDialogueActive = false;
      currentAdvanceFunction = null;
      currentBubbleHandle = null;
      dialogueTriggerHandle.resetTrigger();
      trackSceneCompleted("simple-condition");
      console.log("[simple-condition] Scene completed.");
    });

    sceneHandle.start();
  }

  // --- Dialogue trigger ---
  const triggerNpcReference = characters.get(
    TRIGGER_NPC_CHARACTER_ID,
  ) as CharacterReference;

  const dialogueTriggerHandle = setupDialogueTrigger({
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
      trackDialogueAdvanced("simple-condition", "broadcast");
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
