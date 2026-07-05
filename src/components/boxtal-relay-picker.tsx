"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ShippingRelayPoint } from "@/lib/types";

type BoxtalAddress = {
  country: string;
  zipCode: string;
  city: string;
  street?: string;
};

type BoxtalParcelPoint = {
  code: string;
  name: string;
  network?: string;
  location?: {
    address?: BoxtalAddress;
    position?: {
      latitude: number;
      longitude: number;
    };
  };
  address?: Partial<BoxtalAddress>;
  postalCode?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  street?: string;
};

type BoxtalMapsInstance = {
  onSearchParcelPointsResponse: (
    callback: (parcelPointsResponse: unknown) => void,
  ) => void;
  searchParcelPoints: (
    address: BoxtalAddress,
    callback: (selectedParcelPoint: BoxtalParcelPoint) => void,
  ) => void;
  clearParcelPoints: () => void;
};

type BoxtalNetworkCode =
  | "MONR_NETWORK"
  | "CHRP_NETWORK"
  | "UPSE_NETWORK"
  | "SOGP_NETWORK"
  | "DHLE_NETWORK"
  | "COPR_NETWORK";

declare global {
  interface Window {
    BoxtalParcelPointMap?: {
      BoxtalParcelPointMap: new (opts: {
        debug?: boolean;
        domToLoadMap: string;
        accessToken: string;
        config?: {
          locale?: "fr" | "en";
          parcelPointNetworks?: Array<{
            code: BoxtalNetworkCode;
          }>;
          options: {
            autoSelectNearestParcelPoint: boolean;
            primaryColor: string;
            postalCodeCityInput?: boolean;
          };
        };
        onMapLoaded?: () => void;
      }) => BoxtalMapsInstance;
    };
  }
}

const boxtalScriptSrc =
  "https://maps.boxtal.com/app/v3/assets/dependencies/@boxtal/parcel-point-map/dist/index.global.js";

const mapContainerId = "boxtal-relay-map";
const defaultBoxtalNetworks: Array<{ code: BoxtalNetworkCode }> = [
  { code: "MONR_NETWORK" },
  { code: "CHRP_NETWORK" },
  { code: "UPSE_NETWORK" },
  { code: "SOGP_NETWORK" },
  { code: "DHLE_NETWORK" },
  { code: "COPR_NETWORK" },
];

const mapConfigNetworksFallback = defaultBoxtalNetworks;

const boxtalDebugNoResponseMessage =
  "La carte n'a pas renvoye de relais. Reessaie dans quelques secondes ou utilise une autre adresse.";

const boxtalNoResultMessage =
  "Aucun point relais trouve pour cette adresse. Essaie une autre ville/code postal.";

const boxtalNetworkSet = new Set<BoxtalNetworkCode>([
  "MONR_NETWORK",
  "CHRP_NETWORK",
  "UPSE_NETWORK",
  "SOGP_NETWORK",
  "DHLE_NETWORK",
  "COPR_NETWORK",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

function readNestedRecord(
  value: unknown,
  key: string,
): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const nested = value[key];
  return isRecord(nested) ? nested : undefined;
}

function readBoxtalNetworkConfig():
  | Array<{ code: BoxtalNetworkCode }>
  | undefined {
  const raw = process.env.NEXT_PUBLIC_BOXTAL_MAP_NETWORKS;
  if (!raw) return undefined;

  const networks = raw
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry): entry is BoxtalNetworkCode =>
      boxtalNetworkSet.has(entry as BoxtalNetworkCode),
    )
    .map((code) => ({ code }));

  return networks.length > 0 ? networks : undefined;
}

function readBoxtalResponseError(response: unknown) {
  if (!isRecord(response)) return null;
  if (typeof response.error === "string" && response.error.trim()) {
    return response.error.trim();
  }
  const messages = response.messages;
  if (Array.isArray(messages)) {
    const text = messages
      .map((message) =>
        isRecord(message) && typeof message.text === "string"
          ? message.text
          : null,
      )
      .filter((value): value is string => Boolean(value))
      .join(" - ");
    if (text) return text;
  }
  return null;
}

