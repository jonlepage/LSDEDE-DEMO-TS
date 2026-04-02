/**
 * i18n integration — bridges LSDE dictionary data with i18next for runtime language switching.
 * Placeholder until i18next is installed and configured.
 */

export const SUPPORTED_LANGUAGES = ["en", "fr"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export let currentLanguage: SupportedLanguage = "en";

export function setCurrentLanguage(language: SupportedLanguage): void {
  currentLanguage = language;
}
