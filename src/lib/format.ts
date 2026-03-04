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

export function formatLanguageCode(language?: string) {
  if (!language) {
    return "";
  }
  return languageCodeMap[language] || language;
}