async function loadBoxtalScript() {
  if (window.BoxtalParcelPointMap?.BoxtalParcelPointMap) {
    return;
  }
  const existing = document.querySelector(
    `script[src="${boxtalScriptSrc}"]`,
  ) as HTMLScriptElement | null;
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      if (
        window.BoxtalParcelPointMap?.BoxtalParcelPointMap ||
        existing.getAttribute("data-loaded") === "true"
      ) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Script error")), {
        once: true,
      });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = boxtalScriptSrc;
    script.async = true;
    script.onload = () => {
      script.setAttribute("data-loaded", "true");
      resolve();
    };
    script.onerror = () => reject(new Error("Script load failed"));
    document.body.appendChild(script);
  });
}

function translateRelaySelectionError(message: string) {
  if (/zip code|postal/i.test(message)) {
    return "Le point relais selectionne n'a pas renvoye de code postal exploitable. Choisis-le dans la liste ou relance la recherche.";
  }
  if (/city/i.test(message)) {
    return "Le point relais selectionne n'a pas renvoye de ville exploitable. Choisis-le dans la liste ou relance la recherche.";
  }
  if (/invalid relay point|validation/i.test(message)) {
    return "Ce point relais n'a pas pu etre valide. Relance la recherche ou choisis un autre relais.";
  }
  return message;
}

function translateBoxtalInitError(message: string) {
  if (/token|unavailable|credential|unauthorized|forbidden|boxtal relay map/i.test(message)) {
    return "La carte des points relais est momentanement indisponible. Reessaie dans quelques minutes.";
  }
  if (/script|component|composant|map/i.test(message)) {
    return "La carte des points relais n'a pas pu se charger. Reessaie dans quelques minutes.";
  }
  return message;
}

function normalizeRelayPoint(
  point: BoxtalParcelPoint,
  fallbackAddress?: Partial<Omit<BoxtalAddress, "country">>,
): ShippingRelayPoint {
  const root = point as unknown as Record<string, unknown>;
  const location = readNestedRecord(root, "location");
  const locationAddress = readNestedRecord(location, "address");
  const rootAddress = readNestedRecord(root, "address");
  const address = locationAddress || rootAddress || {};
  const position = readNestedRecord(location, "position") || root;
  const latitude = Number(readString(position.latitude, root.latitude));
  const longitude = Number(readString(position.longitude, root.longitude));

  return {
    code: readString(root.code, root.parcelPointCode, root.id) || "",
    name:
      readString(root.name, root.company, root.tradeName, root.label) ||
      "Point relais",
    network: readString(root.network, root.networkCode),
    address: {
      line1: readString(
        address.street,
        address.line1,
        address.address,
        root.street,
      ),
      zipCode: readString(
        address.zipCode,
        address.postalCode,
        root.zipCode,
        root.postalCode,
        fallbackAddress?.zipCode,
      ),
      city: readString(address.city, root.city, fallbackAddress?.city),
      country: readString(address.country, root.country) || "FR",
    },
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
  };
}

type BoxtalRelayPickerProps = {
  onSelect: (relayPoint: ShippingRelayPoint | null) => void;
};

