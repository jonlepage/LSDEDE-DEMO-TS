/**
 * Shared scene setup — proximity detection + Enter/click to trigger a callback.
 * Fires onTrigger when the player is within interaction distance of an NPC.
 * Returns a handle to re-arm the trigger after a scene completes.
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
	/** Custom hint text displayed above the trigger. Defaults to "👇 click me!" */
	readonly hintText?: string;
	/** Additional guard checked before showing the hint and allowing trigger. */
	readonly canTrigger?: () => boolean;
}

export interface DialogueTriggerHandle {
	/** Re-arms the trigger so the player can activate it again (e.g. after a scene ends). */
	readonly resetTrigger: () => void;
}

export function setupDialogueTrigger(
	options: SetupDialogueTriggerOptions,
): DialogueTriggerHandle {
	const {
		playerReference,
		triggerNpcReference,
		interactionDistance = DEFAULT_INTERACTION_DISTANCE,
		sceneContext,
		onTrigger,
		hintText = "👇 click me!",
		canTrigger,
	} = options;

	let hasTriggered = false;
	let interactionHint: Text | null = null;

	function createInteractionHint(): Text {
		const hint = new Text({
			text: hintText,
			style: { fontSize: 12, fill: "#ffffff" },
		});
		hint.anchor.set(0.5, 1);
		hint.position.set(0, -(triggerNpcReference.sprite.height / 2 + 4));
		triggerNpcReference.sprite.addChild(hint);
		return hint;
	}

	interactionHint = createInteractionHint();

	// When canTrigger is provided, toggle hint visibility each frame
	// based on proximity AND the external guard (e.g. !isDialogueActive).
	if (canTrigger) {
		interactionHint.visible = false;
		sceneContext.addTickerCallback(() => {
			if (interactionHint && !interactionHint.destroyed) {
				interactionHint.visible = !hasTriggered && isPlayerNearTriggerNpc() && canTrigger();
			}
		});
	}

	function isPlayerNearTriggerNpc(): boolean {
		const deltaX = playerReference.sprite.x - triggerNpcReference.sprite.x;
		const deltaY = playerReference.sprite.y - triggerNpcReference.sprite.y;
		return Math.sqrt(deltaX * deltaX + deltaY * deltaY) < interactionDistance;
	}

	function isAllowedToTrigger(): boolean {
		return !hasTriggered && isPlayerNearTriggerNpc() && (!canTrigger || canTrigger());
	}

	function trigger(): void {
		hasTriggered = true;
		if (interactionHint) {
			interactionHint.destroy();
			interactionHint = null;
		}
		onTrigger();
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === "Enter" && isAllowedToTrigger()) {
			trigger();
		}
	}
	function onClick() {
		if (isAllowedToTrigger()) {
			trigger();
		}
	}
	triggerNpcReference.sprite.eventMode = "static";
	triggerNpcReference.sprite.cursor = "pointer";
	triggerNpcReference.sprite.on("pointerdown", onClick);

	window.addEventListener("keydown", onKeyDown);
	sceneContext.addDisposable(() =>
		window.removeEventListener("keydown", onKeyDown),
	);
	sceneContext.addDisposable(() => {
		triggerNpcReference.sprite.off("pointerdown", onClick);
	});

	return {
		resetTrigger(): void {
			hasTriggered = false;
			if (!interactionHint) {
				interactionHint = createInteractionHint();
			}
		},
	};
}
