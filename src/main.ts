import { createApplicationLayout } from "./app/layout";
import { createPixiApplication, applyCrtFilter } from "./renderer/stage";
import { createCamera, resetCameraState } from "./renderer/camera";
import { renderDemoNavigation } from "./app/navigation";
import { loadBlueprintFromPath, createDialogueEngine } from "./engine/setup";
import {
  registerCharacterResolver,
  registerGlobalHandlers,
} from "./engine/handlers";
import { LSDE_SCENES } from "../public/blueprints/blueprint.enums";
import { initAnalytics, trackSceneSelected } from "./analytics/posthog";
import { Pane } from "tweakpane";
import { registerCrtFilterControls } from "./debug/debug-panel";
import { createBlueprintPreview } from "./app/blueprint-preview";
import { createMagicTrail } from "./renderer/magic-trail";
import {
  currentLanguage,
  setCurrentLanguage,
  type SupportedLanguage,
} from "./engine/i18n";

const BLUEPRINT_FILE_PATH = `${import.meta.env.BASE_URL}blueprints/blueprint.json`;

/** Maps scene label → blueprint screenshot filename in public/blueprints/_images/ */
const SCENE_BLUEPRINT_IMAGES: Record<string, string> = {
  "simple-dialog-flow": "1.jpg",
  "multi-tracks": "2.jpg",
  "simple-choices": "choice.webp",
  "simple-action": "action.webp",
  "simple-condition": "cond.webp",
  "condition-dispatch": "cond.webp",
};
const DEFAULT_SCENE_UUID = LSDE_SCENES.simpleChoices;

const POSTHOG_API_KEY = import.meta.env.VITE_POSTHOG_API_KEY as string;
const POSTHOG_API_HOST =
  (import.meta.env.VITE_POSTHOG_API_HOST as string) ||
  "https://us.i.posthog.com";

(async () => {
  initAnalytics(POSTHOG_API_KEY, POSTHOG_API_HOST);
  const { sidebarContainer, canvasContainer, onSidebarTransitionEnd } =
    createApplicationLayout();
  const pixiApplication = await createPixiApplication(canvasContainer);

  // Re-fit the renderer when the sidebar finishes collapsing / expanding.
  onSidebarTransitionEnd(() => pixiApplication.resize());
  const crtFilterState = applyCrtFilter(pixiApplication);
  const crtPane = new Pane({ title: "CRTFilter", expanded: false });
  registerCrtFilterControls(crtPane, crtFilterState);
  const blueprintPreview = createBlueprintPreview(canvasContainer);
  createMagicTrail(pixiApplication);
  const cameraState = createCamera(pixiApplication);

  const blueprintData = await loadBlueprintFromPath(BLUEPRINT_FILE_PATH);
  const dialogueEngine = createDialogueEngine();
  dialogueEngine.init({ data: blueprintData });
  registerCharacterResolver(dialogueEngine);

  // Set initial language from blueprint and register handlers with a live getter.
  setCurrentLanguage(
    (blueprintData.primaryLanguage as SupportedLanguage) ?? "fr",
  );
  registerGlobalHandlers(
    dialogueEngine,
    {
      onDialogueBlockReceived: () => {},
      onChoiceBlockReceived: () => {},
      onSceneCompleted: () => {},
    },
    () => currentLanguage,
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

    trackSceneSelected(sceneData.uuid, sceneData.label);
    blueprintPreview.update(SCENE_BLUEPRINT_IMAGES[sceneData.label] ?? null);

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
