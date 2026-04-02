/**
 * Click-to-move system with easing.
 * Animates a sprite toward a target position using ease-out interpolation.
 * Integrates with PixiJS ticker for frame-independent movement.
 */

import type { Application, Sprite } from "pixi.js";

const DEFAULT_MOVEMENT_SPEED = 4;
const ARRIVAL_THRESHOLD = 2;

const HOP_MAX_HEIGHT = 5;
const HOP_DISTANCE_PER_STRIDE = 30;
const HOP_SPEED_FLOOR = 0.5;

export interface MovementTarget {
  targetX: number;
  targetY: number;
}

export interface MovementState {
  currentTarget: MovementTarget | null;
  movementSpeed: number;
  distanceSinceLastHop: number;
  hopProgress: number;
}

export function createMovementState(
  movementSpeed: number = DEFAULT_MOVEMENT_SPEED,
): MovementState {
  return {
    currentTarget: null,
    movementSpeed,
    distanceSinceLastHop: 0,
    hopProgress: -1,
  };
}

export function setMovementTarget(
  movementState: MovementState,
  targetX: number,
  targetY: number,
): void {
  movementState.currentTarget = { targetX, targetY };
}

export function clearMovementTarget(movementState: MovementState): void {
  movementState.currentTarget = null;
}

/**
 * Ease-out quadratic — fast start, smooth deceleration.
 */
function easeOutQuadratic(progressRatio: number): number {
  return 1 - (1 - progressRatio) * (1 - progressRatio);
}

/**
 * Compute the next position for one axis using ease-out interpolation.
 * Returns the new position, moving `speed * deltaTime` pixels max per frame,
 * with deceleration as the sprite approaches the target.
 */
function computeEasedStep(
  currentPosition: number,
  targetPosition: number,
  distanceRemaining: number,
  totalStepSize: number,
): number {
  if (distanceRemaining < ARRIVAL_THRESHOLD) return targetPosition;

  const directionSign = targetPosition > currentPosition ? 1 : -1;
  const axisDistance = Math.abs(targetPosition - currentPosition);
  const axisRatio = axisDistance / distanceRemaining;

  const proximityRatio = Math.min(distanceRemaining / 150, 1);
  const easedSpeed =
    easeOutQuadratic(proximityRatio) * totalStepSize * axisRatio;
  const clampedStep = Math.min(easedSpeed, axisDistance);

  return currentPosition + directionSign * clampedStep;
}

/**
 * Register the movement tick on the PixiJS application ticker.
 * Each frame, the sprite moves toward its target with easing.
 * The `onBeforeMove` callback can reject a position (e.g. collision).
 */
export function registerMovementTicker(
  pixiApplication: Application,
  characterSprite: Sprite,
  movementState: MovementState,
  onBeforeMove?: (
    proposedX: number,
    proposedY: number,
  ) => { allowedX: number; allowedY: number },
): () => void {
  const tickerCallback = (time: { deltaTime: number }) => {
    if (!movementState.currentTarget) {
      characterSprite.pivot.y = 0;
      return;
    }

    const { targetX, targetY } = movementState.currentTarget;
    const deltaX = targetX - characterSprite.x;
    const deltaY = targetY - characterSprite.y;
    const distanceRemaining = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distanceRemaining < ARRIVAL_THRESHOLD) {
      characterSprite.x = targetX;
      characterSprite.y = targetY;
      characterSprite.pivot.y = 0;
      movementState.distanceSinceLastHop = 0;
      movementState.hopProgress = -1;
      clearMovementTarget(movementState);
      return;
    }

    const totalStepSize = movementState.movementSpeed * time.deltaTime;

    const proposedX = computeEasedStep(
      characterSprite.x,
      targetX,
      distanceRemaining,
      totalStepSize,
    );
    const proposedY = computeEasedStep(
      characterSprite.y,
      targetY,
      distanceRemaining,
      totalStepSize,
    );

    const previousX = characterSprite.x;
    const previousY = characterSprite.y;

    if (onBeforeMove) {
      const corrected = onBeforeMove(proposedX, proposedY);
      characterSprite.x = corrected.allowedX;
      characterSprite.y = corrected.allowedY;
    } else {
      characterSprite.x = proposedX;
      characterSprite.y = proposedY;
    }

    const frameDeltaX = characterSprite.x - previousX;
    const frameDeltaY = characterSprite.y - previousY;
    const frameDistance = Math.sqrt(
      frameDeltaX * frameDeltaX + frameDeltaY * frameDeltaY,
    );

    if (frameDistance < HOP_SPEED_FLOOR) {
      characterSprite.pivot.y *= 0.85;
      if (characterSprite.pivot.y < 0.5) characterSprite.pivot.y = 0;
      movementState.hopProgress = -1;
    } else {
      movementState.distanceSinceLastHop += frameDistance;

      if (
        movementState.hopProgress < 0 &&
        movementState.distanceSinceLastHop >= HOP_DISTANCE_PER_STRIDE
      ) {
        movementState.hopProgress = 0;
        movementState.distanceSinceLastHop = 0;
      }

      if (movementState.hopProgress >= 0) {
        movementState.hopProgress += frameDistance / HOP_DISTANCE_PER_STRIDE;
        if (movementState.hopProgress >= 1) {
          movementState.hopProgress = -1;
          characterSprite.pivot.y = 0;
        } else {
          const arc =
            4 * movementState.hopProgress * (1 - movementState.hopProgress);
          characterSprite.pivot.y = arc * HOP_MAX_HEIGHT;
        }
      }
    }
  };

  pixiApplication.ticker.add(tickerCallback);

  return () => pixiApplication.ticker.remove(tickerCallback);
}
