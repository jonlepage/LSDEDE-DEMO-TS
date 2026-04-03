/**
 * Shared scene setup — proximity detection + Enter key to trigger a callback.
 * Fires onTrigger when the player is within interaction distance of an NPC and presses Enter.
 */

import { Text } from "pixi.js";
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

  const interactionHint = new Text({
    text: "👇 click me!",
    style: { fontSize: 12, fill: "#ffffff" },
  });
  interactionHint.anchor.set(0.5, 1);
  interactionHint.position.set(0, -(triggerNpcReference.sprite.height / 2 + 4));
  triggerNpcReference.sprite.addChild(interactionHint);

  function isPlayerNearTriggerNpc(): boolean {
    const deltaX = playerReference.sprite.x - triggerNpcReference.sprite.x;
    const deltaY = playerReference.sprite.y - triggerNpcReference.sprite.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY) < interactionDistance;
  }

  function trigger(): void {
    hasTriggered = true;
    interactionHint.destroy();
    onTrigger();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && !hasTriggered && isPlayerNearTriggerNpc()) {
      trigger();
    }
  }
  function onClick() {
    if (!hasTriggered && isPlayerNearTriggerNpc()) {
      trigger();
    }
  }
  triggerNpcReference.sprite.interactive = true;
  triggerNpcReference.sprite.cursor = "pointer";
  triggerNpcReference.sprite.onclick = onClick;

  window.addEventListener("keydown", onKeyDown);
  sceneContext.addDisposable(() =>
    window.removeEventListener("keydown", onKeyDown),
  );
  sceneContext.addDisposable(() => {
    triggerNpcReference.sprite.onclick = null;
  });
}
