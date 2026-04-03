/**
 * Demo: condition-dispatch
 * Three party NPCs (l1, l2, l3) + player (l4).
 * Demonstrates the CONDITION enableDispatcher mode and two new gameplay mechanics.
 *
 * ---------------------------------------------------------------------------
 * NEW MECHANICS
 * ---------------------------------------------------------------------------
 * 1. Party recruitment — player walks near each NPC and clicks to add them
 *    to the party (stored in gameStore.party). Once recruited, the NPC's
 *    recruit hint disappears and the follow system kicks in.
 *
 * 2. Party follow — a ticker each frame sets the movement target of every
 *    recruited party member to their assigned "slot" position behind the player.
 *    Slots form a V shape so members don't stack. This requires each NPC to
 *    have its own registerMovementTicker (unlike idle NPCs in other demos).
 *
 * ---------------------------------------------------------------------------
 * KEY EDUCATIONAL POINT: enableDispatcher mode
 * ---------------------------------------------------------------------------
 * CONDITION-001 has enableDispatcher: true. This changes evaluation behaviour:
 *   - ALL condition groups whose evaluator returns true fire simultaneously
 *     as independent async tracks.
 *   - The default port ALWAYS fires as the main continuation track.
 *   - context.resolve(matchingIndices[]) → multiple tracks fire in parallel.
 *   - Targets of dispatched ports MUST be async blocks (isAsync: true).
 *   - The staggered delay values create a "prayer chorus" timing effect.
 *
 * CONDITION-002 (single-group, OR chain) gates the dispatcher:
 * at least one member must be recruited before the ritual can proceed.
 *
 * Dialogue flow:
 *   Click big carrot → DIALOG-001 (l4) → CONDITION-002
 *     → false: DIALOG-002 (l1 warns you to recruit first)
 *     → true:  CONDITION-001 (dispatcher) simultaneously fires:
 *                case_0 (l1 in party) → DIALOG-003 (l1,  100ms delay)
 *                case_1 (l2 in party) → DIALOG-004 (l4*, 600ms delay)
 *                case_2 (l3 in party) → DIALOG-005 (l3, 1300ms delay)
 *                default              → DIALOG-006 (l4, 2000ms delay)
 *              * DIALOG-004 has no character in blueprint metadata — l4 fallback.
 *
 * All prayer dialogs use delay (pre-display wait) + blocksWaitingForInput
 * so a single broadcast click after DIALOG-006 appears clears everything.
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
import {
  createGameActionFacade,
  type CharacterReference,
  type GameActionFacade,
} from "../../game/game-actions";
import {
  registerMovementTicker,
  setMovementTarget,
} from "../../renderer/movement";
import type { BubbleTextHandle } from "../../renderer/ui/bubble-text";
import {
  createDebugPanel,
  registerLiveMonitorTicker,
  registerActionButtons,
} from "../../debug/debug-panel";
import { createGameStore, GAME_ACTORS } from "../../game/game-store";
import type { CameraState } from "../../renderer/camera";
import { LSDE_SCENES } from "../../../public/blueprints/blueprint.enums";
import type { ExportCondition } from "../../../public/blueprints/blueprint.types";

const PLAYER_CHARACTER_ID = GAME_ACTORS.l4;
const SCENE_UUID = LSDE_SCENES.conditionDispatch;
const PARTY_NPC_IDS = [GAME_ACTORS.l1, GAME_ACTORS.l2, GAME_ACTORS.l3] as const;
const PARTY_RECRUIT_DISTANCE = 80;
const BIG_CARROT_INTERACT_DISTANCE = 90;
// Minimum distance from slot before the follow target is refreshed.
// Prevents constant target spam when the member is already close.
const PARTY_FOLLOW_UPDATE_DISTANCE = 15;
// V-formation slots: each member trails the player from a fixed offset.
const PARTY_FOLLOW_OFFSETS: Record<
  string,
  { readonly x: number; readonly y: number }
> = {
  [GAME_ACTORS.l1]: { x: -40, y: 18 },
  [GAME_ACTORS.l2]: { x: -70, y: 0 },
  [GAME_ACTORS.l3]: { x: -40, y: -18 },
};

export interface ConditionDispatchDependencies {
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
// This demo adds the "party" dictionary group alongside the standard ones.
// Blueprint conditions use operator "=" (single equals) for boolean equality.
// ---------------------------------------------------------------------------

function evaluateGameCondition(
  condition: ExportCondition,
  gameActions: GameActionFacade,
): boolean {
  const { key, operator, value } = condition;
  const dotIndex = key.indexOf(".");
  const dictionaryGroup = dotIndex !== -1 ? key.slice(0, dotIndex) : "";
  const itemKey = dotIndex !== -1 ? key.slice(dotIndex + 1) : key;

  switch (dictionaryGroup) {
    case "party": {
      const isMember = gameActions.isInParty(itemKey);
      const expectedTrue = value === "true" || value === "1";
      switch (operator) {
        case "=":
        case "==":
          return isMember === expectedTrue;
        case "!=":
          return isMember !== expectedTrue;
        default:
          console.warn(
            `[condition-dispatch] Unknown party operator: "${operator}"`,
          );
          return false;
      }
    }
    case "inventory": {
      const currentValue = gameActions.getItemQuantity(itemKey);
      const targetValue = Number(value);
      switch (operator) {
        case "=":
        case "==":
          return currentValue === targetValue;
        case "!=":
          return currentValue !== targetValue;
        case ">=":
          return currentValue >= targetValue;
        case "<=":
          return currentValue <= targetValue;
        case ">":
          return currentValue > targetValue;
        case "<":
          return currentValue < targetValue;
        default:
          return false;
      }
    }
    default: {
      const currentValue = gameActions.getVariable(key);
      const targetValue = Number(value);
      switch (operator) {
        case "=":
        case "==":
          return currentValue === targetValue;
        case "!=":
          return currentValue !== targetValue;
        case ">=":
          return currentValue >= targetValue;
        case "<=":
          return currentValue <= targetValue;
        case ">":
          return currentValue > targetValue;
        case "<":
          return currentValue < targetValue;
        default:
          console.warn(
            `[condition-dispatch] Unknown operator: "${operator}" in key "${key}"`,
          );
          return false;
      }
    }
  }
}

export async function runScene(
  dependencies: ConditionDispatchDependencies,
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
  // l4 starts left; l1/l2/l3 scattered around the ritual carrot in the center.
  const { characters, playerReference, npcObstacles } = await setupCharacters({
    characterConfigurations: [
      {
        characterId: GAME_ACTORS.l1,
        displayName: GAME_ACTORS.l1,
        tintColor: 0xff4444,
        startX: screenCenterX - 560,
        startY: screenCenterY + 60,
      },
      {
        characterId: GAME_ACTORS.l2,
        displayName: GAME_ACTORS.l2,
        tintColor: 0xffcc00,
        startX: screenCenterX - 740,
        startY: screenCenterY + 20,
      },
      {
        characterId: GAME_ACTORS.l3,
        displayName: GAME_ACTORS.l3,
        tintColor: 0x4488ff,
        startX: screenCenterX + -850,
        startY: screenCenterY - 80,
      },
      {
        characterId: GAME_ACTORS.l4,
        displayName: GAME_ACTORS.l4,
        tintColor: 0x777777,
        startX: screenCenterX - 280,
        startY: screenCenterY + 20,
      },
    ],
    playerCharacterId: PLAYER_CHARACTER_ID,
    worldContainer,
    sceneContext,
  });

  // --- NPC movement tickers ---
  // Party members need their own ticker so setMovementTarget() actually moves them.
  // (The player gets its ticker via setupPlayerMovement.)
  for (const characterId of PARTY_NPC_IDS) {
    const characterRef = characters.get(characterId) as CharacterReference;
    const unregisterNpcMovement = registerMovementTicker(
      pixiApplication,
      characterRef.sprite,
      characterRef.movementState,
    );
    sceneContext.addDisposable(unregisterNpcMovement);
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

  // --- Game store + facade ---
  const gameStore = createGameStore();
  const gameActions = createGameActionFacade({
    pixiApplication,
    cameraState,
    worldContainer,
    gameStore,
    characters,
  });

  // --- Debug panel ---
  const debugPanelState = createDebugPanel();
  registerLiveMonitorTicker(debugPanelState, pixiApplication);
  registerActionButtons(debugPanelState, gameActions, GAME_ACTORS.l1);

  const partyMonitor = { l1: false, l2: false, l3: false };
  const partyFolder = debugPanelState.pane.addFolder({
    title: "Party",
    expanded: true,
  });
  partyFolder.addBinding(partyMonitor, "l1", { readonly: true });
  partyFolder.addBinding(partyMonitor, "l2", { readonly: true });
  partyFolder.addBinding(partyMonitor, "l3", { readonly: true });

  sceneContext.addDisposable(() => debugPanelState.pane.dispose());

  // --- Party follow ticker ---
  // Each frame, if a member is recruited and is farther than the threshold
  // from their slot, refresh their movement target.
  sceneContext.addTickerCallback(() => {
    for (const characterId of PARTY_NPC_IDS) {
      if (!gameActions.isInParty(characterId)) continue;
      const characterRef = characters.get(characterId) as CharacterReference;
      const offset = PARTY_FOLLOW_OFFSETS[characterId];
      const slotX = playerReference.sprite.x + offset.x;
      const slotY = playerReference.sprite.y + offset.y;
      const deltaX = slotX - characterRef.sprite.x;
      const deltaY = slotY - characterRef.sprite.y;
      if (
        Math.sqrt(deltaX * deltaX + deltaY * deltaY) >
        PARTY_FOLLOW_UPDATE_DISTANCE
      ) {
        setMovementTarget(characterRef.movementState, slotX, slotY);
      }
    }
  });

  // --- Big ritual carrot ---
  // Clicking it starts the dialogue. It stays in the scene permanently.
  const bigCarrotGraphics = new Graphics();
  bigCarrotGraphics.rect(0, 0, 18, 32).fill(0xff6600);
  const bigCarrotTexture =
    pixiApplication.renderer.generateTexture(bigCarrotGraphics);
  bigCarrotGraphics.destroy();

  const bigCarrotSprite = new Sprite(bigCarrotTexture);
  bigCarrotSprite.anchor.set(0.5, 1);
  bigCarrotSprite.position.set(screenCenterX, screenCenterY - 10);
  bigCarrotSprite.scale.set(3);
  sceneContext.addSprite(bigCarrotSprite, worldContainer);

  const carrotHint = new Text({
    text: "🥕 invoke!",
    style: { fontSize: 12, fill: "#ffcc00" },
  });
  carrotHint.anchor.set(0.5, 1);
  // Position in local space: above the top edge of the texture (height=32 local units).
  carrotHint.position.set(0, -(32 + 6));
  bigCarrotSprite.addChild(carrotHint);
  sceneContext.addDisposable(() => {
    if (!carrotHint.destroyed) carrotHint.destroy();
  });

  function isPlayerNearBigCarrot(): boolean {
    const deltaX = playerReference.sprite.x - bigCarrotSprite.x;
    const deltaY = playerReference.sprite.y - bigCarrotSprite.y;
    return (
      Math.sqrt(deltaX * deltaX + deltaY * deltaY) <
      BIG_CARROT_INTERACT_DISTANCE
    );
  }

  // Show hint only when player is in range and no dialogue is running.
  sceneContext.addTickerCallback(() => {
    if (!carrotHint.destroyed) {
      carrotHint.visible = !isDialogueActive && isPlayerNearBigCarrot();
    }
  });

  // --- Party recruitment ---
  // Walk near each NPC and click to add them to the party.
  // Recruited NPCs are removed from npcObstacles so the player isn't blocked
  // by their own followers, and they lose their collidable obstacle status.
  for (const characterId of PARTY_NPC_IDS) {
    const characterRef = characters.get(characterId) as CharacterReference;

    const recruitHint = new Text({
      text: "🐰 join!",
      style: { fontSize: 12, fill: "#ffffff" },
    });
    recruitHint.anchor.set(0.5, 1);
    recruitHint.position.set(0, -(characterRef.sprite.height / 2 + 4));
    recruitHint.visible = false;
    characterRef.sprite.addChild(recruitHint);

    // Show hint only when player is in range and NPC is not yet recruited.
    sceneContext.addTickerCallback(() => {
      if (gameActions.isInParty(characterId)) return;
      const deltaX = playerReference.sprite.x - characterRef.sprite.x;
      const deltaY = playerReference.sprite.y - characterRef.sprite.y;
      recruitHint.visible =
        Math.sqrt(deltaX * deltaX + deltaY * deltaY) < PARTY_RECRUIT_DISTANCE;
    });

    characterRef.sprite.eventMode = "static";
    characterRef.sprite.cursor = "pointer";
    characterRef.sprite.on("pointerdown", () => {
      if (gameActions.isInParty(characterId)) return;
      const deltaX = playerReference.sprite.x - characterRef.sprite.x;
      const deltaY = playerReference.sprite.y - characterRef.sprite.y;
      if (
        Math.sqrt(deltaX * deltaX + deltaY * deltaY) >= PARTY_RECRUIT_DISTANCE
      )
        return;

      gameActions.addToParty(characterId);

      // Remove from collision obstacles — followers shouldn't block the player.
      const obstacleIndex = npcObstacles.findIndex(
        (collidable) => collidable.sprite === characterRef.sprite,
      );
      if (obstacleIndex !== -1) npcObstacles.splice(obstacleIndex, 1);

      recruitHint.visible = false;
      recruitHint.destroy();
      partyMonitor[characterId] = true;
      console.log(`[condition-dispatch] ${characterId} joined the party!`);
    });
  }

  // --- Dialogue state ---
  let isDialogueActive = false;
  const activeBubbles = new Map<string, BubbleTextHandle>();
  const blocksWaitingForInput = new Map<string, () => void>();

  const locale = blueprintData.primaryLanguage ?? "fr";

  function startDialogueScene(): void {
    isDialogueActive = true;
    console.log("[condition-dispatch] Ritual started!");

    const sceneHandle = dialogueEngine.scene(SCENE_UUID);

    // --- DIALOG handler (multi-track + delay-aware) ---
    // delay: pre-display wait (timer before bubble appears).
    // All blocks — immediate or delayed — go into blocksWaitingForInput so a
    // single broadcast click after DIALOG-006 dismisses everything at once.
    sceneHandle.onDialog(({ block, context, next }) => {
      const dialogueText = block.dialogueText?.[locale] ?? "";
      // DIALOG-004 has no character in blueprint metadata; fall back to player.
      const characterId = context.character?.id ?? PLAYER_CHARACTER_ID;
      const characterName = context.character?.name ?? characterId;

      if (!dialogueText.trim()) {
        next();
        return;
      }

      const delayMs = block.nativeProperties?.delay ?? 0;
      const blockUuid = block.uuid;
      let delayTimer: ReturnType<typeof setTimeout> | null = null;

      const showAndQueue = () => {
        if (characters.has(characterId)) {
          const bubbleHandle = gameActions.showBubbleOnCharacter(
            characterId,
            characterName,
            dialogueText,
          );
          activeBubbles.set(blockUuid, bubbleHandle);
        }
        blocksWaitingForInput.set(blockUuid, next);
      };

      if (delayMs > 0) {
        delayTimer = setTimeout(showAndQueue, delayMs);
      } else {
        showAndQueue();
      }

      return () => {
        if (delayTimer) clearTimeout(delayTimer);
        blocksWaitingForInput.delete(blockUuid);
        const handle = activeBubbles.get(blockUuid);
        if (handle) {
          gameActions.removeBubbleFromWorld(handle);
          activeBubbles.delete(blockUuid);
        }
      };
    });

    // --- CONDITION handler ---
    // Evaluates party membership for CONDITION-002 (gate) and CONDITION-001 (dispatcher).
    // preventGlobalHandler() stops the global onCondition from resolving true by default.
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
        `(party: l1=${gameActions.isInParty(GAME_ACTORS.l1)}, l2=${gameActions.isInParty(GAME_ACTORS.l2)}, l3=${gameActions.isInParty(GAME_ACTORS.l3)})`,
      );

      context.resolve(result);
      next();
    });

    sceneHandle.onExit(() => {
      isDialogueActive = false;
      blocksWaitingForInput.clear();
      activeBubbles.clear();
      console.log("[condition-dispatch] Ritual completed.");
    });

    sceneHandle.start();
  }

  // Clicking the ritual carrot starts the scene (proximity + not already active).
  bigCarrotSprite.eventMode = "static";
  bigCarrotSprite.cursor = "pointer";
  bigCarrotSprite.on("pointerdown", (event: FederatedPointerEvent) => {
    event.stopPropagation();
    if (isDialogueActive || !isPlayerNearBigCarrot()) return;
    startDialogueScene();
  });

  // --- Broadcast click: advance all waiting dialogue blocks at once ---
  // First click skips all typewriters still animating.
  // Second click (or first if all complete) advances every waiting block.
  const onPointerDownForDialogue = () => {
    if (blocksWaitingForInput.size === 0) return;

    for (const blockUuid of blocksWaitingForInput.keys()) {
      const bubbleHandle = activeBubbles.get(blockUuid);
      if (bubbleHandle && !bubbleHandle.typewriterState.isComplete) {
        for (const uuid of blocksWaitingForInput.keys()) {
          activeBubbles.get(uuid)?.skipTypewriter();
        }
        return;
      }
    }

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
