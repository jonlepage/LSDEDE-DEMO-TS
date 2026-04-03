import { createApplicationLayout } from "./app/layout";
import { createPixiApplication } from "./renderer/stage";
import { createCamera, resetCameraState } from "./renderer/camera";
import { renderDemoNavigation } from "./app/navigation";
import { loadBlueprintFromPath, createDialogueEngine } from "./engine/setup";
import {
  registerCharacterResolver,
  registerGlobalHandlers,
} from "./engine/handlers";
import { LSDE_SCENES } from "../public/blueprints/blueprint.enums";

const BLUEPRINT_FILE_PATH = "/blueprints/blueprint.json";
const DEFAULT_SCENE_UUID = LSDE_SCENES.simpleCondition;

(async () => {
  const { sidebarContainer, canvasContainer } = createApplicationLayout();
  const pixiApplication = await createPixiApplication(canvasContainer);
  const cameraState = createCamera(pixiApplication);

  const blueprintData = await loadBlueprintFromPath(BLUEPRINT_FILE_PATH);
  const dialogueEngine = createDialogueEngine();
  dialogueEngine.init({ data: blueprintData });
  registerCharacterResolver(dialogueEngine);
  registerGlobalHandlers(
    dialogueEngine,
    {
      onDialogueBlockReceived: () => {},
      onChoiceBlockReceived: () => {},
      onSceneCompleted: () => {},
    },
    blueprintData.primaryLanguage ?? "fr",
  );

  const sceneNavigationEntries = blueprintData.scenes.map((scene) => ({
    id: scene.uuid,
    title: scene.label,
    description: `${scene.blocks.length} blocks`,
    blueprintPath: BLUEPRINT_FILE_PATH,
  }));

  let currentSceneTeardown: (() => void) | null = null;

  async function loadScene(sceneUuid: string): Promise<void> {
    if (currentSceneTeardown) {
      // Stop the dialogue engine FIRST so no block callbacks fire on destroyed resources.
      dialogueEngine.stop();
      currentSceneTeardown();
      currentSceneTeardown = null;
    }

    resetCameraState(cameraState);
    cameraState.worldContainer.removeChildren();

    const sceneData = blueprintData.scenes.find(
      (scene) => scene.uuid === sceneUuid,
    );

    if (!sceneData) {
      console.warn(`[LSDE] Scene UUID "${sceneUuid}" not found in blueprint.`);
      return;
    }

    console.group(`[LSDE] Scene: ${sceneData.label}`);
    console.log("UUID:", sceneData.uuid);
    console.log("Entry block:", sceneData.entryBlockId);
    console.log("Blocks:", sceneData.blocks.length, sceneData.blocks);
    console.log(
      "Connections:",
      sceneData.connections.length,
      sceneData.connections,
    );
    const characterIds = new Set<string>();
    for (const block of sceneData.blocks) {
      if (block.metadata?.characters) {
        for (const character of block.metadata.characters) {
          characterIds.add(`${character.id} (${character.name})`);
        }
      }
    }
    console.log("Characters:", [...characterIds]);
    console.groupEnd();

    try {
      // Demo folders match scene labels (e.g. "simple-dialog-flow", "multi-tracks")
      const demoModule = await import(`./demos/${sceneData.label}/index.ts`);
      const sceneCleanup = await demoModule.runScene({
        pixiApplication,
        cameraState,
        worldContainer: cameraState.worldContainer,
        dialogueEngine,
        blueprintData,
      });
      currentSceneTeardown = sceneCleanup.teardown;
    } catch (importError) {
      console.warn(
        `[LSDE] No demo script for scene "${sceneData.label}" — showing empty canvas.`,
        importError,
      );
    }
  }

  const navigationHandle = renderDemoNavigation(
    sidebarContainer,
    sceneNavigationEntries,
    loadScene,
  );

  navigationHandle.selectById(DEFAULT_SCENE_UUID);
  loadScene(DEFAULT_SCENE_UUID);
})();
