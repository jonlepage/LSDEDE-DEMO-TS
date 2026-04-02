/**
 * Shared scene setup — proximity detection + Enter key to trigger a callback.
 * Fires onTrigger when the player is within interaction distance of an NPC and presses Enter.
 */

import type { CharacterReference } from "../../game/game-actions";
import type { SceneContext } from "../../shared/scene-context";

const DEFAULT_INTERACTION_DISTANCE = 80;

export interface SetupDialogueTriggerOptions {
  readonly playerReference: CharacterReference;
  readonly triggerNpcReference: CharacterReference;
  readonly interactionDistance?: number;
  readonly sceneContext: SceneContext;
  readonly onTrigger: () => void;
}

export function setupDialogueTrigger(
  options: SetupDialogueTriggerOptions,
): void {
  const {
    playerReference,
    triggerNpcReference,
    interactionDistance = DEFAULT_INTERACTION_DISTANCE,
    sceneContext,
    onTrigger,
  } = options;

  let hasTriggered = false;

  function isPlayerNearTriggerNpc(): boolean {
    const deltaX = playerReference.sprite.x - triggerNpcReference.sprite.x;
    const deltaY = playerReference.sprite.y - triggerNpcReference.sprite.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY) < interactionDistance;
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !hasTriggered && isPlayerNearTriggerNpc()) {
      hasTriggered = true;
      onTrigger();
    }
  };

  window.addEventListener("keydown", onKeyDown);
  sceneContext.addDisposable(() =>
    window.removeEventListener("keydown", onKeyDown),
  );
}
