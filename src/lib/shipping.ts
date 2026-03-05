export type DeliveryMode = "home" | "relay";

export type ShippingQuote = {
  code: "relay_boxtal" | "home_standard" | "home_express";
  mode: DeliveryMode;
  label: string;
  description: string;
  amount: number;
  isFree: boolean;
  estimateMinBusinessDays: number;
  estimateMaxBusinessDays: number;
};

type ShippingQuoteInput = {
  subtotal: number;
};

const relayFreeThreshold = 7900;
const homeFreeThreshold = 11900;

function makeQuote(
  quote: Omit<ShippingQuote, "isFree">,
): ShippingQuote {
  return {
    ...quote,
    isFree: quote.amount === 0,
  };
}

export function getShippingQuotes(
  mode: DeliveryMode,
  input: ShippingQuoteInput,
) {
  const { subtotal } = input;

  if (mode === "relay") {
    return [
      makeQuote({
        code: "relay_boxtal",
        mode,
        label: "Point relais Boxtal",
        description:
          subtotal >= relayFreeThreshold
            ? "Offert a partir de 79 EUR"
            : "Economique, retrait en point relais",
        amount: subtotal >= relayFreeThreshold ? 0 : 390,
        estimateMinBusinessDays: 2,
        estimateMaxBusinessDays: 5,
      }),
    ];
  }

  return [
    makeQuote({
      code: "home_standard",
      mode,
      label: "Livraison standard",
      description:
        subtotal >= homeFreeThreshold
          ? "Offerte a partir de 119 EUR"
          : "Livraison domicile suivie",
      amount: subtotal >= homeFreeThreshold ? 0 : 590,
      estimateMinBusinessDays: 2,
      estimateMaxBusinessDays: 5,
    }),
    makeQuote({
      code: "home_express",
      mode,
      label: "Livraison express",
      description: "Traitement prioritaire et livraison acceleree",
      amount: 990,
      estimateMinBusinessDays: 1,
      estimateMaxBusinessDays: 2,
    }),
  ];
}

export function getCheapestShippingQuote(
  mode: DeliveryMode,
  input: ShippingQuoteInput,
) {
  const quotes = getShippingQuotes(mode, input);
  return quotes.reduce((best, current) =>
    current.amount < best.amount ? current : best,
  );
}

export function getShippingThresholdMessage(mode: DeliveryMode) {
  if (mode === "relay") {
    return "Point relais offert a partir de 79 EUR.";
  }

  return "Livraison standard offerte a partir de 119 EUR.";
}
