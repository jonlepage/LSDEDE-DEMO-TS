/**
 * Shared scene setup — party follow formation mechanic.
 * Recruited party members trail the player each frame in a configurable formation.
 *
 * Each NPC in the formation has a fixed slot offset relative to the player.
 * The movement target is refreshed only when the member drifts past the
 * updateDistanceThreshold, avoiding constant target spam when already in position.
 *
 * Prerequisites:
 *  - Each party NPC must have its own registerMovementTicker already registered
 *    so the movement system can process the targets set here.
 *  - gameActions.isInParty() is checked each frame — only recruited members move.
 */

import { setMovementTarget } from "../../renderer/movement";
import type { CharacterReference, GameActionFacade } from "../../game/game-actions";
import type { SceneContext } from "../../shared/scene-context";

const DEFAULT_UPDATE_DISTANCE_THRESHOLD = 15;

export interface FormationOffset {
  readonly x: number;
  readonly y: number;
}

export interface SetupPartyFollowOptions {
  readonly playerReference: CharacterReference;
  readonly partyNpcIds: ReadonlyArray<string>;
  readonly characters: Map<string, CharacterReference>;
  /** Slot offsets keyed by characterId. Members without an entry are skipped. */
  readonly formationOffsets: Readonly<Record<string, FormationOffset>>;
  readonly sceneContext: SceneContext;
  /** Minimum distance from the slot before the target is refreshed (px). */
  readonly updateDistanceThreshold?: number;
  readonly gameActions: GameActionFacade;
}

export function setupPartyFollow(options: SetupPartyFollowOptions): void {
  const {
    playerReference,
    partyNpcIds,
    characters,
    formationOffsets,
    sceneContext,
    updateDistanceThreshold = DEFAULT_UPDATE_DISTANCE_THRESHOLD,
    gameActions,
  } = options;

  sceneContext.addTickerCallback(() => {
    for (const characterId of partyNpcIds) {
      if (!gameActions.isInParty(characterId)) continue;
      const characterRef = characters.get(characterId);
      if (!characterRef) continue;
      const offset = formationOffsets[characterId];
      if (!offset) continue;

      const slotX = playerReference.sprite.x + offset.x;
      const slotY = playerReference.sprite.y + offset.y;
      const deltaX = slotX - characterRef.sprite.x;
      const deltaY = slotY - characterRef.sprite.y;

      if (
        Math.sqrt(deltaX * deltaX + deltaY * deltaY) >
        updateDistanceThreshold
      ) {
        setMovementTarget(characterRef.movementState, slotX, slotY);
      }
    }
  });
}
