/**
 * Shared scene setup — party follow in single-file (queue) formation.
 *
 * Instead of each NPC targeting a fixed offset from the player, the system
 * records a breadcrumb trail of the player's positions and assigns each
 * follower a point further back on that trail. This creates a natural
 * "follow-the-leader" chain where members walk the same path the player took.
 *
 * The partyNpcIds order defines queue priority: index 0 is closest to the
 * player, index 1 follows index 0's trail, etc.
 *
 * Prerequisites:
 *  - Each party NPC must have its own registerMovementTicker already registered
 *    so the movement system can process the targets set here.
 *  - gameActions.isInParty() is checked each frame — only recruited members move.
 */

import { setMovementTarget } from "../../renderer/movement";
import type {
  CharacterReference,
  GameActionFacade,
} from "../../game/game-actions";
import type { SceneContext } from "../../shared/scene-context";

/** Minimum distance between two recorded breadcrumb points (px). */
const BREADCRUMB_SPACING = 6;
/** Maximum breadcrumbs stored — enough for 3 followers at generous spacing. */
const MAX_BREADCRUMBS = 600;
/** Default trail distance between each follower in the chain (px). */
const DEFAULT_FOLLOW_DISTANCE = 55;
/** How far from the resolved trail point a follower must be before updating. */
const DEFAULT_UPDATE_DISTANCE_THRESHOLD = 10;

interface TrailPoint {
  x: number;
  y: number;
  /** Cumulative arc-length distance from the trail head (most recent point). */
  cumulativeDistance: number;
}

export interface SetupPartyFollowOptions {
  readonly playerReference: CharacterReference;
  /** Ordered list — index 0 is first in queue (closest to player). */
  readonly partyNpcIds: ReadonlyArray<string>;
  readonly characters: Map<string, CharacterReference>;
  readonly sceneContext: SceneContext;
  readonly gameActions: GameActionFacade;
  /** Trail distance between successive chain members (px). Default 55. */
  readonly followDistance?: number;
  readonly updateDistanceThreshold?: number;
}

/**
 * Walk the trail backwards and interpolate the position at `targetDistance`
 * arc-length from the head. Returns the interpolated point, or the trail
 * tail if the trail isn't long enough yet.
 */
function sampleTrailAtDistance(
  trail: TrailPoint[],
  targetDistance: number,
): { x: number; y: number } {
  if (trail.length === 0) return { x: 0, y: 0 };
  if (trail.length === 1) return { x: trail[0].x, y: trail[0].y };

  for (let i = 1; i < trail.length; i++) {
    if (trail[i].cumulativeDistance >= targetDistance) {
      const prev = trail[i - 1];
      const curr = trail[i];
      const segmentLength = curr.cumulativeDistance - prev.cumulativeDistance;
      if (segmentLength < 0.001) return { x: curr.x, y: curr.y };
      const ratio = (targetDistance - prev.cumulativeDistance) / segmentLength;
      return {
        x: prev.x + (curr.x - prev.x) * ratio,
        y: prev.y + (curr.y - prev.y) * ratio,
      };
    }
  }

  // Trail not long enough — return the tail.
  const tail = trail[trail.length - 1];
  return { x: tail.x, y: tail.y };
}

export function setupPartyFollow(options: SetupPartyFollowOptions): void {
  const {
    playerReference,
    partyNpcIds,
    characters,
    sceneContext,
    gameActions,
    followDistance = DEFAULT_FOLLOW_DISTANCE,
    updateDistanceThreshold = DEFAULT_UPDATE_DISTANCE_THRESHOLD,
  } = options;

  // Trail stores positions from newest (index 0) to oldest.
  const trail: TrailPoint[] = [];

  sceneContext.addTickerCallback(() => {
    const playerX = playerReference.sprite.x;
    const playerY = playerReference.sprite.y;

    // --- Record breadcrumb ---
    if (trail.length === 0) {
      trail.push({ x: playerX, y: playerY, cumulativeDistance: 0 });
    } else {
      const head = trail[0];
      const dx = playerX - head.x;
      const dy = playerY - head.y;
      const distFromHead = Math.sqrt(dx * dx + dy * dy);

      if (distFromHead >= BREADCRUMB_SPACING) {
        // Shift cumulative distances: the new head is 0, everything else adds distFromHead.
        for (const point of trail) {
          point.cumulativeDistance += distFromHead;
        }
        trail.unshift({ x: playerX, y: playerY, cumulativeDistance: 0 });

        // Trim excess breadcrumbs.
        if (trail.length > MAX_BREADCRUMBS) {
          trail.length = MAX_BREADCRUMBS;
        }
      }
    }

    // --- Assign trail targets to recruited members ---
    let followerIndex = 0;
    for (const characterId of partyNpcIds) {
      if (!gameActions.isInParty(characterId)) continue;
      const characterRef = characters.get(characterId);
      if (!characterRef) continue;

      followerIndex++;
      const targetDistance = followerIndex * followDistance;
      const trailTarget = sampleTrailAtDistance(trail, targetDistance);

      const deltaX = trailTarget.x - characterRef.sprite.x;
      const deltaY = trailTarget.y - characterRef.sprite.y;

      if (
        Math.sqrt(deltaX * deltaX + deltaY * deltaY) > updateDistanceThreshold
      ) {
        setMovementTarget(
          characterRef.movementState,
          trailTarget.x,
          trailTarget.y,
        );
      }
    }
  });
}
