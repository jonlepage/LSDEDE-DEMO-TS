/**
 * Game Action Facade — single entry point for all game actions.
 * LSDE action handlers, debug panel, and demos call this facade.
 * Never call camera, renderer, or game-store internals directly.
 */

import type { Application, Container, Sprite } from "pixi.js";
import type { CameraState } from "../renderer/camera";
import {
  moveCameraToPosition,
  shakeCamera,
  zoomCamera,
  FOLLOW_VERTICAL_OFFSET,
  pauseCameraFollow,
  resumeCameraFollow,
} from "../renderer/camera";
import { setMovementTarget, type MovementState } from "../renderer/movement";
import {
  playCharacterAnimation,
  type AnimationPresetName,
} from "../renderer/animations";
import {
  createBubbleText,
  positionBubbleAboveTarget,
  type BubbleTextHandle,
} from "../renderer/ui/bubble-text";
import {
  createChoiceBox,
  positionChoiceBoxAboveTarget,
  type ChoiceSelectedCallback,
  type ChoiceEntry,
} from "../renderer/ui/choice-box";
import {
  setGameVariable,
  getGameVariable,
  setGameSwitch,
  addItemToInventory,
  removeItemFromInventory,
  getInventoryItemQuantity,
  addPartyMember,
  isPartyMember,
  type GameStore,
} from "./game-store";

export interface CharacterReference {
  readonly characterId: string;
  readonly sprite: Sprite;
  readonly movementState: MovementState;
}

export interface GameActionFacadeDependencies {
  readonly pixiApplication: Application;
  readonly cameraState: CameraState;
  readonly worldContainer: Container;
  readonly gameStore: GameStore;
  readonly characters: Map<string, CharacterReference>;
}

export interface GameActionFacade {
  moveCameraToPosition(
    worldX: number,
    worldY: number,
    durationSeconds?: number,
  ): Promise<void>;
  moveCameraToCharacter(
    characterId: string,
    durationSeconds?: number,
  ): Promise<void>;
  shakeCamera(intensity?: number, durationInSeconds?: number): Promise<void>;
  zoomCamera(targetScale: number): Promise<void>;
  moveCharacterToPosition(
    characterId: string,
    worldX: number,
    worldY: number,
  ): void;
  moveCharacterRelative(
    characterId: string,
    offsetX: number,
    offsetY?: number,
  ): Promise<void>;
  jumpCharacter(characterId: string): void;
  playCharacterAnimation(
    characterId: string,
    presetName: AnimationPresetName,
  ): void;
  showBubbleOnCharacter(
    characterId: string,
    speakerName: string,
    dialogueText: string,
    speakerNameColor?: string,
  ): BubbleTextHandle;
  showChoicesOnCharacter(
    characterId: string,
    choices: ReadonlyArray<ChoiceEntry>,
    onChoiceSelected: ChoiceSelectedCallback,
  ): Container;
  removeBubbleFromWorld(bubbleHandle: BubbleTextHandle): void;
  getVariable(variableName: string): number;
  setVariable(variableName: string, value: number): void;
  setSwitch(switchName: string, isEnabled: boolean): void;
  addItem(itemId: string, displayName: string, quantity?: number): void;
  removeItem(itemId: string, quantity?: number): void;
  getItemQuantity(itemId: string): number;
  addToParty(characterId: string): void;
  isInParty(characterId: string): boolean;
}

