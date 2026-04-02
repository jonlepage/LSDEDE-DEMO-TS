/**
 * PixiJS stage setup — creates and configures the base Application instance.
 */

import { Application } from "pixi.js";
import { PIXI_BACKGROUND_COLOR } from "../shared/constants";

export async function createPixiApplication(
  canvasContainer: HTMLElement,
): Promise<Application> {
  const pixiApplication = new Application();

  await pixiApplication.init({
    background: PIXI_BACKGROUND_COLOR,
    resizeTo: canvasContainer,
  });

  canvasContainer.appendChild(pixiApplication.canvas);

  return pixiApplication;
}
