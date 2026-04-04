/**
 * Character sprite factory — creates colored bunny sprites.
 * Player and NPC bunnies use the same base texture, differentiated by tint color.
 */

import { Assets, Sprite, Texture } from "pixi.js";

const BUNNY_TEXTURE_PATH = `${import.meta.env.BASE_URL}assets/bunny.png`;

export interface CharacterSpriteOptions {
  readonly characterId: string;
  readonly displayName: string;
  readonly tintColor: number;
  readonly startX: number;
  readonly startY: number;
  readonly scale?: number;
}

let cachedBunnyTexture: Texture | null = null;

async function loadBunnyTexture(): Promise<Texture> {
  if (!cachedBunnyTexture) {
    cachedBunnyTexture = await Assets.load<Texture>(BUNNY_TEXTURE_PATH);
  }
  return cachedBunnyTexture;
}

export async function createCharacterSprite(
  options: CharacterSpriteOptions,
): Promise<Sprite> {
  const bunnyTexture = await loadBunnyTexture();
  const characterSprite = new Sprite(bunnyTexture);

  characterSprite.anchor.set(0.5, 1);
  characterSprite.tint = options.tintColor;
  characterSprite.label = options.characterId;
  characterSprite.position.set(options.startX, options.startY);

  // Scale up so bunnies are more visible on screen
  characterSprite.scale.set(options.scale ?? 2);

  return characterSprite;
}
