/**
 * Camera system — a Container that wraps the game world.
 * Moving the camera = translating the world container in the opposite direction.
 *
 * Two modes:
 *  1. Follow mode: gently tracks a target sprite (very subtle lerp).
 *  2. Command mode: move to an absolute position with easing (for future LSDE actions).
 */

import { Container } from "pixi.js";
import type { Application, Sprite } from "pixi.js";

const DEFAULT_FOLLOW_LERP_FACTOR = 0.003;
const COMMAND_EASING_SPEED = 0.03;
const COMMAND_ARRIVAL_THRESHOLD = 1;

/**
 * Dead zone: camera does not move at all when the target is within this radius (in pixels)
 * of the current camera center. Beyond the dead zone, follow strength ramps up progressively.
 */
const DEAD_ZONE_RADIUS = 120;
const FULL_FOLLOW_RADIUS = 400;

export interface CameraCommandTarget {
  targetX: number;
  targetY: number;
  onComplete?: () => void;
}

export interface CameraState {
  readonly worldContainer: Container;
  readonly pixiApplication: Application;
  followTarget: Sprite | null;
  followLerpFactor: number;
  commandTarget: CameraCommandTarget | null;
}

export function createCamera(pixiApplication: Application): CameraState {
  const worldContainer = new Container();
  worldContainer.label = "camera-world";
  pixiApplication.stage.addChild(worldContainer);

  const cameraState: CameraState = {
    worldContainer,
    pixiApplication,
    followTarget: null,
    followLerpFactor: DEFAULT_FOLLOW_LERP_FACTOR,
    commandTarget: null,
  };

  pixiApplication.ticker.add((time) => {
    updateCamera(cameraState, time.deltaTime);
  });

  pixiApplication.renderer.on("resize", () => {
    snapCameraToFollowTarget(cameraState);
  });

  return cameraState;
}

export function setCameraFollowTarget(
  cameraState: CameraState,
  targetSprite: Sprite,
  lerpFactor: number = DEFAULT_FOLLOW_LERP_FACTOR,
): void {
  cameraState.followTarget = targetSprite;
  cameraState.followLerpFactor = lerpFactor;
}

/**
 * Command the camera to move to an absolute world position.
 * While a command is active, follow mode is paused.
 * Intended for future LSDE action handlers (e.g. "move camera to X,Y").
 */
export function moveCameraToPosition(
  cameraState: CameraState,
  worldX: number,
  worldY: number,
  onComplete?: () => void,
): void {
  cameraState.commandTarget = {
    targetX: worldX,
    targetY: worldY,
    onComplete,
  };
}

export function cancelCameraCommand(cameraState: CameraState): void {
  cameraState.commandTarget = null;
}

function snapCameraToFollowTarget(cameraState: CameraState): void {
  if (!cameraState.followTarget) return;
  cameraState.worldContainer.pivot.set(
    cameraState.followTarget.x,
    cameraState.followTarget.y,
  );
  cameraState.worldContainer.position.set(
    cameraState.pixiApplication.screen.width / 2,
    cameraState.pixiApplication.screen.height / 2,
  );
}

function updateCamera(cameraState: CameraState, deltaTime: number): void {
  const halfViewportX = cameraState.pixiApplication.screen.width / 2;
  const halfViewportY = cameraState.pixiApplication.screen.height / 2;

  if (cameraState.commandTarget) {
    const { targetX, targetY, onComplete } = cameraState.commandTarget;
    const desiredPivotX = targetX;
    const desiredPivotY = targetY;

    const deltaX = desiredPivotX - cameraState.worldContainer.pivot.x;
    const deltaY = desiredPivotY - cameraState.worldContainer.pivot.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance < COMMAND_ARRIVAL_THRESHOLD) {
      cameraState.worldContainer.pivot.set(desiredPivotX, desiredPivotY);
      cameraState.commandTarget = null;
      onComplete?.();
    } else {
      const lerpAmount = 1 - Math.pow(1 - COMMAND_EASING_SPEED, deltaTime);
      cameraState.worldContainer.pivot.x += deltaX * lerpAmount;
      cameraState.worldContainer.pivot.y += deltaY * lerpAmount;
    }

    cameraState.worldContainer.position.set(halfViewportX, halfViewportY);
    return;
  }

  if (cameraState.followTarget) {
    const deltaX =
      cameraState.followTarget.x - cameraState.worldContainer.pivot.x;
    const deltaY =
      cameraState.followTarget.y - cameraState.worldContainer.pivot.y;
    const distanceFromCenter = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distanceFromCenter > DEAD_ZONE_RADIUS) {
      const progressiveFactor =
        Math.min(
          (distanceFromCenter - DEAD_ZONE_RADIUS) /
            (FULL_FOLLOW_RADIUS - DEAD_ZONE_RADIUS),
          1,
        ) * cameraState.followLerpFactor;

      const lerpAmount = 1 - Math.pow(1 - progressiveFactor, deltaTime);

      cameraState.worldContainer.pivot.x += deltaX * lerpAmount;
      cameraState.worldContainer.pivot.y += deltaY * lerpAmount;
    }

    cameraState.worldContainer.position.set(halfViewportX, halfViewportY);
  }
}