export function BoxtalRelayPicker({ onSelect }: BoxtalRelayPickerProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [loadingToken, setLoadingToken] = useState(true);
  const [searching, setSearching] = useState(false);
  const [signingSelection, setSigningSelection] = useState(false);
  const [resultsCount, setResultsCount] = useState<number | null>(null);
  const [relayCandidates, setRelayCandidates] = useState<BoxtalParcelPoint[]>(
    [],
  );
  const [selectedPoint, setSelectedPoint] = useState<ShippingRelayPoint | null>(
    null,
  );
  const mapRef = useRef<BoxtalMapsInstance | null>(null);
  const onSelectRef = useRef(onSelect);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchAddressRef = useRef<Omit<BoxtalAddress, "country"> | null>(
    null,
  );
  const activeCountryRef = useRef<"FR" | "FRA">("FR");
  const retriedWithFraRef = useRef(false);
  const [address, setAddress] = useState({
    zipCode: "",
    city: "",
    street: "",
  });

  const canSearch = useMemo(
    () => Boolean(address.zipCode.trim() && address.city.trim() && ready),
    [address.zipCode, address.city, ready],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const selectRelayPoint = useCallback(async (point: BoxtalParcelPoint) => {
    const normalized = normalizeRelayPoint(
      point,
      lastSearchAddressRef.current || undefined,
    );
    if (!normalized.code || !normalized.name) {
      setError("Ce point relais est incomplet. Relance la recherche.");
      return;
    }

    setSigningSelection(true);
    setSelectedPoint(normalized);
    onSelectRef.current(null);

    try {
      const response = await fetch("/api/boxtal/relay-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relayPoint: normalized }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.relayPoint?.selectionToken) {
        throw new Error(
          payload?.error || "Validation du point relais impossible",
        );
      }
      setSelectedPoint(payload.relayPoint);
      onSelectRef.current(payload.relayPoint);
      setError("");
    } catch (selectionError) {
      const message =
        selectionError instanceof Error
          ? selectionError.message
          : "Validation du point relais impossible";
      setError(
        translateRelaySelectionError(message),
      );
    } finally {
      setSigningSelection(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoadingToken(true);
        const tokenResponse = await fetch("/api/boxtal/token");
        const tokenPayload = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenPayload?.accessToken) {
          throw new Error(
            translateBoxtalInitError(
              tokenPayload?.error || "Token Boxtal indisponible",
            ),
          );
        }

        await loadBoxtalScript();
        if (cancelled) return;

        const Constructor = window.BoxtalParcelPointMap?.BoxtalParcelPointMap;
        if (!Constructor) {
          throw new Error("Composant carte Boxtal indisponible");
        }

        const configuredNetworks =
          readBoxtalNetworkConfig() || mapConfigNetworksFallback;
        const mapConfig = {
          locale: "fr" as const,
          parcelPointNetworks: configuredNetworks,
          options: {
            autoSelectNearestParcelPoint: false,
            primaryColor: "#ff6b35",
            postalCodeCityInput: false,
          },
        };

        mapRef.current = new Constructor({
          debug: process.env.NEXT_PUBLIC_BOXTAL_MAP_DEBUG === "1",
          domToLoadMap: `#${mapContainerId}`,
          accessToken: tokenPayload.accessToken,
          config: mapConfig,
          onMapLoaded: () => {
            if (!cancelled) {
              setReady(true);
            }
          },
        });

        mapRef.current.onSearchParcelPointsResponse((response) => {
          if (cancelled) return;

          if (Array.isArray(response)) {
            setResultsCount(response.length);
            setRelayCandidates(
              response.filter((point): point is BoxtalParcelPoint =>
                isRecord(point),
              ) as BoxtalParcelPoint[],
            );
            if (
              response.length === 0 &&
              activeCountryRef.current === "FR" &&
              !retriedWithFraRef.current &&
              lastSearchAddressRef.current
            ) {
              retriedWithFraRef.current = true;
              activeCountryRef.current = "FRA";
              mapRef.current?.searchParcelPoints(
                { ...lastSearchAddressRef.current, country: "FRA" },
                (selected) => {
                  void selectRelayPoint(selected);
                },
              );
              return;
            }

            if (response.length === 0) {
              setError(boxtalNoResultMessage);
            }
            if (searchTimeoutRef.current) {
              clearTimeout(searchTimeoutRef.current);
              searchTimeoutRef.current = null;
            }
            setSearching(false);
            return;
          }

          const boxtalError = readBoxtalResponseError(response);
          if (boxtalError) {
            setError(`Recherche Boxtal impossible: ${boxtalError}`);
            if (searchTimeoutRef.current) {
              clearTimeout(searchTimeoutRef.current);
              searchTimeoutRef.current = null;
            }
            setSearching(false);
          }
        });
      } catch (initError) {
        if (!cancelled) {
          const message =
            initError instanceof Error
              ? initError.message
              : "Initialisation Boxtal impossible";
          setError(
            translateBoxtalInitError(message),
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingToken(false);
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      mapRef.current = null;
    };
  }, [selectRelayPoint]);

  async function handleSearchRelay() {
    if (!mapRef.current) return;
    setError("");
    setSearching(true);
    setResultsCount(null);
    setRelayCandidates([]);
    setSelectedPoint(null);
    retriedWithFraRef.current = false;
    activeCountryRef.current = "FR";
    onSelectRef.current(null);

    const normalizedAddress = {
      zipCode: address.zipCode.trim(),
      city: address.city.trim(),
      street: address.street.trim() || undefined,
    };
    lastSearchAddressRef.current = normalizedAddress;

    try {
      mapRef.current.clearParcelPoints();
      mapRef.current.searchParcelPoints(
        {
          country: "FR",
          ...normalizedAddress,
        },
        (selected) => {
          void selectRelayPoint(selected);
        },
      );

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        setSearching(false);
        setError(boxtalDebugNoResponseMessage);
      }, 12000);
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Recherche point relais impossible",
      );
      setSearching(false);
    }
  }

  const relayCandidateRows = relayCandidates
    .map((point) => ({
      point,
      relayPoint: normalizeRelayPoint(
        point,
        lastSearchAddressRef.current || undefined,
      ),
    }))
    .filter(({ relayPoint }) => Boolean(relayPoint.code && relayPoint.name));

  return (
    <div className="manga-panel manga-dot space-y-3 rounded-2xl bg-white p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
        Point relais
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <input
          value={address.zipCode}
          onChange={(event) =>
            setAddress((prev) => ({ ...prev, zipCode: event.target.value }))
          }
          placeholder="Code postal"
          className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
        />
        <input
          value={address.city}
          onChange={(event) =>
            setAddress((prev) => ({ ...prev, city: event.target.value }))
          }
          placeholder="Ville"
          className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
        />
        <input
          value={address.street}
          onChange={(event) =>
            setAddress((prev) => ({ ...prev, street: event.target.value }))
          }
          placeholder="Rue (optionnel)"
          className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSearchRelay}
          disabled={!canSearch || loadingToken || searching || signingSelection}
          className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {searching ? "Recherche..." : "Chercher un point relais"}
        </button>
        {loadingToken ? (
          <p className="text-xs text-slate-500">Chargement de la carte...</p>
        ) : null}
        {resultsCount !== null ? (
          <p className="text-xs text-slate-500">
            {resultsCount} relais disponible{resultsCount > 1 ? "s" : ""}.
          </p>
        ) : null}
        {signingSelection ? (
          <p className="text-xs text-slate-500">Validation en cours...</p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      <div
        className={`grid gap-3 ${
          relayCandidateRows.length > 0
            ? "lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]"
            : ""
        }`}
      >
        <div
          id={mapContainerId}
          className="h-[340px] overflow-hidden rounded-2xl border border-black/10 bg-slate-100"
        />
        {relayCandidateRows.length > 0 ? (
          <div className="max-h-[340px] space-y-2 overflow-y-auto rounded-2xl border border-black/10 bg-white p-2">
            {relayCandidateRows.map(({ point, relayPoint }) => {
              const isSelected = selectedPoint?.code === relayPoint.code;

              return (
                <button
                  key={relayPoint.code}
                  type="button"
                  onClick={() => void selectRelayPoint(point)}
                  disabled={signingSelection}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 ${
                    isSelected
                      ? "border-emerald-400 bg-white shadow-[inset_0_0_0_1px_rgba(16,185,129,0.35)]"
                      : "border-black/10 bg-white text-slate-700"
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900">
                        {relayPoint.name}
                      </span>
                      <span className="mt-1 block text-slate-500">
                        {relayPoint.address?.line1
                          ? `${relayPoint.address.line1}, `
                          : ""}
                        {relayPoint.address?.zipCode || ""}{" "}
                        {relayPoint.address?.city || ""}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${
                        isSelected ? "bg-emerald-600" : "bg-black"
                      }`}
                    >
                      {isSelected ? "Choisi" : "Choisir"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {selectedPoint ? (
        <div className="rounded-xl border border-emerald-300 bg-white p-3 text-xs text-slate-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]">
          <p className="font-semibold">Relais choisi: {selectedPoint.name}</p>
          <p>
            {selectedPoint.address?.line1
              ? `${selectedPoint.address.line1}, `
              : ""}
            {selectedPoint.address?.zipCode || ""} {selectedPoint.address?.city || ""}
          </p>
          <p>
            Code: {selectedPoint.code}
            {selectedPoint.network ? ` - ${selectedPoint.network}` : ""}
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Aucun relais choisi pour le moment.
        </p>
      )}
    </div>
  );
}
