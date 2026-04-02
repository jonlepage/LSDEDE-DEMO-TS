/**
 * Debug panel powered by Tweakpane.
 * Provides real-time inspection and control of game state, engine state, and rendering.
 * This panel is for development only — not part of the demo UI.
 */

import { Pane } from "tweakpane";
import type { ButtonApi, FolderApi, ListBladeApi } from "tweakpane";
import type { Application } from "pixi.js";
import type { GameStore } from "../game/game-store";
import type { GameActionFacade } from "../game/game-actions";
import type { SupportedLanguage } from "../engine/i18n";

export interface DebugPanelState {
  readonly pane: Pane;
  readonly gameStoreFolder: FolderApi;
  readonly engineFolder: FolderApi;
  readonly liveMonitor: LiveMonitorState;
}

export interface DebugPanelCallbacks {
  readonly onLanguageChanged?: (language: SupportedLanguage) => void;
}

interface LiveMonitorState {
  fps: number;
}

export function createDebugPanel(
  callbacks: DebugPanelCallbacks = {},
): DebugPanelState {
  const pane = new Pane({ title: "Debug Panel", expanded: true });

  const liveMonitor: LiveMonitorState = { fps: 0 };

  pane.addBinding(liveMonitor, "fps", { readonly: true, label: "FPS" });

  pane.addBlade({ view: "separator" });

  const engineFolder = pane.addFolder({ title: "Engine", expanded: true });
  const gameStoreFolder = pane.addFolder({
    title: "Game Store",
    expanded: true,
  });

  const languageBlade = engineFolder.addBlade({
    view: "list",
    label: "Language",
    options: [
      { text: "English", value: "en" },
      { text: "Français", value: "fr" },
    ],
    value: "en",
  }) as ListBladeApi<string>;

  languageBlade.on("change", (event) => {
    callbacks.onLanguageChanged?.(event.value as SupportedLanguage);
  });

  return { pane, gameStoreFolder, engineFolder, liveMonitor };
}

function addButton(
  folder: FolderApi,
  title: string,
  onClick: () => void,
): void {
  (folder.addBlade({ view: "button", title }) as ButtonApi).on(
    "click",
    onClick,
  );
}

export function registerActionButtons(
  debugPanelState: DebugPanelState,
  gameActions: GameActionFacade,
  firstNpcCharacterId: string,
): void {
  const actionsFolder = debugPanelState.pane.addFolder({
    title: "Actions",
    expanded: true,
  });

  const cameraFolder = actionsFolder.addFolder({
    title: "Camera",
    expanded: false,
  });
  addButton(cameraFolder, "Shake", () => gameActions.shakeCamera());
  addButton(cameraFolder, "Zoom In (1.5x)", () => gameActions.zoomCamera(1.5));
  addButton(cameraFolder, "Zoom Reset (1x)", () => gameActions.zoomCamera(1));
  addButton(cameraFolder, "Move to 0,0", () =>
    gameActions.moveCameraToPosition(0, 0),
  );

  const characterFolder = actionsFolder.addFolder({
    title: "Character",
    expanded: false,
  });
  addButton(characterFolder, "Jump NPC", () =>
    gameActions.jumpCharacter(firstNpcCharacterId),
  );
  addButton(characterFolder, "Spin NPC", () =>
    gameActions.playCharacterAnimation(firstNpcCharacterId, "spin"),
  );
  addButton(characterFolder, "Bounce NPC", () =>
    gameActions.playCharacterAnimation(firstNpcCharacterId, "bounce"),
  );

  const dialogueFolder = actionsFolder.addFolder({
    title: "Dialogue",
    expanded: false,
  });
  addButton(dialogueFolder, "Show Bubble on NPC", () =>
    gameActions.showBubbleOnCharacter(
      firstNpcCharacterId,
      "Red Bunny",
      "Hello! This is a test bubble from the debug panel.",
      "#cc3333",
    ),
  );
  addButton(dialogueFolder, "Show Choices on NPC", () =>
    gameActions.showChoicesOnCharacter(
      firstNpcCharacterId,
      [
        { choiceUuid: "a", text: "Option A" },
        { choiceUuid: "b", text: "Option B" },
      ],
      (uuid) => console.log("Debug choice:", uuid),
    ),
  );

  const stateFolder = actionsFolder.addFolder({
    title: "Game State",
    expanded: false,
  });
  addButton(stateFolder, "Set testVar = 42", () =>
    gameActions.setVariable("testVar", 42),
  );
  addButton(stateFolder, "Toggle testSwitch", () =>
    gameActions.setSwitch("testSwitch", true),
  );
}

export function registerLiveMonitorTicker(
  debugPanelState: DebugPanelState,
  pixiApplication: Application,
): void {
  const monitor = debugPanelState.liveMonitor;

  pixiApplication.ticker.add(() => {
    monitor.fps = Math.round(pixiApplication.ticker.FPS);
  });
}

export function refreshGameStoreBindings(
  debugPanelState: DebugPanelState,
  gameStore: GameStore,
): void {
  const folder = debugPanelState.gameStoreFolder;

  for (const child of [...folder.children]) {
    folder.remove(child);
  }

  if (gameStore.variables.size > 0) {
    const variablesFolder = folder.addFolder({
      title: "Variables",
      expanded: true,
    });
    const variablesSnapshot: Record<string, number> = {};
    for (const [variableName, value] of gameStore.variables) {
      variablesSnapshot[variableName] = value;
    }
    for (const variableName of Object.keys(variablesSnapshot)) {
      variablesFolder.addBinding(variablesSnapshot, variableName, {
        readonly: true,
      });
    }
  }

  if (gameStore.switches.size > 0) {
    const switchesFolder = folder.addFolder({
      title: "Switches",
      expanded: true,
    });
    const switchesSnapshot: Record<string, boolean> = {};
    for (const [switchName, isEnabled] of gameStore.switches) {
      switchesSnapshot[switchName] = isEnabled;
    }
    for (const switchName of Object.keys(switchesSnapshot)) {
      switchesFolder.addBinding(switchesSnapshot, switchName, {
        readonly: true,
      });
    }
  }

  if (gameStore.characters.size > 0) {
    const charactersFolder = folder.addFolder({
      title: "Characters",
      expanded: false,
    });
    for (const [characterId, character] of gameStore.characters) {
      charactersFolder.addBlade({
        view: "text",
        label: characterId,
        value: character.displayName,
        parse: (value: string) => value,
      });
    }
  }
}

export function disposeDebugPanel(debugPanelState: DebugPanelState): void {
  debugPanelState.pane.dispose();
}
