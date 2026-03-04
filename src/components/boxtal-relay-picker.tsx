"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
};

type BoxtalMapsInstance = {
  onSearchParcelPointsResponse: (
    callback: (parcelPointsResponse: unknown[]) => void,
  ) => void;
  searchParcelPoints: (
    address: BoxtalAddress,
    callback: (selectedParcelPoint: BoxtalParcelPoint) => void,
  ) => void;
  clearParcelPoints: () => void;
};

declare global {
  interface Window {
    BoxtalParcelPointMap?: {
      BoxtalParcelPointMap: new (opts: {
        debug?: boolean;
        domToLoadMap: string;
        accessToken: string;
        config?: {
          locale?: "fr" | "en";
          parcelPointNetworks: Array<{
            code:
              | "MONR_NETWORK"
              | "CHRP_NETWORK"
              | "UPSE_NETWORK"
              | "SOGP_NETWORK"
              | "DHLE_NETWORK"
              | "COPR_NETWORK";
          }>;
          options: {
            autoSelectNearestParcelPoint: boolean;
            primaryColor: string;
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

function normalizeRelayPoint(point: BoxtalParcelPoint): ShippingRelayPoint {
  return {
    code: point.code,
    name: point.name,
    network: point.network,
    address: {
      line1: point.location?.address?.street || undefined,
      zipCode: point.location?.address?.zipCode || undefined,
      city: point.location?.address?.city || undefined,
      country: point.location?.address?.country || "FR",
    },
    latitude: point.location?.position?.latitude,
    longitude: point.location?.position?.longitude,
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
  const [resultsCount, setResultsCount] = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<ShippingRelayPoint | null>(
    null,
  );
  const mapRef = useRef<BoxtalMapsInstance | null>(null);
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
    let cancelled = false;

    async function init() {
      try {
        setLoadingToken(true);
        const tokenResponse = await fetch("/api/boxtal/token");
        const tokenPayload = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenPayload?.accessToken) {
          throw new Error(tokenPayload?.error || "Token Boxtal indisponible");
        }

        await loadBoxtalScript();
        if (cancelled) return;

        const Constructor = window.BoxtalParcelPointMap?.BoxtalParcelPointMap;
        if (!Constructor) {
          throw new Error("Composant carte Boxtal indisponible");
        }

        mapRef.current = new Constructor({
          domToLoadMap: `#${mapContainerId}`,
          accessToken: tokenPayload.accessToken,
          config: {
            locale: "fr",
            parcelPointNetworks: [
              { code: "MONR_NETWORK" },
              { code: "CHRP_NETWORK" },
              { code: "UPSE_NETWORK" },
              { code: "SOGP_NETWORK" },
              { code: "DHLE_NETWORK" },
              { code: "COPR_NETWORK" },
            ],
            options: {
              autoSelectNearestParcelPoint: true,
              primaryColor: "#ff6b35",
            },
          },
          onMapLoaded: () => {
            if (!cancelled) {
              setReady(true);
            }
          },
        });

        mapRef.current.onSearchParcelPointsResponse((response) => {
          if (!cancelled && Array.isArray(response)) {
            setResultsCount(response.length);
          }
        });
      } catch (initError) {
        if (!cancelled) {
          setError(
            initError instanceof Error
              ? initError.message
              : "Initialisation Boxtal impossible",
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
      mapRef.current = null;
    };
  }, []);

  async function handleSearchRelay() {
    if (!mapRef.current) return;
    setError("");
    setSearching(true);
    setSelectedPoint(null);
    onSelect(null);

    try {
      mapRef.current.clearParcelPoints();
      mapRef.current.searchParcelPoints(
        {
          country: "FR",
          zipCode: address.zipCode.trim(),
          city: address.city.trim(),
          street: address.street.trim() || undefined,
        },
        (selected) => {
          const normalized = normalizeRelayPoint(selected);
          setSelectedPoint(normalized);
          onSelect(normalized);
        },
      );
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Recherche point relais impossible",
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="manga-panel manga-dot space-y-3 rounded-2xl bg-white p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
        Point relais Boxtal
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
          disabled={!canSearch || loadingToken || searching}
          className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {searching ? "Recherche..." : "Chercher un point relais"}
        </button>
        {loadingToken ? (
          <p className="text-xs text-slate-500">Initialisation Boxtal...</p>
        ) : ready ? (
          <p className="text-xs text-emerald-700">Carte Boxtal prete.</p>
        ) : null}
        {resultsCount !== null ? (
          <p className="text-xs text-slate-500">
            {resultsCount} point{resultsCount > 1 ? "s" : ""} propose
            {resultsCount > 1 ? "s" : ""}.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      <div
        id={mapContainerId}
        className="h-[360px] overflow-hidden rounded-2xl border border-black/10 bg-slate-100"
      />

      {selectedPoint ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <p className="font-semibold">{selectedPoint.name}</p>
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
          Selectionne un point relais sur la carte apres la recherche.
        </p>
      )}
    </div>
  );
}
