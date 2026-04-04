/**
 * Magic mouse trail — a subtle luminous imprint left on the background.
 *
 * Uses PixiJS MeshRope with a procedurally generated gradient texture.
 * The trail records the actual mouse path as a position history buffer.
 * Points are placed exactly where the mouse traveled — no spring physics,
 * no wave animation — creating a calm, "trace on snow" aesthetic.
 *
 * Visual recipe:
 *   - Head-to-tail alpha gradient (soft glow → transparent)
 *   - Width narrows toward the tail via texture taper
 *   - Hue rotates very slowly for a gentle living-color shimmer
 *   - Additive blending for a soft imprint on the background
 *
 * Renderer-only module — knows nothing about engine or game layers.
 */

import type { Application } from "pixi.js";
import { Container, Graphics, MeshRope, Point, RenderTexture } from "pixi.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Number of recorded positions in the trail history. */
const TRAIL_POINT_COUNT = 60;

/** Minimum distance (px) between two recorded points. Prevents clumping. */
const MIN_POINT_DISTANCE = 6;

/** Speed of the hue rotation (degrees per frame). */
const HUE_ROTATION_SPEED = 0.06;

/** Width of the generated gradient texture (px). Height = trail "thickness". */
const TEXTURE_WIDTH = 256;
const TEXTURE_HEIGHT = 8;

/** How often (in frames) the texture is regenerated for hue shift. */
const TEXTURE_REFRESH_INTERVAL = 12;

/** Frames of inactivity before the trail starts retracting. */
const IDLE_GRACE_FRAMES = 6;

/** Once idle, shift the buffer every N frames (lower = faster retraction). */
const IDLE_RETRACT_INTERVAL = 3;

// ---------------------------------------------------------------------------
// Texture generation
// ---------------------------------------------------------------------------

/**
 * Builds a horizontal gradient texture — a soft tapered ribbon that fades
 * from left (head, opaque) to right (tail, transparent).
 */
function generateTrailTexture(
	application: Application,
	hue: number,
	existingTexture?: RenderTexture,
): RenderTexture {
	const renderTexture =
		existingTexture ??
		RenderTexture.create({
			width: TEXTURE_WIDTH,
			height: TEXTURE_HEIGHT,
		});

	const graphics = new Graphics();
	const segments = 24;

	for (let segmentIndex = 0; segmentIndex < segments; segmentIndex++) {
		const progressStart = segmentIndex / segments;
		const progressEnd = (segmentIndex + 1) / segments;
		const xStart = progressStart * TEXTURE_WIDTH;
		const xEnd = progressEnd * TEXTURE_WIDTH;

		// Taper: smooth cubic ease-out for a gentle narrowing.
		const taperStart = Math.pow(1 - progressStart, 1.5);
		const taperEnd = Math.pow(1 - progressEnd, 1.5);
		const halfHeightStart = (TEXTURE_HEIGHT / 2) * taperStart;
		const halfHeightEnd = (TEXTURE_HEIGHT / 2) * taperEnd;

		// Alpha: steeper fade so the tail vanishes quickly.
		const alpha = Math.pow(1 - (progressStart + progressEnd) / 2, 2.2) * 0.7;

		const localHue = (hue + progressStart * 20) % 360;

		graphics
			.moveTo(xStart, TEXTURE_HEIGHT / 2 - halfHeightStart)
			.lineTo(xEnd, TEXTURE_HEIGHT / 2 - halfHeightEnd)
			.lineTo(xEnd, TEXTURE_HEIGHT / 2 + halfHeightEnd)
			.lineTo(xStart, TEXTURE_HEIGHT / 2 + halfHeightStart)
			.closePath()
			.fill({ color: hslToHex(localHue, 60, 75), alpha });
	}

	application.renderer.render({
		container: graphics,
		target: renderTexture,
		clear: true,
	});
	graphics.destroy();

	return renderTexture;
}

// ---------------------------------------------------------------------------
// HSL → hex helper
// ---------------------------------------------------------------------------

