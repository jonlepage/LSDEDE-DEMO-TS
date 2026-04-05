/**
 * Pickable carrot setup — creates a carrot sprite on the scene that the player
 * can walk up to and click to pick up. Also adds "Add Carrot" / "Remove Carrot"
 * debug buttons to the Tweakpane panel for manual inventory testing.
 */

import { Graphics, Sprite, Text } from "pixi.js";
import type { Application, Container } from "pixi.js";
import type { CharacterReference, GameActionFacade } from "../../game/game-actions";
import type { SceneContext } from "../../shared/scene-context";
import type { GameStore } from "../../game/game-store";
import { createMovementState } from "../../renderer/movement";
import { refreshGameStoreBindings, type DebugPanelState } from "../../debug/debug-panel";
import { trackItemPickedUp } from "../../analytics/posthog";

const CARROT_ID = "carrot";
const CARROT_PICKUP_DISTANCE = 60;

export interface SetupPickableCarrotOptions {
	readonly pixiApplication: Application;
	readonly worldContainer: Container;
	readonly playerReference: CharacterReference;
	readonly characters: Map<string, CharacterReference>;
	readonly sceneContext: SceneContext;
	readonly gameActions: GameActionFacade;
	readonly gameStore: GameStore;
	readonly debugPanelState: DebugPanelState;
	readonly screenCenterX: number;
	readonly screenCenterY: number;
}

export function setupPickableCarrot(options: SetupPickableCarrotOptions): void {
	const {
		pixiApplication, worldContainer, playerReference,
		characters, sceneContext, gameActions,
		gameStore, debugPanelState,
		screenCenterX, screenCenterY,
	} = options;

	// --- Inventory debug buttons ---
	refreshGameStoreBindings(debugPanelState, gameStore);

	const inventoryFolder = debugPanelState.pane.addFolder({
		title: "Inventory",
		expanded: true,
	});
	inventoryFolder.addButton({ title: "Add Carrot" }).on("click", () => {
		gameActions.addItem(CARROT_ID, "Carrot");
		refreshGameStoreBindings(debugPanelState, gameStore);
	});
	inventoryFolder.addButton({ title: "Remove Carrot" }).on("click", () => {
		gameActions.removeItem(CARROT_ID);
		refreshGameStoreBindings(debugPanelState, gameStore);
	});

	// --- Carrot sprite ---
	// Registered as a "character" so the facade can camera-target it.
	// Walking near it and clicking picks it up → adds to inventory.
	const carrotGraphics = new Graphics();
	carrotGraphics.rect(0, 0, 14, 22).fill(0xff8800);
	const carrotTexture = pixiApplication.renderer.generateTexture(carrotGraphics);
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

	// --- Pickup hint — shown only when the player is in range ---
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
		return Math.sqrt(deltaX * deltaX + deltaY * deltaY) < CARROT_PICKUP_DISTANCE;
	}

	sceneContext.addTickerCallback(() => {
		if (!carrotPickedUp) {
			pickupHint.visible = isPlayerNearCarrot();
		}
	});

	// --- Click on carrot while in range to pick it up ---
	carrotSprite.eventMode = "static";
	carrotSprite.cursor = "pointer";
	carrotSprite.on("pointerdown", () => {
		if (carrotPickedUp || !isPlayerNearCarrot()) return;
		carrotPickedUp = true;
		gameActions.addItem(CARROT_ID, "Carrot");
		refreshGameStoreBindings(debugPanelState, gameStore);
		trackItemPickedUp("simple-condition", CARROT_ID);
		characters.delete(CARROT_ID);
		carrotSprite.destroy({ children: true });
	});
}
