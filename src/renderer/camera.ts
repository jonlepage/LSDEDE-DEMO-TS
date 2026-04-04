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
// Command easing: fast enough that camera pans feel intentional (not sluggish).
// 0.1 → ~1s for 860px distance at 60fps, vs 0.03 which took ~4s.
const COMMAND_EASING_SPEED = 0.1;
const COMMAND_ARRIVAL_THRESHOLD = 2;
export const FOLLOW_VERTICAL_OFFSET = -120;

/**
 * Dead zone: camera does not move at all when the target is within this radius (in pixels)
 * of the current camera center. Beyond the dead zone, follow strength ramps up progressively.
 *
 * Both radii scale with the viewport's smallest dimension so the camera
 * keeps following correctly on narrow / mobile viewports.
 */
const DEAD_ZONE_RATIO = 0.11; // fraction of smallest viewport dimension
const FULL_FOLLOW_RATIO = 0.37; // fraction of smallest viewport dimension
const MIN_DEAD_ZONE = 30;
const MIN_FULL_FOLLOW = 100;

/** Reference viewport size for lerp scaling (1080p shortest dimension). */
const REFERENCE_VIEWPORT_SIZE = 1080;
/** Maximum lerp multiplier on very small screens. */
const MAX_LERP_MULTIPLIER = 16;

function computeDeadZoneRadius(application: Application): number {
  const shortest = Math.min(
    application.screen.width,
    application.screen.height,
  );
  return Math.max(shortest * DEAD_ZONE_RATIO, MIN_DEAD_ZONE);
}

function computeFullFollowRadius(application: Application): number {
  const shortest = Math.min(
    application.screen.width,
    application.screen.height,
  );
  return Math.max(shortest * FULL_FOLLOW_RATIO, MIN_FULL_FOLLOW);
}

/**
 * Returns a multiplier (≥ 1) that speeds up the follow lerp on smaller viewports.
 * On a 1080p screen → 1×. On a 375px mobile → ~2.9×.
 */
function computeFollowLerpMultiplier(application: Application): number {
  const shortest = Math.min(
    application.screen.width,
    application.screen.height,
  );
  return Math.min(
    REFERENCE_VIEWPORT_SIZE / Math.max(shortest, 1),
    MAX_LERP_MULTIPLIER,
  );
}

// ---------------------------------------------------------------------------
// Responsive base zoom — smaller viewports zoom out to show more of the scene
// ---------------------------------------------------------------------------

/** Below this viewport size (shortest dim), the camera starts zooming out. */
const ZOOM_REFERENCE_SIZE = 1080;
/** Minimum zoom scale on very small screens. */
const MIN_BASE_ZOOM = 0.8;

/**
 * Computes a scale factor ≤ 1 based on the viewport's shortest dimension.
 * On a 1080p+ screen → 1.0. On a 375px mobile → ~0.58.
 */
export function computeResponsiveBaseZoom(application: Application): number {
  const shortest = Math.min(
    application.screen.width,
    application.screen.height,
  );
  if (shortest >= ZOOM_REFERENCE_SIZE) return 1;
  return Math.max(shortest / ZOOM_REFERENCE_SIZE, MIN_BASE_ZOOM);
}

export interface CameraCommandTarget {
  targetX: number;
  targetY: number;
  // Start position — captured at call time for time-based interpolation.
  startX: number;
  startY: number;
  // Time-based mode: elapsed seconds + total duration.
  // duration = 0 → fall back to speed-based exponential easing.
  elapsed: number;
  duration: number;
  onComplete?: () => void;
}

export interface CameraShakeState {
  remainingDuration: number;
  intensity: number;
  onComplete?: () => void;
}

export interface CameraZoomTarget {
  targetScale: number;
  easingSpeed: number;
  onComplete?: () => void;
}

export interface CameraState {
  readonly worldContainer: Container;
  readonly pixiApplication: Application;
  followTarget: Sprite | null;
  followLerpFactor: number;
  commandTarget: CameraCommandTarget | null;
  shakeState: CameraShakeState | null;
  zoomTarget: CameraZoomTarget | null;
  depthSortingEnabled: boolean;
}

