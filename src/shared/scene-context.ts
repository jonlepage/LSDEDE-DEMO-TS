/**
 * SceneContext — manages all disposable resources created during a scene's lifetime.
 * Every ticker callback, sprite, event listener, or custom cleanup registered here
 * is automatically destroyed when `dispose()` is called.
 * Guarantees complete isolation between scenes: no leaked state, no orphan callbacks.
 */

import type { Application, Container, Sprite } from "pixi.js";

type TickerCallback = (time: { deltaTime: number }) => void;
type DisposableFunction = () => void;

export interface SceneContext {
  addTickerCallback(callback: TickerCallback): void;
  addSprite(sprite: Sprite, parent: Container): void;
  addStageListener(
    eventName: string,
    callback: (...args: unknown[]) => void,
  ): void;
  addDisposable(cleanupFunction: DisposableFunction): void;
  dispose(): void;
}

export function createSceneContext(pixiApplication: Application): SceneContext {
  const tickerCallbacks: TickerCallback[] = [];
  const spritesWithParents: { sprite: Sprite; parent: Container }[] = [];
  const stageListeners: {
    eventName: string;
    callback: (...args: unknown[]) => void;
  }[] = [];
  const disposables: DisposableFunction[] = [];

  return {
    addTickerCallback(callback: TickerCallback): void {
      pixiApplication.ticker.add(callback);
      tickerCallbacks.push(callback);
    },

    addSprite(sprite: Sprite, parent: Container): void {
      parent.addChild(sprite);
      spritesWithParents.push({ sprite, parent });
    },

    addStageListener(
      eventName: string,
      callback: (...args: unknown[]) => void,
    ): void {
      pixiApplication.stage.on(eventName, callback);
      stageListeners.push({ eventName, callback });
    },

    addDisposable(cleanupFunction: DisposableFunction): void {
      disposables.push(cleanupFunction);
    },

    dispose(): void {
      for (const callback of tickerCallbacks) {
        pixiApplication.ticker.remove(callback);
      }
      tickerCallbacks.length = 0;

      for (const { eventName, callback } of stageListeners) {
        pixiApplication.stage.off(eventName, callback);
      }
      stageListeners.length = 0;

      for (const { sprite, parent } of spritesWithParents) {
        parent.removeChild(sprite);
        sprite.destroy();
      }
      spritesWithParents.length = 0;

      for (const cleanupFunction of disposables) {
        cleanupFunction();
      }
      disposables.length = 0;
    },
  };
}
