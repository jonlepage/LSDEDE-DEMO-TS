import { createApplicationLayout } from "./app/layout";
import { createPixiApplication } from "./renderer/stage";
import { createCharacterSprite } from "./renderer/characters";
import {
  createMovementState,
  setMovementTarget,
  registerMovementTicker,
} from "./renderer/movement";
import { createCollidable, resolveCollisions } from "./renderer/collision";
import { createCamera, setCameraFollowTarget } from "./renderer/camera";
import {
  createDebugPanel,
  registerLiveMonitorTicker,
  registerActionButtons,
} from "./debug/debug-panel";
import {
  createGameActionFacade,
  type CharacterReference,
} from "./game/game-actions";
import { createGameStore } from "./game/game-store";
import type { CollidableSprite } from "./renderer/collision";

const PLAYER_COLOR = 0xffffff;
const NPC_COLORS = [0xff6b6b, 0x4ecdc4, 0xffe66d];
const NPC_NAMES = ["npc-red", "npc-teal", "npc-yellow"];

(async () => {
  const { canvasContainer } = createApplicationLayout();
  const pixiApplication = await createPixiApplication(canvasContainer);

  const cameraState = createCamera(pixiApplication);
  const worldContainer = cameraState.worldContainer;
  const gameStore = createGameStore();
  const characters = new Map<string, CharacterReference>();

  const screenCenterX = pixiApplication.screen.width / 2;
  const screenCenterY = pixiApplication.screen.height / 2;

  const playerMovementState = createMovementState();
  const playerSprite = await createCharacterSprite({
    characterId: "player",
    displayName: "Player",
    tintColor: PLAYER_COLOR,
    startX: screenCenterX,
    startY: screenCenterY,
  });
  worldContainer.addChild(playerSprite);
  characters.set("player", {
    characterId: "player",
    sprite: playerSprite,
    movementState: playerMovementState,
  });

  const npcObstacles: CollidableSprite[] = [];

  for (let npcIndex = 0; npcIndex < 3; npcIndex++) {
    const npcMovementState = createMovementState();
    const npcSprite = await createCharacterSprite({
      characterId: NPC_NAMES[npcIndex],
      displayName: NPC_NAMES[npcIndex],
      tintColor: NPC_COLORS[npcIndex],
      startX: screenCenterX - 200 + npcIndex * 200,
      startY: screenCenterY - 100 + npcIndex * 60,
    });
    worldContainer.addChild(npcSprite);
    npcObstacles.push(createCollidable(npcSprite));
    characters.set(NPC_NAMES[npcIndex], {
      characterId: NPC_NAMES[npcIndex],
      sprite: npcSprite,
      movementState: npcMovementState,
    });
  }

  const playerCollidable = createCollidable(playerSprite);

  registerMovementTicker(
    pixiApplication,
    playerSprite,
    playerMovementState,
    (proposedX: number, proposedY: number) =>
      resolveCollisions(playerCollidable, proposedX, proposedY, npcObstacles),
  );

  setCameraFollowTarget(cameraState, playerSprite);

  const gameActions = createGameActionFacade({
    pixiApplication,
    cameraState,
    worldContainer,
    gameStore,
    characters,
  });

  const debugPanelState = createDebugPanel();
  registerLiveMonitorTicker(debugPanelState, pixiApplication);
  registerActionButtons(debugPanelState, gameActions, "npc-red");

  pixiApplication.stage.eventMode = "static";
  pixiApplication.stage.hitArea = pixiApplication.screen;

  pixiApplication.stage.on("pointerdown", (event) => {
    const worldPosition = worldContainer.toLocal(event.global);
    setMovementTarget(playerMovementState, worldPosition.x, worldPosition.y);
  });
})();
