/**
 * Shared scene setup — party recruitment mechanic.
 * Player walks near each party NPC and clicks to add them to the party.
 *
 * On recruitment:
 *  - The NPC is added to the party via gameActions.addToParty().
 *  - The NPC is removed from npcObstacles so it no longer blocks the player.
 *  - The recruit hint is destroyed.
 *  - onMemberRecruited() is called so the scene can update its own state
 *    (e.g. debug monitor, console log).
 */

import { Text } from "pixi.js";
import type {
  CharacterReference,
  GameActionFacade,
} from "../../game/game-actions";
import type { CollidableSprite } from "../../renderer/collision";
import type { SceneContext } from "../../shared/scene-context";

const DEFAULT_INTERACTION_DISTANCE = 80;

export interface SetupPartyRecruitmentOptions {
  readonly playerReference: CharacterReference;
  readonly partyNpcIds: ReadonlyArray<string>;
  readonly characters: Map<string, CharacterReference>;
  /** Mutable — recruited NPCs are spliced out so they no longer block the player. */
  readonly npcObstacles: CollidableSprite[];
  readonly sceneContext: SceneContext;
  readonly interactionDistance?: number;
  readonly gameActions: GameActionFacade;
  readonly onMemberRecruited?: (characterId: string) => void;
}

export function setupPartyRecruitment(
  options: SetupPartyRecruitmentOptions,
): void {
  const {
    playerReference,
    partyNpcIds,
    characters,
    npcObstacles,
    sceneContext,
    interactionDistance = DEFAULT_INTERACTION_DISTANCE,
    gameActions,
    onMemberRecruited,
  } = options;

  for (const characterId of partyNpcIds) {
    const characterRef = characters.get(characterId);
    if (!characterRef) continue;

    const recruitHint = new Text({
      text: "🐰 join!",
      style: { fontSize: 12, fill: "#ffffff" },
    });
    recruitHint.anchor.set(0.5, 1);
    recruitHint.position.set(0, -(characterRef.sprite.height / 2 + 4));
    recruitHint.visible = false;
    characterRef.sprite.addChild(recruitHint);

    // Show hint only while in range and not yet recruited.
    sceneContext.addTickerCallback(() => {
      if (gameActions.isInParty(characterId)) return;
      const deltaX = playerReference.sprite.x - characterRef.sprite.x;
      const deltaY = playerReference.sprite.y - characterRef.sprite.y;
      recruitHint.visible =
        Math.sqrt(deltaX * deltaX + deltaY * deltaY) < interactionDistance;
    });

    characterRef.sprite.eventMode = "static";
    characterRef.sprite.cursor = "pointer";
    characterRef.sprite.on("pointerdown", () => {
      if (gameActions.isInParty(characterId)) return;
      const deltaX = playerReference.sprite.x - characterRef.sprite.x;
      const deltaY = playerReference.sprite.y - characterRef.sprite.y;
      if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) >= interactionDistance)
        return;

      gameActions.addToParty(characterId);

      const obstacleIndex = npcObstacles.findIndex(
        (collidable) => collidable.sprite === characterRef.sprite,
      );
      if (obstacleIndex !== -1) npcObstacles.splice(obstacleIndex, 1);

      recruitHint.visible = false;
      recruitHint.destroy();
      onMemberRecruited?.(characterId);
    });
  }
}