export function createCamera(pixiApplication: Application): CameraState {
  const worldContainer = new Container();
  worldContainer.label = "camera-world";
  worldContainer.sortableChildren = true;
  pixiApplication.stage.addChild(worldContainer);

  const cameraState: CameraState = {
    worldContainer,
    pixiApplication,
    followTarget: null,
    followLerpFactor: DEFAULT_FOLLOW_LERP_FACTOR,
    commandTarget: null,
    shakeState: null,
    zoomTarget: null,
    depthSortingEnabled: false,
  };

  // Apply responsive base zoom on creation.
  const initialBaseZoom = computeResponsiveBaseZoom(pixiApplication);
  worldContainer.scale.set(initialBaseZoom);

  pixiApplication.ticker.add((time) => {
    updateCamera(cameraState, time.deltaTime);
  });

  pixiApplication.renderer.on("resize", () => {
    // Update base zoom when viewport changes (sidebar collapse, window resize).
    if (!cameraState.zoomTarget) {
      const baseZoom = computeResponsiveBaseZoom(pixiApplication);
      worldContainer.scale.set(baseZoom);
    }
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
  snapCameraToFollowTarget(cameraState);
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
  durationSeconds?: number,
): void {
  cameraState.commandTarget = {
    targetX: worldX,
    targetY: worldY,
    startX: cameraState.worldContainer.pivot.x,
    startY: cameraState.worldContainer.pivot.y,
    elapsed: 0,
    duration: durationSeconds ?? 0,
    onComplete,
  };
}

/**
 * Temporarily disables camera follow — returns the saved follow target
 * so it can be restored via resumeCameraFollow() after a command finishes.
 * This prevents the follow lerp from fighting the camera command in progress.
 */
export function pauseCameraFollow(cameraState: CameraState): Sprite | null {
  const saved = cameraState.followTarget;
  cameraState.followTarget = null;
  return saved;
}

/**
 * Restores the follow target saved by pauseCameraFollow().
 * Does NOT snap — the follow lerp will catch up smoothly from the
 * camera's current position, which is already near the target anyway.
 */
export function resumeCameraFollow(
  cameraState: CameraState,
  savedTarget: Sprite | null,
): void {
  cameraState.followTarget = savedTarget;
}

export function cancelCameraCommand(cameraState: CameraState): void {
  cameraState.commandTarget = null;
}

export function resetCameraState(cameraState: CameraState): void {
  cameraState.followTarget = null;
  cameraState.followLerpFactor = DEFAULT_FOLLOW_LERP_FACTOR;
  cameraState.commandTarget = null;
  cameraState.shakeState = null;
  cameraState.zoomTarget = null;
  const baseZoom = computeResponsiveBaseZoom(cameraState.pixiApplication);
  cameraState.worldContainer.scale.set(baseZoom);
  cameraState.worldContainer.pivot.set(0, 0);
  cameraState.worldContainer.position.set(
    cameraState.pixiApplication.screen.width / 2,
    cameraState.pixiApplication.screen.height / 2,
  );
}

export function shakeCamera(
  cameraState: CameraState,
  intensity: number = 6,
  durationInSeconds: number = 0.4,
  onComplete?: () => void,
): void {
  cameraState.shakeState = {
    remainingDuration: durationInSeconds,
    intensity,
    onComplete,
  };
}

export function enableDepthSorting(cameraState: CameraState): void {
  cameraState.depthSortingEnabled = true;
}

export function zoomCamera(
  cameraState: CameraState,
  targetScale: number,
  easingSpeed: number = 0.04,
  onComplete?: () => void,
): void {
  // targetScale is a logical multiplier (1 = default view for this viewport).
  // Compose with the responsive base zoom so 1.5× means "1.5× of the adaptive zoom".
  const baseZoom = computeResponsiveBaseZoom(cameraState.pixiApplication);
  cameraState.zoomTarget = {
    targetScale: targetScale * baseZoom,
    easingSpeed,
    onComplete,
  };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function snapCameraToFollowTarget(cameraState: CameraState): void {
  if (!cameraState.followTarget) return;
  cameraState.worldContainer.pivot.set(
    cameraState.followTarget.x,
    cameraState.followTarget.y + FOLLOW_VERTICAL_OFFSET,
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
    const cmd = cameraState.commandTarget;

    if (cmd.duration > 0) {
      // Time-based mode: predictable duration, ease-in-out cubic.
      // Use this when the blueprint specifies a duration param.
      cmd.elapsed += deltaTime / 60;
      const progress = Math.min(cmd.elapsed / cmd.duration, 1);
      const eased = easeInOutCubic(progress);
      cameraState.worldContainer.pivot.x = lerp(cmd.startX, cmd.targetX, eased);
      cameraState.worldContainer.pivot.y = lerp(cmd.startY, cmd.targetY, eased);
      if (progress >= 1) {
        cameraState.commandTarget = null;
        cmd.onComplete?.();
      }
    } else {
      // Speed-based mode: exponential ease-out, no fixed duration.
      // Use this as the default when no duration is specified.
      const deltaX = cmd.targetX - cameraState.worldContainer.pivot.x;
      const deltaY = cmd.targetY - cameraState.worldContainer.pivot.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance < COMMAND_ARRIVAL_THRESHOLD) {
        cameraState.worldContainer.pivot.set(cmd.targetX, cmd.targetY);
        cameraState.commandTarget = null;
        cmd.onComplete?.();
      } else {
        const lerpAmount = 1 - Math.pow(1 - COMMAND_EASING_SPEED, deltaTime);
        cameraState.worldContainer.pivot.x += deltaX * lerpAmount;
        cameraState.worldContainer.pivot.y += deltaY * lerpAmount;
      }
    }

    cameraState.worldContainer.position.set(halfViewportX, halfViewportY);
    return;
  }

  if (cameraState.followTarget) {
    const deltaX =
      cameraState.followTarget.x - cameraState.worldContainer.pivot.x;
    const deltaY =
      cameraState.followTarget.y +
      FOLLOW_VERTICAL_OFFSET -
      cameraState.worldContainer.pivot.y;
    const distanceFromCenter = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    const deadZoneRadius = computeDeadZoneRadius(cameraState.pixiApplication);
    const fullFollowRadius = computeFullFollowRadius(
      cameraState.pixiApplication,
    );

    if (distanceFromCenter > deadZoneRadius) {
      const lerpMultiplier = computeFollowLerpMultiplier(
        cameraState.pixiApplication,
      );
      const progressiveFactor =
        Math.min(
          (distanceFromCenter - deadZoneRadius) /
            (fullFollowRadius - deadZoneRadius),
          1,
        ) *
        cameraState.followLerpFactor *
        lerpMultiplier;

      const lerpAmount = 1 - Math.pow(1 - progressiveFactor, deltaTime);

      cameraState.worldContainer.pivot.x += deltaX * lerpAmount;
      cameraState.worldContainer.pivot.y += deltaY * lerpAmount;
    }

    cameraState.worldContainer.position.set(halfViewportX, halfViewportY);
  }

  // --- Shake offset ---
  if (cameraState.shakeState) {
    const deltaSeconds = deltaTime / 60;
    cameraState.shakeState.remainingDuration -= deltaSeconds;

    if (cameraState.shakeState.remainingDuration <= 0) {
      const { onComplete } = cameraState.shakeState;
      cameraState.shakeState = null;
      onComplete?.();
    } else {
      const shakeIntensity = cameraState.shakeState.intensity;
      cameraState.worldContainer.position.x +=
        (Math.random() - 0.5) * shakeIntensity * 2;
      cameraState.worldContainer.position.y +=
        (Math.random() - 0.5) * shakeIntensity * 2;
    }
  }

  // --- Depth sort — sprites further down (higher y) render in front ---
  if (cameraState.depthSortingEnabled) {
    for (const child of cameraState.worldContainer.children) {
      child.zIndex = child.y;
    }
  }

  // --- Zoom ---
  if (cameraState.zoomTarget) {
    const currentScale = cameraState.worldContainer.scale.x;
    const { targetScale, easingSpeed, onComplete } = cameraState.zoomTarget;
    const diff = targetScale - currentScale;

    if (Math.abs(diff) < 0.005) {
      cameraState.worldContainer.scale.set(targetScale);
      cameraState.zoomTarget = null;
      onComplete?.();
    } else {
      const lerpAmount = 1 - Math.pow(1 - easingSpeed, deltaTime);
      const newScale = currentScale + diff * lerpAmount;
      cameraState.worldContainer.scale.set(newScale);
    }
  }
}
