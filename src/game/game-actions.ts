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
import { setGameVariable, setGameSwitch, type GameStore } from "./game-store";

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
  moveCameraToPosition(worldX: number, worldY: number): Promise<void>;
  shakeCamera(intensity?: number, durationInSeconds?: number): void;
  zoomCamera(targetScale: number): Promise<void>;
  moveCharacterToPosition(
    characterId: string,
    worldX: number,
    worldY: number,
  ): void;
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
  setVariable(variableName: string, value: number): void;
  setSwitch(switchName: string, isEnabled: boolean): void;
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
    moveCameraToPosition(worldX: number, worldY: number): Promise<void> {
      return new Promise((resolve) => {
        moveCameraToPosition(cameraState, worldX, worldY, resolve);
      });
    },

    shakeCamera(intensity?: number, durationInSeconds?: number): void {
      shakeCamera(cameraState, intensity, durationInSeconds);
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
        character.sprite.y,
      );

      // Follow the character sprite each frame so the bubble moves with it.
      const followTicker = () => {
        if (!bubbleHandle.container.destroyed) {
          positionBubbleAboveTarget(
            bubbleHandle.container,
            character.sprite.x,
            character.sprite.y,
          );
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
      };
      pixiApplication.ticker.add(followTicker);

      return choiceBoxContainer;
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
  };
}
