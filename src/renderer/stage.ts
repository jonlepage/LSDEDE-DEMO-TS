/**
 * PixiJS stage setup — creates and configures the base Application instance.
 */

import { Application, Rectangle } from "pixi.js";
import { CRTFilter } from "pixi-filters";
import { PIXI_BACKGROUND_COLOR } from "../shared/constants";

export interface CrtFilterState {
	readonly filter: CRTFilter;
	enabled: boolean;
	animating: boolean;
}

export async function createPixiApplication(
	canvasContainer: HTMLElement,
): Promise<Application> {
	const pixiApplication = new Application();

	await pixiApplication.init({
		background: PIXI_BACKGROUND_COLOR,
		resizeTo: canvasContainer,
		antialias: true,
		resolution: window.devicePixelRatio || 1,
		autoDensity: true,
	});

	canvasContainer.appendChild(pixiApplication.canvas);

	return pixiApplication;
}

export function applyCrtFilter(pixiApplication: Application): CrtFilterState {
	const filter = new CRTFilter({
		curvature: 1,
		lineWidth: 1,
		lineContrast: 0.1258,
		verticalLine: false,
		noise: 0.0422,
		noiseSize: 2.053,
		vignetting: 0.22,
		vignettingAlpha: 3,
		vignettingBlur: 0.424,
		seed: 0.105,
		time: 0,
	});

	const state: CrtFilterState = {
		filter,
		enabled: true,
		animating: true,
	};

	const filterArea = new Rectangle(
		0,
		0,
		pixiApplication.screen.width,
		pixiApplication.screen.height,
	);
	pixiApplication.stage.filters = [filter];
	pixiApplication.stage.filterArea = filterArea;

	pixiApplication.ticker.add((ticker) => {
		if (state.enabled && state.animating) {
			state.filter.time += ticker.deltaTime;
			state.filter.seed = Math.random();
		}
		state.filter.enabled = state.enabled;

		// Keep filterArea in sync with canvas size on resize
		filterArea.width = pixiApplication.screen.width;
		filterArea.height = pixiApplication.screen.height;
	});

	return state;
}
