/**
 * Circle-based collision detection between sprites.
 * Each sprite is treated as a circle with a configurable radius.
 */

import type { Sprite } from "pixi.js";

const DEFAULT_COLLISION_RADIUS = 10;

export interface CollidableSprite {
	readonly sprite: Sprite;
	readonly collisionRadius: number;
}

export function createCollidable(
	sprite: Sprite,
	collisionRadius: number = DEFAULT_COLLISION_RADIUS * sprite.scale.x,
): CollidableSprite {
	return { sprite, collisionRadius };
}

function computeDistanceBetweenSprites(
	spriteA: Sprite,
	spriteB: Sprite,
): number {
	const deltaX = spriteA.x - spriteB.x;
	const deltaY = spriteA.y - spriteB.y;
	return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

export function areSpritesColliding(
	collidableA: CollidableSprite,
	collidableB: CollidableSprite,
): boolean {
	const distance = computeDistanceBetweenSprites(
		collidableA.sprite,
		collidableB.sprite,
	);
	const minimumDistance =
		collidableA.collisionRadius + collidableB.collisionRadius;
	return distance < minimumDistance;
}

/**
 * Given a proposed position for `movingCollidable`, resolve collisions against
 * all `obstacles`. If the proposed position overlaps an obstacle, the sprite
 * is pushed back to the nearest non-overlapping position along the collision axis.
 */
export function resolveCollisions(
	movingCollidable: CollidableSprite,
	proposedX: number,
	proposedY: number,
	obstacles: ReadonlyArray<CollidableSprite>,
): { allowedX: number; allowedY: number } {
	let resolvedX = proposedX;
	let resolvedY = proposedY;

	for (const obstacle of obstacles) {
		const deltaX = resolvedX - obstacle.sprite.x;
		const deltaY = resolvedY - obstacle.sprite.y;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		const minimumDistance =
			movingCollidable.collisionRadius + obstacle.collisionRadius;

		if (distance < minimumDistance && distance > 0) {
			const overlapAmount = minimumDistance - distance;
			const normalizedDirectionX = deltaX / distance;
			const normalizedDirectionY = deltaY / distance;

			resolvedX += normalizedDirectionX * overlapAmount;
			resolvedY += normalizedDirectionY * overlapAmount;
		}
	}

	return { allowedX: resolvedX, allowedY: resolvedY };
}
