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
 * Each party NPC's movement ticker (with cross-collision against the player and
 * sibling NPCs) is registered here. gameActions.isInParty() is checked each
 * frame — only recruited members receive trail targets.
 */

import type { Application } from "pixi.js";
import {
	setMovementTarget,
	registerMovementTicker,
} from "../../renderer/movement";
import { createCollidable, resolveCollisions } from "../../renderer/collision";
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
	readonly pixiApplication: Application;
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

export interface PartyFollowHandle {
	/** Pause the follow system — followers stop chasing the player. */
	pause(): void;
	/** Resume follow and reset the trail from the current player position. */
	resume(): void;
}

export function setupPartyFollow(
	options: SetupPartyFollowOptions,
): PartyFollowHandle {
	const {
		pixiApplication,
		playerReference,
		partyNpcIds,
		characters,
		sceneContext,
		gameActions,
		followDistance = DEFAULT_FOLLOW_DISTANCE,
		updateDistanceThreshold = DEFAULT_UPDATE_DISTANCE_THRESHOLD,
	} = options;

	// Register a movement ticker with cross-collision for each party NPC.
	// Each NPC collides against the player and all sibling NPCs simultaneously.
	const playerCollidable = createCollidable(playerReference.sprite);

	for (const npcId of partyNpcIds) {
		const characterRef = characters.get(npcId);
		if (!characterRef) continue;

		const npcCollidable = createCollidable(characterRef.sprite);
		const obstaclesForThisNpc = [
			playerCollidable,
			...partyNpcIds
				.filter((id) => id !== npcId)
				.map((id) => characters.get(id))
				.filter((ref): ref is CharacterReference => !!ref)
				.map((ref) => createCollidable(ref.sprite)),
		];

		const unregisterNpcMovement = registerMovementTicker(
			pixiApplication,
			characterRef.sprite,
			characterRef.movementState,
			(proposedX: number, proposedY: number) =>
				resolveCollisions(npcCollidable, proposedX, proposedY, obstaclesForThisNpc),
		);
		sceneContext.addDisposable(unregisterNpcMovement);
	}

	// Trail stores positions from newest (index 0) to oldest.
	const trail: TrailPoint[] = [];
	let paused = false;

	sceneContext.addTickerCallback(() => {
		if (paused) return;

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

	return {
		pause() {
			paused = true;
		},
		resume() {
			// Reset trail so followers don't teleport back to a stale path.
			trail.length = 0;
			paused = false;
		},
	};
}
