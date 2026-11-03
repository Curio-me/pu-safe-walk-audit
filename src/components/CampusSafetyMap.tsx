import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
  MapMouseEvent,
} from '@vis.gl/react-google-maps';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import type { LayersList } from '@deck.gl/core';
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Crosshair,
  EyeOff,
  Flame,
  LightbulbOff,
  MapPin,
  Navigation,
  ShieldAlert,
  ShieldCheck,
  ThumbsUp,
  Trees,
} from 'lucide-react';
import { SafetyReport } from '../types';
import {
  isInsidePUJurisdiction,
  isOutsidePUSectorText,
  PU_WHOLE_CAMPUS_BOUNDS,
  SimpleRectBox,
} from '../utils/puBounds';

function checkAndDispatchQuotaError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('QuotaExceededError') ||
    msg.includes('429')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

function hasWebGL2Support(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

export type CampusBoundsBox = SimpleRectBox;

export function isInsideBounds(
  coords: { lat: number; lng: number },
  _bounds?: CampusBoundsBox | null
): boolean {
  return isInsidePUJurisdiction(coords);
}

interface SafetyHeatmapOverlayProps {
  reports: SafetyReport[];
  visible: boolean;
  campusBounds: CampusBoundsBox | null;
}

/**
 * Modern Deck.gl HeatmapLayer + GoogleMapsOverlay implementation
 * restricted strictly to Panjab University jurisdiction reports.
 */
const SafetyHeatmapOverlay: React.FC<SafetyHeatmapOverlayProps> = ({
  reports,
  visible,
  campusBounds,
}) => {
  const map = useMap();
  const [webglAvailable] = useState<boolean>(() => hasWebGL2Support());
  const fallbackCirclesRef = useRef<google.maps.Circle[]>([]);

  const validReports = useMemo(
    () =>
      reports.filter(
        (r) =>
          r.location &&
          typeof r.location.lat === 'number' &&
          typeof r.location.lng === 'number' &&
          r.status !== 'resolved' &&
          isInsideBounds(r.location, campusBounds)
      ),
    [reports, campusBounds]
  );

  const deckOverlay = useMemo(() => {
    if (!webglAvailable) return null;
    try {
      return new GoogleMapsOverlay({ interleaved: true });
    } catch {
      return null;
    }
  }, [webglAvailable]);

  useEffect(() => {
    if (!deckOverlay || !map) return;
    try {
      deckOverlay.setMap(map);
    } catch {
      // Ignore WebGL context attach errors in restricted environments
    }
    return () => {
      try {
        deckOverlay.setMap(null);
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [deckOverlay, map]);

  const layers: LayersList = useMemo(() => {
    if (!visible || !deckOverlay || validReports.length === 0) return [];

    return [
      new HeatmapLayer<SafetyReport>({
        id: 'pu-safety-concerns-heatmap',
        data: validReports,
        getPosition: (d: SafetyReport) => [
          d.location!.lng,
          d.location!.lat,
        ],
        getWeight: (d: SafetyReport) => {
          const severityBoost =
            d.severity === 'critical' ? 1.6 : d.severity === 'high' ? 1.25 : 1;
          return Math.max(5, d.upvotes) * severityBoost;
        },
        radiusPixels: 75,
        intensity: 1.8,
        threshold: 0.03,
        colorRange: [
          [254, 240, 138, 130],
          [253, 186, 116, 175],
          [251, 146, 60, 210],
          [239, 68, 68, 235],
          [185, 28, 28, 255],
        ],
        aggregation: 'SUM',
      }),
    ];
  }, [visible, deckOverlay, validReports]);

  useEffect(() => {
    if (!deckOverlay) return;
    try {
      deckOverlay.setProps({ layers });
    } catch {
      // Ignore update errors if WebGL context lost
    }
  }, [deckOverlay, layers]);

  useEffect(() => {
    fallbackCirclesRef.current.forEach((c) => c.setMap(null));
    fallbackCirclesRef.current = [];

    if (!map || !visible || validReports.length === 0 || typeof google === 'undefined') {
      return;
    }

    const newCircles: google.maps.Circle[] = [];
    validReports.forEach((report) => {
      if (!report.location) return;
      const weight = Math.min(100, Math.max(15, report.upvotes));
      const baseRadius = 45 + weight * 1.1;

      const outerHalo = new google.maps.Circle({
        map,
        center: report.location,
        radius: baseRadius * 1.45,
        strokeWeight: 0,
        fillColor: report.severity === 'critical' ? '#ef4444' : '#f59e0b',
        fillOpacity: webglAvailable ? 0.12 : 0.24,
        clickable: false,
      });

      const innerCore = new google.maps.Circle({
        map,
        center: report.location,
        radius: baseRadius * 0.75,
        strokeWeight: 0,
        fillColor: report.severity === 'critical' ? '#dc2626' : '#ea580c',
        fillOpacity: webglAvailable ? 0.18 : 0.35,
        clickable: false,
      });

      newCircles.push(outerHalo, innerCore);
    });

    fallbackCirclesRef.current = newCircles;

    return () => {
      fallbackCirclesRef.current.forEach((c) => c.setMap(null));
      fallbackCirclesRef.current = [];
    };
  }, [map, visible, validReports, webglAvailable]);

  return null;
};

interface ReportMarkerItemProps {
  report: SafetyReport;
  isSelected: boolean;
  onSelect: (report: SafetyReport) => void;
  onClose: () => void;
  onUpvote: (reportId: string) => void;
  onInspectDetails: (report: SafetyReport) => void;
}

const ReportMarkerItem: React.FC<ReportMarkerItemProps> = ({
  report,
  isSelected,
  onSelect,
  onClose,
  onUpvote,
  onInspectDetails,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  if (!report.location) return null;

  const isResolved = report.status === 'resolved';

  const bgClass = isResolved
    ? 'bg-emerald-600 border-emerald-200 text-white'
    : report.category === 'dark_stretch'
      ? 'bg-amber-500 border-slate-950 text-slate-950'
      : 'bg-red-600 border-red-200 text-white';

  const getIcon = () => {
    if (isResolved) return <CheckCircle2 className="w-4 h-4" />;
    switch (report.category) {
      case 'dark_stretch':
        return <LightbulbOff className="w-4 h-4" />;
      case 'cctv_blind_spot':
        return <EyeOff className="w-4 h-4" />;
      case 'vehicular_harassment':
        return <ShieldAlert className="w-4 h-4" />;
      case 'canopy_obstruction':
        return <Trees className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={report.location}
        onClick={() => onSelect(report)}
        title={report.title}
      >
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 shadow-lg cursor-pointer transition-transform duration-150 hover:scale-105 ${bgClass}`}
        >
          {getIcon()}
          <span className="font-mono text-xs font-bold tabular-nums">
            {report.upvotes}
          </span>
        </div>
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={300}
          onCloseClick={onClose}
        >
          <div className="p-1 text-slate-900 font-sans">
            <div className="text-[11px] font-medium text-slate-500 mb-1">
              {report.corridorName}
            </div>
            <h4 className="text-sm font-bold text-slate-900 leading-snug mb-1.5">
              {report.title}
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              {report.description}
            </p>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => onUpvote(report.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>I Walk Here Too ({report.upvotes})</span>
              </button>
              <button
                type="button"
                onClick={() => onInspectDetails(report)}
                className="px-2 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-950 underline whitespace-nowrap shrink-0"
              >
                Add Comment
              </button>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface CampusGroundingAndRoutingControllerProps {
  reports: SafetyReport[];
  onLocationResolved: (
    reportId: string,
    location: { lat: number; lng: number },
    formattedAddress?: string,
    placeId?: string
  ) => void;
  selectedJumpTarget: { lat: number; lng: number } | null;
  onJumpCompleted: () => void;
  onCampusBoundsResolved: (bounds: CampusBoundsBox) => void;
}

const PLACES_CACHE_KEY = 'pu_safewalk_places_cache_v2';

interface CachedPlaceEntry {
  lat: number;
  lng: number;
  viewport?: SimpleRectBox;
  formattedAddress?: string;
  placeId?: string;
}

function readPlacesCache(): Record<string, CachedPlaceEntry> {
  try {
    const raw = localStorage.getItem(PLACES_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writePlaceToCache(queryKey: string, entry: CachedPlaceEntry): void {
  try {
    const current = readPlacesCache();
    current[queryKey] = entry;
    localStorage.setItem(PLACES_CACHE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage quota errors
  }
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CampusGroundingAndRoutingController: React.FC<
  CampusGroundingAndRoutingControllerProps
> = ({
  reports,
  onLocationResolved,
  selectedJumpTarget,
  onJumpCompleted,
  onCampusBoundsResolved,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const resolvedIdsRef = useRef<Record<string, boolean>>({});
  const quotaExhaustedRef = useRef(false);
  const campusCenteredRef = useRef(false);

  useEffect(() => {
    const onQuota = () => {
      quotaExhaustedRef.current = true;
    };
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  const searchPlaceWithCacheAndRetry = useCallback(
    async (textQuery: string): Promise<CachedPlaceEntry | null> => {
      if (!placesLib) return null;
      const cache = readPlacesCache();
      if (cache[textQuery]) {
        return cache[textQuery];
      }
      if (quotaExhaustedRef.current) {
        return null;
      }

      for (let attempt = 0; attempt < 2; attempt++) {
        if (quotaExhaustedRef.current) return null;
        try {
          if (attempt > 0) {
            await delayMs(1400);
          }
          const res = await placesLib.Place.searchByText({
            textQuery,
            fields: [
              'id',
              'displayName',
              'location',
              'viewport',
              'formattedAddress',
            ],
          });
          const first = res.places?.[0];
          if (!first?.location) return null;
          let viewportBox: SimpleRectBox | undefined;
          if (first.viewport) {
            const ne = first.viewport.getNorthEast();
            const sw = first.viewport.getSouthWest();
            viewportBox = {
              north: ne.lat(),
              south: sw.lat(),
              east: ne.lng(),
              west: sw.lng(),
            };
          }
          const entry: CachedPlaceEntry = {
            lat: first.location.lat(),
            lng: first.location.lng(),
            viewport: viewportBox,
            formattedAddress: first.formattedAddress || undefined,
            placeId: first.id || undefined,
          };
          writePlaceToCache(textQuery, entry);
          return entry;
        } catch (err) {
          checkAndDispatchQuotaError(err);
          if (quotaExhaustedRef.current) {
            return null;
          }
        }
      }
      return null;
    },
    [placesLib]
  );

  // 1. Frame the Google Map to Panjab University Campus (Sector 14 + Sector 25) + 500m surrounding perimeter
  useEffect(() => {
    if (!map || campusCenteredRef.current) return;
    campusCenteredRef.current = true;

    const wholePUBox: CampusBoundsBox = PU_WHOLE_CAMPUS_BOUNDS;
    onCampusBoundsResolved(wholePUBox);

    map.setOptions({
      restriction: {
        latLngBounds: wholePUBox,
        strictBounds: true,
      },
      minZoom: 14,
      maxZoom: 20,
    });

    const fitCampusToScreen = () => {
      map.fitBounds(wholePUBox, 8);
    };

    fitCampusToScreen();
    window.addEventListener('resize', fitCampusToScreen);

    return () => {
      window.removeEventListener('resize', fitCampusToScreen);
    };
  }, [map, onCampusBoundsResolved]);

  // 2. Sequentially resolve report locations with localStorage cache to prevent burst QPS rate limits
  useEffect(() => {
    if (!placesLib || quotaExhaustedRef.current) return;

    const unresolved = reports.filter(
      (r) => !r.location && r.placeSearchQuery && !resolvedIdsRef.current[r.id]
    );
    if (unresolved.length === 0) return;

    let cancelled = false;

    const resolveSequentially = async () => {
      // Wait briefly so Firestore's real-time snapshot can supply already-resolved coordinates first
      await delayMs(650);
      if (cancelled || quotaExhaustedRef.current) return;

      const cache = readPlacesCache();
      for (const report of unresolved) {
        if (cancelled || quotaExhaustedRef.current) break;
        if (report.location) continue;
        resolvedIdsRef.current[report.id] = true;

        const wasPrimaryCached = Boolean(cache[report.placeSearchQuery]);
        const primary = await searchPlaceWithCacheAndRetry(
          report.placeSearchQuery
        );
        if (!primary || quotaExhaustedRef.current) continue;

        if (!wasPrimaryCached) {
          await delayMs(350);
        }

        let finalLat = primary.lat;
        let finalLng = primary.lng;

        if (report.secondarySearchQuery && !quotaExhaustedRef.current) {
          const wasSecondaryCached = Boolean(
            cache[report.secondarySearchQuery]
          );
          const secondary = await searchPlaceWithCacheAndRetry(
            report.secondarySearchQuery
          );
          if (secondary) {
            finalLat = (finalLat + secondary.lat) / 2;
            finalLng = (finalLng + secondary.lng) / 2;
          }
          if (!wasSecondaryCached) {
            await delayMs(350);
          }
        }

        // Only update location if it falls inside Panjab University + 500m perimeter
        if (!cancelled && isInsidePUJurisdiction({ lat: finalLat, lng: finalLng })) {
          onLocationResolved(
            report.id,
            { lat: finalLat, lng: finalLng },
            primary.formattedAddress,
            primary.placeId
          );
        }
      }
    };

    void resolveSequentially();

    return () => {
      cancelled = true;
    };
  }, [placesLib, reports, onLocationResolved, searchPlaceWithCacheAndRetry]);

  useEffect(() => {
    if (!map || !selectedJumpTarget) return;

    map.panTo(selectedJumpTarget);
    map.setZoom(17);
    onJumpCompleted();
  }, [map, selectedJumpTarget, onJumpCompleted]);

  return null;
};

interface CampusSafetyMapProps {
  reports: SafetyReport[];
  selectedReport: SafetyReport | null;
  onSelectReport: (report: SafetyReport | null) => void;
  onUpvoteReport: (reportId: string) => void;
  onInspectReportDetails: (report: SafetyReport) => void;
  isPinDropMode: boolean;
  onTogglePinDropMode: () => void;
  draftPinLocation: { lat: number; lng: number } | null;
  onMapPinDropped: (coords: { lat: number; lng: number }, label?: string) => void;
  onLocationResolved: (
    reportId: string,
    location: { lat: number; lng: number },
    formattedAddress?: string,
    placeId?: string
  ) => void;
}

const LANDMARK_QUICK_JUMPS = [
  {
    label: 'AC Joshi Library',
    lat: 30.7615,
    lng: 76.7695,
  },
  {
    label: 'Girls Hostels 1–5',
    lat: 30.7595,
    lng: 76.7679,
  },
  {
    label: 'Boys Hostel 3',
    lat: 30.7641,
    lng: 76.7654,
  },
  {
    label: 'StuC (Student Centre)',
    lat: 30.7623,
    lng: 76.7689,
  },
  {
    label: 'PU Gate No. 2 (Internal)',
    lat: 30.7576,
    lng: 76.7712,
  },
  {
    label: 'PU South Campus (Sec 25)',
    lat: 30.748,
    lng: 76.7567,
  },
];

export const CampusSafetyMap: React.FC<CampusSafetyMapProps> = ({
  reports,
  selectedReport,
  onSelectReport,
  onUpvoteReport,
  onInspectReportDetails,
  isPinDropMode,
  onTogglePinDropMode,
  draftPinLocation,
  onMapPinDropped,
  onLocationResolved,
}) => {
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'hybrid'>('hybrid');
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [selectedJumpTarget, setSelectedJumpTarget] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [campusBounds, setCampusBounds] = useState<CampusBoundsBox | null>(null);
  const [jurisdictionWarning, setJurisdictionWarning] = useState<string | null>(
    null
  );

  const showTemporaryJurisdictionWarning = useCallback((msg: string) => {
    setJurisdictionWarning(msg);
    setTimeout(() => {
      setJurisdictionWarning((prev) => (prev === msg ? null : prev));
    }, 5000);
  }, []);

  const handleMapClick = useCallback(
    (ev: MapMouseEvent) => {
      if (!isPinDropMode || !ev.detail.latLng) return;
      const clickedCoords = {
        lat: ev.detail.latLng.lat,
        lng: ev.detail.latLng.lng,
      };

      if (!isInsidePUJurisdiction(clickedCoords)) {
        showTemporaryJurisdictionWarning(
          'Outside 500m PU Mapping Zone: Please tap inside Panjab University (Sector 14 & Sector 25) or within 500 meters outside the campus perimeter.'
        );
        return;
      }

      setJurisdictionWarning(null);
      onMapPinDropped(clickedCoords);
    },
    [isPinDropMode, onMapPinDropped, showTemporaryJurisdictionWarning]
  );

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gpsCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        if (!isInsidePUJurisdiction(gpsCoords)) {
          showTemporaryJurisdictionWarning(
            'Your current GPS location is more than 500m outside Panjab University. Please tap a spot on the PU map instead.'
          );
          return;
        }
        setJurisdictionWarning(null);
        onMapPinDropped(gpsCoords, 'My Current PU Campus Location');
      },
      () => {
        showTemporaryJurisdictionWarning(
          'Unable to read GPS. Please tap your location directly on the Panjab University map.'
        );
      }
    );
  };

  const inBoundsReports = useMemo(
    () =>
      reports.filter((r) =>
        r.location
          ? isInsidePUJurisdiction(r.location)
          : !isOutsidePUSectorText(
              `${r.title} ${r.corridorName} ${r.formattedAddress || ''}`
            )
      ),
    [reports]
  );

  return (
    <div className="relative w-full h-[calc(100dvh-65px)] min-h-[540px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900">
      {/* Top Overlay Controls */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1 p-1 bg-white/95 dark:bg-slate-900/95 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm">
            <button
              type="button"
              onClick={() => setMapTypeId('hybrid')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mapTypeId === 'hybrid'
                  ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Satellite Photo
            </button>
            <button
              type="button"
              onClick={() => setMapTypeId('roadmap')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mapTypeId === 'roadmap'
                  ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Road Map
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowHeatmap((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border shadow-sm transition-colors whitespace-nowrap shrink-0 ${
              showHeatmap
                ? 'bg-red-600 text-white border-red-500'
                : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
            }`}
            title="Toggle Student Safety Concern Heatmap"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{showHeatmap ? 'Heatmap: ON' : 'Heatmap: OFF'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={handleLocateMe}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm hover:border-amber-500 transition-colors whitespace-nowrap shrink-0"
          >
            <Navigation className="w-3.5 h-3.5 text-amber-500" />
            <span>I Am Standing Here (GPS)</span>
          </button>

          <button
            type="button"
            onClick={onTogglePinDropMode}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg shadow-md border transition-colors whitespace-nowrap shrink-0 ${
              isPinDropMode
                ? 'bg-amber-500 text-slate-950 border-amber-300'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            <span>
              {isPinDropMode ? 'Tap Inside PU Campus Now...' : '+ Mark Dark Spot on Map'}
            </span>
          </button>
        </div>
      </div>

      {/* Jurisdiction Warning Alert Banner */}
      {jurisdictionWarning && (
        <div className="absolute top-16 left-3 right-3 z-20 pointer-events-none flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-lg bg-red-600 text-white text-xs font-bold shadow-xl border-2 border-red-200 max-w-xl">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{jurisdictionWarning}</span>
            <button
              type="button"
              onClick={() => setJurisdictionWarning(null)}
              className="underline ml-2 whitespace-nowrap shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Pin-Drop Active Banner */}
      {isPinDropMode && !jurisdictionWarning && (
        <div className="absolute top-16 left-3 right-3 z-10 pointer-events-none flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold shadow-xl border-2 border-white">
            <Crosshair className="w-4 h-4 shrink-0" />
            <span>
              Tap any road, hostel, or pathway inside Panjab University or within 500m outside campus to report a dark spot.
            </span>
            <button
              type="button"
              onClick={onTogglePinDropMode}
              className="underline ml-2 whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Heatmap Intensity & PU Jurisdiction Badge */}
      <div className="absolute bottom-14 left-3 right-3 z-10 pointer-events-none flex flex-wrap items-center justify-between gap-2">
        {showHeatmap ? (
          <div className="pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-slate-300 dark:border-slate-700 shadow-sm text-[11px] font-medium text-slate-700 dark:text-slate-200">
            <span>Concern Density:</span>
            <span className="text-slate-500">Moderate</span>
            <div className="w-20 h-2 rounded-full bg-gradient-to-r from-yellow-300 via-orange-500 to-red-700" />
            <span className="font-semibold text-red-600 dark:text-red-400">
              High Student Reports
            </span>
          </div>
        ) : (
          <div />
        )}

        <div className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/90 text-amber-400 border border-amber-500/40 shadow-sm text-[11px] font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>Panjab University (Sec 14 &amp; Sec 25) + 500m Perimeter</span>
        </div>
      </div>

      {/* Bottom Campus Landmark Quick-Jump Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 px-2.5 bg-white/95 dark:bg-slate-900/95 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm pointer-events-auto max-w-full">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 px-1 flex items-center gap-1 whitespace-nowrap shrink-0">
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            <span>PU Zones:</span>
          </span>
          {LANDMARK_QUICK_JUMPS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() =>
                setSelectedJumpTarget({ lat: item.lat, lng: item.lng })
              }
              className="px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Google Map Component */}
      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={{ lat: 30.76, lng: 76.768 }}
        defaultZoom={16}
        mapTypeId={mapTypeId}
        gestureHandling="greedy"
        disableDefaultUI={false}
        streetViewControl={true}
        fullscreenControl={false}
        mapTypeControl={false}
        onClick={handleMapClick}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        <CampusGroundingAndRoutingController
          reports={inBoundsReports}
          onLocationResolved={onLocationResolved}
          selectedJumpTarget={selectedJumpTarget}
          onJumpCompleted={() => setSelectedJumpTarget(null)}
          onCampusBoundsResolved={setCampusBounds}
        />

        {/* Modern Deck.gl Heatmap Visualization restricted to PU jurisdiction */}
        <SafetyHeatmapOverlay
          reports={inBoundsReports}
          visible={showHeatmap}
          campusBounds={campusBounds}
        />

        {inBoundsReports.map((report) => (
          <ReportMarkerItem
            key={report.id}
            report={report}
            isSelected={selectedReport?.id === report.id}
            onSelect={(r) => onSelectReport(r)}
            onClose={() => onSelectReport(null)}
            onUpvote={onUpvoteReport}
            onInspectDetails={onInspectReportDetails}
          />
        ))}

        {draftPinLocation && isInsideBounds(draftPinLocation, campusBounds) && (
          <AdvancedMarker position={draftPinLocation} title="New Dark-Spot Pin">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs border-2 border-white shadow-xl">
              <MapPin className="w-4 h-4" />
              <span>Selected PU Spot</span>
            </div>
          </AdvancedMarker>
        )}
      </GoogleMap>
    </div>
  );
};
