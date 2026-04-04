import type { Application, Container } from "pixi.js";
import type { CameraState } from "../../renderer/camera";
import type { DialogueEngine, BlueprintExport } from "@lsde/dialog-engine";

export interface DemoDependencies {
	readonly pixiApplication: Application;
	readonly cameraState: CameraState;
	readonly worldContainer: Container;
	readonly dialogueEngine: DialogueEngine;
	readonly blueprintData: BlueprintExport;
}
export interface SceneCleanup {
	readonly teardown: () => void;
}
