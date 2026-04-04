const FALLBACK_LOCALE = "fr";
export function translate(
	record: Record<string, string> | undefined,
	locale: string,
): string {
	return record?.[locale] || record?.[FALLBACK_LOCALE] || "";
}
