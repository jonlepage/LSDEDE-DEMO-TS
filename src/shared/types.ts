/**
 * Cross-layer type definitions shared between engine, renderer, and demos.
 */

export interface DemoManifestEntry {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly blueprintPath: string;
}

export interface CharacterDefinition {
	readonly characterId: string;
	readonly displayName: string;
	readonly spriteColor: string;
}
