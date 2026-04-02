/**
 * Character animation presets — simple, predefined animations for sprites.
 * Each preset manipulates pivot/scale/rotation over time via the ticker.
 */

import type { Application, Sprite } from "pixi.js";

export type AnimationPresetName = "jump" | "spin" | "bounce";

interface ActiveAnimation {
  elapsedTime: number;
  totalDuration: number;
  updateFunction: (sprite: Sprite, progress: number) => void;
  originalPivotY: number;
  originalRotation: number;
  originalScaleX: number;
  originalScaleY: number;
}

const activeAnimations = new Map<Sprite, ActiveAnimation>();

function jumpUpdate(sprite: Sprite, progress: number): void {
  const arc = Math.sin(progress * Math.PI);
  sprite.pivot.y = arc * 14;
}

function spinUpdate(sprite: Sprite, progress: number): void {
  sprite.rotation = progress * Math.PI * 2;
}

function bounceUpdate(sprite: Sprite, progress: number): void {
  const squash = 1 + Math.sin(progress * Math.PI * 3) * 0.2 * (1 - progress);
  sprite.scale.set(
    sprite.scale.x > 0 ? Math.abs(1 / squash) * 2 : -Math.abs(1 / squash) * 2,
    squash * 2,
  );
}

const PRESET_CONFIG: Record<
  AnimationPresetName,
  {
    duration: number;
    updateFunction: (sprite: Sprite, progress: number) => void;
  }
> = {
  jump: { duration: 0.4, updateFunction: jumpUpdate },
  spin: { duration: 0.5, updateFunction: spinUpdate },
  bounce: { duration: 0.6, updateFunction: bounceUpdate },
};

export function playCharacterAnimation(
  pixiApplication: Application,
  characterSprite: Sprite,
  presetName: AnimationPresetName,
): void {
  if (activeAnimations.has(characterSprite)) return;

  const config = PRESET_CONFIG[presetName];

  const animation: ActiveAnimation = {
    elapsedTime: 0,
    totalDuration: config.duration,
    updateFunction: config.updateFunction,
    originalPivotY: characterSprite.pivot.y,
    originalRotation: characterSprite.rotation,
    originalScaleX: characterSprite.scale.x,
    originalScaleY: characterSprite.scale.y,
  };

  activeAnimations.set(characterSprite, animation);

  const tickerCallback = (time: { deltaTime: number }) => {
    animation.elapsedTime += time.deltaTime / 60;
    const progress = Math.min(
      animation.elapsedTime / animation.totalDuration,
      1,
    );

    animation.updateFunction(characterSprite, progress);

    if (progress >= 1) {
      characterSprite.pivot.y = animation.originalPivotY;
      characterSprite.rotation = animation.originalRotation;
      characterSprite.scale.set(
        animation.originalScaleX,
        animation.originalScaleY,
      );
      activeAnimations.delete(characterSprite);
      pixiApplication.ticker.remove(tickerCallback);
    }
  };

  pixiApplication.ticker.add(tickerCallback);
}
