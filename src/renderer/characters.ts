/**
 * Character sprite factory — creates colored bunny sprites from definitions.
 */

import { Assets, Sprite } from "pixi.js";
import type { CharacterDefinition } from "../shared/types";

export async function createCharacterSprite(
  characterDefinition: CharacterDefinition,
): Promise<Sprite> {
  const bunnyTexture = await Assets.load("/assets/bunnies/bunny.png");
  const characterSprite = new Sprite(bunnyTexture);

  characterSprite.anchor.set(0.5);
  characterSprite.tint = characterDefinition.spriteColor;
  characterSprite.label = characterDefinition.characterId;

  return characterSprite;
}
