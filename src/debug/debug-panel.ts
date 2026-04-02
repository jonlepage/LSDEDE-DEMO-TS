/**
 * Debug panel powered by Tweakpane.
 * Provides real-time inspection and control of game state, engine state, and rendering.
 * This panel is for development only — not part of the demo UI.
 */

import { Pane } from "tweakpane";
import type { FolderApi, ListBladeApi } from "tweakpane";
import type { Application } from "pixi.js";
import type { GameStore } from "../game/game-store";
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
