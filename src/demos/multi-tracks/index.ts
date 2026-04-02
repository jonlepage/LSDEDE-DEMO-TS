/**
 * Demo: multi-tracks — stub.
 * No sprites, no logic. Just an empty canvas.
 * Will be implemented when the scene content is designed in LSDE.
 */

export interface SceneCleanup {
  readonly teardown: () => void;
}

export async function runScene(): Promise<SceneCleanup> {
  return {
    teardown: () => {},
  };
}