export function createGameActionFacade(
  dependencies: GameActionFacadeDependencies,
): GameActionFacade {
  const {
    pixiApplication,
    cameraState,
    worldContainer,
    gameStore,
    characters,
  } = dependencies;

  function findCharacterOrThrow(characterId: string): CharacterReference {
    const character = characters.get(characterId);
    if (!character) {
      throw new Error(`Character "${characterId}" not found`);
    }
    return character;
  }

  return {
    moveCameraToPosition(
      worldX: number,
      worldY: number,
      durationSeconds?: number,
    ): Promise<void> {
      const savedFollowTarget = pauseCameraFollow(cameraState);
      return new Promise<void>((resolve) => {
        moveCameraToPosition(
          cameraState,
          worldX,
          worldY,
          () => resolve(),
          durationSeconds,
        );
      }).finally(() => {
        resumeCameraFollow(cameraState, savedFollowTarget);
      });
    },

    moveCameraToCharacter(
      characterId: string,
      durationSeconds?: number,
    ): Promise<void> {
      const character = findCharacterOrThrow(characterId);
      const savedFollowTarget = pauseCameraFollow(cameraState);
      return new Promise<void>((resolve) => {
        // Use the same vertical offset as follow mode so the character
        // appears at the same screen position whether commanded or followed.
        moveCameraToPosition(
          cameraState,
          character.sprite.x,
          character.sprite.y + FOLLOW_VERTICAL_OFFSET,
          () => resolve(),
          durationSeconds,
        );
      }).finally(() => {
        resumeCameraFollow(cameraState, savedFollowTarget);
      });
    },

    shakeCamera(intensity?: number, durationInSeconds?: number): Promise<void> {
      return new Promise((resolve) => {
        shakeCamera(cameraState, intensity, durationInSeconds, resolve);
      });
    },

    zoomCamera(targetScale: number): Promise<void> {
      return new Promise((resolve) => {
        zoomCamera(cameraState, targetScale, undefined, resolve);
      });
    },

    moveCharacterToPosition(
      characterId: string,
      worldX: number,
      worldY: number,
    ): void {
      const character = findCharacterOrThrow(characterId);
      setMovementTarget(character.movementState, worldX, worldY);
    },

    moveCharacterRelative(
      characterId: string,
      offsetX: number,
      offsetY: number = 0,
    ): Promise<void> {
      const character = findCharacterOrThrow(characterId);
      const destinationX = character.sprite.x + offsetX;
      const destinationY = character.sprite.y + offsetY;
      setMovementTarget(character.movementState, destinationX, destinationY);

      // Resolve when the character reaches the destination.
      return new Promise((resolve) => {
        const checkArrival = () => {
          if (!character.movementState.currentTarget) {
            pixiApplication.ticker.remove(checkArrival);
            resolve();
          }
        };
        pixiApplication.ticker.add(checkArrival);
      });
    },

    jumpCharacter(characterId: string): void {
      const character = findCharacterOrThrow(characterId);
      playCharacterAnimation(pixiApplication, character.sprite, "jump");
    },

    playCharacterAnimation(
      characterId: string,
      presetName: AnimationPresetName,
    ): void {
      const character = findCharacterOrThrow(characterId);
      playCharacterAnimation(pixiApplication, character.sprite, presetName);
    },

    showBubbleOnCharacter(
      characterId: string,
      speakerName: string,
      dialogueText: string,
      speakerNameColor?: string,
    ): BubbleTextHandle {
      const character = findCharacterOrThrow(characterId);
      const bubbleHandle = createBubbleText({
        pixiApplication,
        speakerName,
        dialogueText,
        speakerNameColor,
      });
      worldContainer.addChild(bubbleHandle.container);
      positionBubbleAboveTarget(
        bubbleHandle.container,
        character.sprite.x,
        character.sprite.y - character.sprite.height,
      );
      bubbleHandle.container.zIndex = character.sprite.y + 1;

      // Follow the character sprite each frame with easing so the bubble
      // lags slightly behind instead of snapping to the sprite instantly.
      const BUBBLE_FOLLOW_LERP = 0.15;
      let smoothedTargetX = character.sprite.x;
      let smoothedTargetY = character.sprite.y - character.sprite.height / 2;

      const followTicker = () => {
        if (!bubbleHandle.container.destroyed) {
          const spriteTargetX = character.sprite.x;
          const spriteTargetY =
            character.sprite.y - character.sprite.height / 2;
          smoothedTargetX +=
            (spriteTargetX - smoothedTargetX) * BUBBLE_FOLLOW_LERP;
          smoothedTargetY +=
            (spriteTargetY - smoothedTargetY) * BUBBLE_FOLLOW_LERP;
          positionBubbleAboveTarget(
            bubbleHandle.container,
            smoothedTargetX,
            smoothedTargetY,
          );
          bubbleHandle.container.zIndex = character.sprite.y + 1;
        }
      };
      pixiApplication.ticker.add(followTicker);

      // Wrap destroy to also remove the follow ticker.
      const originalDestroy = bubbleHandle.destroy;
      bubbleHandle.destroy = () => {
        pixiApplication.ticker.remove(followTicker);
        originalDestroy();
      };

      return bubbleHandle;
    },

    showChoicesOnCharacter(
      characterId: string,
      choices: ReadonlyArray<ChoiceEntry>,
      onChoiceSelected: ChoiceSelectedCallback,
    ): Container {
      const character = findCharacterOrThrow(characterId);
      const choiceBoxContainer = createChoiceBox({
        pixiApplication,
        choiceEntries: choices,
        onChoiceSelected,
      });
      worldContainer.addChild(choiceBoxContainer);
      positionChoiceBoxAboveTarget(
        choiceBoxContainer,
        character.sprite.x,
        character.sprite.y,
      );

      // Follow the character sprite each frame so the choice box moves with it.
      const followTicker = () => {
        if (choiceBoxContainer.destroyed) {
          pixiApplication.ticker.remove(followTicker);
          return;
        }
        positionChoiceBoxAboveTarget(
          choiceBoxContainer,
          character.sprite.x,
          character.sprite.y,
        );
        choiceBoxContainer.zIndex = character.sprite.y + 1;
      };
      pixiApplication.ticker.add(followTicker);

      return choiceBoxContainer;
    },

    getVariable(variableName: string): number {
      return getGameVariable(gameStore, variableName);
    },

    setVariable(variableName: string, value: number): void {
      setGameVariable(gameStore, variableName, value);
    },

    removeBubbleFromWorld(bubbleHandle: BubbleTextHandle): void {
      bubbleHandle.destroy();
    },

    setSwitch(switchName: string, isEnabled: boolean): void {
      setGameSwitch(gameStore, switchName, isEnabled);
    },

    addItem(itemId: string, displayName: string, quantity?: number): void {
      addItemToInventory(gameStore, itemId, displayName, quantity);
    },

    removeItem(itemId: string, quantity?: number): void {
      removeItemFromInventory(gameStore, itemId, quantity);
    },

    getItemQuantity(itemId: string): number {
      return getInventoryItemQuantity(gameStore, itemId);
    },

    addToParty(characterId: string): void {
      addPartyMember(gameStore, characterId);
    },

    isInParty(characterId: string): boolean {
      return isPartyMember(gameStore, characterId);
    },
  };
}
