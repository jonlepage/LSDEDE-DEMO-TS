/**
 * Shared scene setup — registers player movement with collision,
 * camera follow, and click-to-move input handler.
 */

import type { Application, Container } from "pixi.js";
import {
  setMovementTarget,
  registerMovementTicker,
} from "../../renderer/movement";
import { createCollidable, resolveCollisions } from "../../renderer/collision";
import {
  setCameraFollowTarget,
  enableDepthSorting,
} from "../../renderer/camera";
import type { CameraState } from "../../renderer/camera";
import type { CollidableSprite } from "../../renderer/collision";
import type { CharacterReference } from "../../game/game-actions";
import type { SceneContext } from "../../shared/scene-context";

export interface SetupPlayerMovementOptions {
  readonly pixiApplication: Application;
  readonly cameraState: CameraState;
  readonly worldContainer: Container;
  readonly playerReference: CharacterReference;
  readonly npcObstacles: ReadonlyArray<CollidableSprite>;
  readonly sceneContext: SceneContext;
}

export interface PlayerMovementHandle {
  readonly movePlayerTo: (worldX: number, worldY: number) => void;
}

export function setupPlayerMovement(
  options: SetupPlayerMovementOptions,
): PlayerMovementHandle {
  const {
    pixiApplication,
    cameraState,
    worldContainer,
    playerReference,
    npcObstacles,
    sceneContext,
  } = options;

  const playerCollidable = createCollidable(playerReference.sprite);

  const unregisterMovement = registerMovementTicker(
    pixiApplication,
    playerReference.sprite,
    playerReference.movementState,
    (proposedX: number, proposedY: number) =>
      resolveCollisions(
        playerCollidable,
        proposedX,
        proposedY,
        npcObstacles as CollidableSprite[],
      ),
  );
  sceneContext.addDisposable(unregisterMovement);

  setCameraFollowTarget(cameraState, playerReference.sprite);
  enableDepthSorting(cameraState);

  const onPointerDown = (event: { global: { x: number; y: number } }) => {
    const worldPosition = worldContainer.toLocal(event.global);
    setMovementTarget(
      playerReference.movementState,
      worldPosition.x,
      worldPosition.y,
    );
  };

  pixiApplication.stage.eventMode = "static";
  pixiApplication.stage.hitArea = pixiApplication.screen;
  sceneContext.addStageListener(
    "pointerdown",
    onPointerDown as (...args: unknown[]) => void,
  );

  return {
    movePlayerTo: (worldX: number, worldY: number) => {
      setMovementTarget(playerReference.movementState, worldX, worldY);
    },
  };
}
