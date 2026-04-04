/**
 * i18n integration — centralized locale state for runtime language switching.
 * All handlers and demos read `currentLanguage` at call time so switching
 * takes effect immediately without resetting the scene.
 */

export const SUPPORTED_LANGUAGES = ["en", "fr", "ja", "zh"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export let currentLanguage: SupportedLanguage = "en";

export function setCurrentLanguage(language: SupportedLanguage): void {
  currentLanguage = language;
}