function hslToHex(hue: number, saturation: number, lightness: number): number {
	const s = saturation / 100;
	const l = lightness / 100;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => {
		const k = (n + hue / 30) % 12;
		const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return Math.round(255 * Math.max(0, Math.min(1, color)));
	};
	return (f(0) << 16) | (f(8) << 8) | f(4);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MagicTrailHandle {
	/** Remove trail from stage and stop all updates. */
	destroy(): void;
}

export function createMagicTrail(application: Application): MagicTrailHandle {
	// Skip on touch-only devices (no persistent pointer).
	if (window.matchMedia("(pointer: coarse)").matches) {
		return { destroy() {} };
	}

	const centerX = application.screen.width / 2;
	const centerY = application.screen.height / 2;

	// --- Position history: all points start at center ---
	const trailPoints: Point[] = [];
	for (let i = 0; i < TRAIL_POINT_COUNT; i++) {
		trailPoints.push(new Point(centerX, centerY));
	}

	// --- Trail container ---
	const trailContainer = new Container();
	trailContainer.label = "magic-trail";
	application.stage.addChild(trailContainer);

	// --- Texture ---
	let currentHue = 220;
	const trailTexture = generateTrailTexture(application, currentHue);

	// --- MeshRope ---
	const rope = new MeshRope({
		texture: trailTexture,
		points: trailPoints,
		textureScale: 0,
	});
	rope.blendMode = "add";
	rope.alpha = 0.35;
	trailContainer.addChild(rope);

	// --- Mouse tracking ---
	let mouseX = centerX;
	let mouseY = centerY;

	const onPointerMove = (event: PointerEvent) => {
		const canvas = application.canvas;
		const rect = canvas.getBoundingClientRect();
		mouseX =
			((event.clientX - rect.left) / rect.width) * application.screen.width;
		mouseY =
			((event.clientY - rect.top) / rect.height) * application.screen.height;
	};

	application.canvas.addEventListener("pointermove", onPointerMove);

	// --- Animation state ---
	let textureRefreshAccumulator = 0;
	let idleFrameCount = 0;
	let idleRetractAccumulator = 0;

	// --- Per-frame update: shift history buffer, record new position ---
	const tickerCallback = () => {
		const headX = trailPoints[0].x;
		const headY = trailPoints[0].y;
		const deltaX = mouseX - headX;
		const deltaY = mouseY - headY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		if (distance >= MIN_POINT_DISTANCE) {
			// Mouse moved — shift buffer and record new head position.
			idleFrameCount = 0;
			idleRetractAccumulator = 0;
			for (let i = TRAIL_POINT_COUNT - 1; i > 0; i--) {
				trailPoints[i].x = trailPoints[i - 1].x;
				trailPoints[i].y = trailPoints[i - 1].y;
			}
			trailPoints[0].x = mouseX;
			trailPoints[0].y = mouseY;
		} else {
			// Mouse idle — after a grace period, retract the trail continuously
			// by shifting the buffer (head stays at mouse position).
			idleFrameCount++;
			if (idleFrameCount > IDLE_GRACE_FRAMES) {
				idleRetractAccumulator++;
				if (idleRetractAccumulator >= IDLE_RETRACT_INTERVAL) {
					idleRetractAccumulator = 0;
					for (let i = TRAIL_POINT_COUNT - 1; i > 0; i--) {
						trailPoints[i].x = trailPoints[i - 1].x;
						trailPoints[i].y = trailPoints[i - 1].y;
					}
					trailPoints[0].x = mouseX;
					trailPoints[0].y = mouseY;
				}
			}
		}

		// Slow hue rotation for subtle color shift.
		currentHue = (currentHue + HUE_ROTATION_SPEED) % 360;
		textureRefreshAccumulator++;
		if (textureRefreshAccumulator >= TEXTURE_REFRESH_INTERVAL) {
			textureRefreshAccumulator = 0;
			generateTrailTexture(application, currentHue, trailTexture);
		}
	};

	application.ticker.add(tickerCallback);

	return {
		destroy() {
			application.ticker.remove(tickerCallback);
			application.canvas.removeEventListener("pointermove", onPointerMove);
			trailContainer.destroy({ children: true });
			trailTexture.destroy(true);
		},
	};
}
