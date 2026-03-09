export function formatPrice(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

const languageCodeMap: Record<string, string> = {
  Francais: "FR",
  Japonnais: "JP",
  Coreen: "KR",
  Chinois: "CN",
};

const languageFlagEmojiMap: Record<string, string> = {
  Francais: "\uD83C\uDDEB\uD83C\uDDF7",
  Japonnais: "\uD83C\uDDEF\uD83C\uDDF5",
  Coreen: "\uD83C\uDDF0\uD83C\uDDF7",
  Chinois: "\uD83C\uDDE8\uD83C\uDDF3",
};

export function formatLanguageCode(language?: string) {
  if (!language) {
    return "";
  }
  return languageCodeMap[language] || language;
}

export function getLanguageFlagEmoji(language?: string) {
  if (!language) {
    return "";
  }
  return languageFlagEmojiMap[language] || "";
}
