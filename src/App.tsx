/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  Check,
  Copy,
  FileSpreadsheet,
  Moon,
  Plus,
  Printer,
  ShieldAlert,
  Sun,
  ThumbsUp,
  X,
} from 'lucide-react';
import {
  AuthorityDepartment,
  HazardCategory,
  HazardSeverity,
  ResolutionStatus,
  SafetyReport,
} from './types';
import { CampusSafetyMap } from './components/CampusSafetyMap';
import { InspectReportModal, NewReportModal } from './components/ReportModals';
import { INITIAL_PU_REPORTS } from './data/initialReports';
import {
  isInsidePUJurisdiction,
  isOutsidePUSectorText,
} from './utils/puBounds';
import {
  createFirestoreReport,
  getUpvotedReportIds,
  markReportUpvotedLocally,
  seedInitialReportsIfNeeded,
  subscribeToPublicReports,
  subscribeToReportObservations,
  updateFirestoreAuthorityStatus,
  updateFirestoreReportLocation,
  upvoteFirestoreReport,
} from './firebase';

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const CATEGORY_LABELS: Record<HazardCategory, string> = {
  dark_stretch: 'Streetlight Not Working',
  cctv_blind_spot: 'No CCTV Camera Here',
  vehicular_harassment: 'Cars / "Geri" Harassment',
  canopy_obstruction: 'Trees Blocking Light',
};

const STATUS_LABELS: Record<ResolutionStatus, string> = {
  reported: 'Needs Fix',
  escalated: 'Sent to PU Authorities',
  work_order_issued: 'Repair In Progress',
  resolved: 'Fixed',
};

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'dossier'>('map');

  const [reports, setReports] = useState<SafetyReport[]>(INITIAL_PU_REPORTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [upvotedReportIds, setUpvotedReportIds] = useState<string[]>(() =>
    getUpvotedReportIds()
  );

  const [selectedReport, setSelectedReport] = useState<SafetyReport | null>(
    null
  );
  const [inspectingReport, setInspectingReport] = useState<SafetyReport | null>(
    null
  );
  const [isNewReportOpen, setIsNewReportOpen] = useState(false);
  const [isPinDropMode, setIsPinDropMode] = useState(false);
  const [draftPinCoords, setDraftPinCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [draftPinLabel, setDraftPinLabel] = useState<string | undefined>(
    undefined
  );

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [authorityFilter, setAuthorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'upvotes' | 'recent'>('upvotes');
  const [showSafetyTips, setShowSafetyTips] = useState(true);

  const formatReportDate = useCallback((isoString: string) => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'Recently';
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins >= 0 && diffMins < 1) return 'Just now';
    if (diffMins >= 1 && diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours >= 1 && diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  }, []);

  // Mandatory Google Maps Demo Key quota listener
  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Seed initial PU reports if database is empty and subscribe to real-time Firestore reports (Zero Login)
  useEffect(() => {
    void seedInitialReportsIfNeeded().catch(() => {
      // Non-fatal if already seeded
    });

    const unsubReports = subscribeToPublicReports(
      (liveReports) => {
        setReports((prev) => {
          const prevCoordsById = new Map(
            prev.map((r) => [
              r.id,
              {
                location: r.location,
                formattedAddress: r.formattedAddress,
                placeId: r.placeId,
                observations: r.observations,
              },
            ])
          );
          const merged = liveReports.map((r) => {
            const cached = prevCoordsById.get(r.id);
            return {
              ...r,
              location: r.location || cached?.location,
              formattedAddress: r.formattedAddress || cached?.formattedAddress,
              placeId: r.placeId || cached?.placeId,
              observations:
                cached?.observations && cached.observations.length > r.observations.length
                  ? cached.observations
                  : r.observations,
            };
          });
          // Include reports inside Panjab University or within 500m outside the campus perimeter
          return merged.filter((r) =>
            r.location
              ? isInsidePUJurisdiction(r.location)
              : !isOutsidePUSectorText(
                  `${r.title} ${r.corridorName} ${r.formattedAddress || ''}`
                )
          );
        });
        setError(null);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsubReports();
  }, []);

  // Subscribe to subcollection observations for the currently inspected report
  useEffect(() => {
    if (!inspectingReport) return;
    const baseline =
      INITIAL_PU_REPORTS.find((b) => b.id === inspectingReport.id)
        ?.observations || [];
    const unsubObs = subscribeToReportObservations(
      inspectingReport.id,
      baseline,
      (mergedObs) => {
        setReports((prev) =>
          prev.map((r) =>
            r.id === inspectingReport.id ? { ...r, observations: mergedObs } : r
          )
        );
        setInspectingReport((prev) =>
          prev && prev.id === inspectingReport.id
            ? { ...prev, observations: mergedObs }
            : prev
        );
      }
    );
    return () => unsubObs();
  }, [inspectingReport?.id]);

  const handleLocationResolved = useCallback(
    async (
      reportId: string,
      location: { lat: number; lng: number },
      formattedAddress?: string,
      placeId?: string
    ) => {
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, location, formattedAddress, placeId }
            : r
        )
      );
      void updateFirestoreReportLocation(
        reportId,
        location,
        formattedAddress,
        placeId
      );
      try {
        await fetch(`/api/reports/${reportId}/resolve-location`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location, formattedAddress, placeId }),
        });
      } catch {
        // Ignore on static Netlify hosting
      }
    },
    []
  );

  const handleCreateReport = async (payload: {
    title: string;
    corridorName: string;
    category: HazardCategory;
    severity: HazardSeverity;
    authority: AuthorityDepartment;
    description: string;
    lightingCondition: string;
    cctvPhase3Candidate: boolean;
    peakRiskWindow: string;
    placeSearchQuery: string;
    location?: { lat: number; lng: number };
    reporterRole: string;
    initialNote: string;
  }) => {
    if (payload.location) {
      if (!isInsidePUJurisdiction(payload.location)) {
        return;
      }
    } else if (isOutsidePUSectorText(`${payload.title} ${payload.corridorName}`)) {
      return;
    }
    const newId = `pu-v2-${Date.now()}`;
    const now = new Date().toISOString();
    const optimisticReport: SafetyReport = {
      id: newId,
      title: payload.title,
      corridorName: payload.corridorName,
      category: payload.category,
      severity: payload.severity,
      status: 'reported',
      authority: payload.authority,
      description: payload.description,
      lightingCondition: payload.lightingCondition,
      cctvPhase3Candidate: payload.cctvPhase3Candidate,
      peakRiskWindow: payload.peakRiskWindow,
      upvotes: 1,
      createdAt: now,
      updatedAt: now,
      sourceCitation: 'Crowdsourced PU Student Field Report',
      placeSearchQuery: payload.placeSearchQuery,
      location: payload.location,
      observations: [
        {
          id: `obs-${Date.now()}`,
          authorRole: payload.reporterRole || 'Panjab University Student',
          note: payload.initialNote || payload.description,
          timestamp: now,
        },
      ],
    };

    setReports((prev) => [optimisticReport, ...prev]);
    setSelectedReport(optimisticReport);
    setDraftPinCoords(null);
    setDraftPinLabel(undefined);
    setIsPinDropMode(false);

    try {
      await createFirestoreReport(newId, payload);
    } catch {
      // Optimistic report stays visible
    }
  };

  const handleQuickUpvote = async (reportId: string) => {
    if (upvotedReportIds.includes(reportId)) return;
    const target = reports.find((r) => r.id === reportId);
    if (!target) return;

    setUpvotedReportIds(markReportUpvotedLocally(reportId));
    const updated: SafetyReport = {
      ...target,
      upvotes: target.upvotes + 1,
      updatedAt: new Date().toISOString(),
    };
    setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
    if (selectedReport?.id === reportId) setSelectedReport(updated);
    if (inspectingReport?.id === reportId) setInspectingReport(updated);

    try {
      await upvoteFirestoreReport(target);
    } catch {
      // Optimistic update stays visible
    }
  };

  const handleUpvoteWithNote = async (
    reportId: string,
    note?: string,
    authorRole?: string
  ) => {
    const target = reports.find((r) => r.id === reportId);
    if (!target) return;

    const alreadyVoted = upvotedReportIds.includes(reportId);
    if (!alreadyVoted) {
      setUpvotedReportIds(markReportUpvotedLocally(reportId));
    }

    const now = new Date().toISOString();
    const newObs =
      note && note.trim()
        ? [
            {
              id: `obs-${Date.now()}`,
              authorRole: authorRole || 'Panjab University Student',
              note: note.trim(),
              timestamp: now,
            },
            ...target.observations,
          ]
        : target.observations;

    const updated: SafetyReport = {
      ...target,
      upvotes: alreadyVoted ? target.upvotes : target.upvotes + 1,
      updatedAt: now,
      observations: newObs,
    };
    setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
    if (selectedReport?.id === reportId) setSelectedReport(updated);
    if (inspectingReport?.id === reportId) setInspectingReport(updated);

    try {
      await upvoteFirestoreReport(target, note, authorRole);
    } catch {
      // Optimistic update stays visible
    }
  };

  const handleUpdateAuthorityStatus = async (
    reportId: string,
    status: ResolutionStatus,
    officialRemarks: string
  ) => {
    const target = reports.find((r) => r.id === reportId);
    if (!target) return;

    const updated: SafetyReport = {
      ...target,
      status,
      officialRemarks,
      updatedAt: new Date().toISOString(),
    };
    setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
    if (selectedReport?.id === reportId) setSelectedReport(updated);
    if (inspectingReport?.id === reportId) setInspectingReport(updated);

    try {
      await updateFirestoreAuthorityStatus(reportId, status, officialRemarks);
    } catch {
      // Optimistic update stays visible
    }
  };

  const filteredReports = useMemo(() => {
    const filtered = reports.filter((r) => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) {
        return false;
      }
      if (authorityFilter !== 'all' && r.authority !== authorityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          r.title.toLowerCase().includes(q) ||
          r.corridorName.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.authority.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'recent') {
        const timeDiff =
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.upvotes - a.upvotes;
      }
      const voteDiff = b.upvotes - a.upvotes;
      if (voteDiff !== 0) return voteDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [reports, categoryFilter, authorityFilter, searchQuery, sortBy]);

  const metrics = useMemo(() => {
    const total = reports.length;
    const totalConfirmations = reports.reduce((acc, r) => acc + r.upvotes, 0);
    const streetlightCount = reports.filter(
      (r) => r.category === 'dark_stretch' || r.category === 'canopy_obstruction'
    ).length;
    const cctvCount = reports.filter(
      (r) => r.category === 'cctv_blind_spot' || r.cctvPhase3Candidate
    ).length;
    return {
      total,
      totalConfirmations,
      streetlightCount,
      cctvCount,
    };
  }, [reports]);

  const handleExportCSV = () => {
    const headers = [
      'No.',
      'Problem Title',
      'Campus Road / Hostel Area',
      'Issue Type',
      'Students Agreed (Votes)',
      'Responsible PU Authority',
      'Current Status',
      'Latitude',
      'Longitude',
      'Details',
    ];
    const rows = reports.map((r, index) => [
      index + 1,
      `"${r.title.replace(/"/g, '""')}"`,
      `"${r.corridorName.replace(/"/g, '""')}"`,
      CATEGORY_LABELS[r.category],
      r.upvotes,
      `"${r.authority}"`,
      STATUS_LABELS[r.status],
      r.location?.lat ?? '',
      r.location?.lng ?? '',
      `"${r.description.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `PU_Campus_Dark_Spots_Report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyWhatsAppSummary = async () => {
    const lines = [
      '*PANJAB UNIVERSITY DARK-SPOT & SAFETY AUDIT*',
      `Total Unsafe / Dark Spots Mapped: ${metrics.total}`,
      `Total Student Confirmations: ${metrics.totalConfirmations}`,
      '',
      '*Top Reported Stretches Needing Immediate Fix:*',
      ...reports.slice(0, 6).map(
        (r, i) =>
          `${i + 1}. *${r.corridorName}* — ${CATEGORY_LABELS[r.category]} (${r.upvotes} students confirmed) -> For ${r.authority}`
      ),
      '',
      'Submitted for urgent action to PU Electrical Dept, Chief of University Security, DSW & PUCSC.',
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 3000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'marker']}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
        {/* Mandatory Google Maps Demo Key Quota Banner */}
        {quotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm flex items-center justify-center gap-3 sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
            <button
              type="button"
              onClick={() => setQuotaExceeded(false)}
              aria-label="Dismiss quota notice"
              className="p-1 rounded hover:bg-amber-200/60 text-amber-900 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Strict 3-Zone Top Bar Contract */}
        <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 no-print">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('map');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            PU SafeWalk
          </a>

          {/* Zone 2: Concise navigation */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#map"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('map');
              }}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'map'
                  ? 'text-slate-900 dark:text-white font-bold underline underline-offset-8 decoration-amber-500 decoration-2'
                  : ''
              }`}
            >
              Campus Map
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsNewReportOpen(true)}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 shadow-sm"
            >
              + Report Dark Spot
            </button>
          </div>
        </header>

        {/* Main Workspace Container */}
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 py-3 sm:py-4 space-y-6">
          {/* TAB 1: FULL-SCREEN LIVE PANJAB UNIVERSITY MAP & STUDENT VOTING LIST */}
          {activeTab === 'map' && (
            <section className="space-y-6">
              {/* Full Current Screen Size Interactive Google Map of Panjab University */}
              <div className="w-full flex flex-col gap-3">
                <CampusSafetyMap
                  reports={filteredReports}
                  selectedReport={selectedReport}
                  onSelectReport={setSelectedReport}
                  onUpvoteReport={(id) => void handleQuickUpvote(id)}
                  onInspectReportDetails={(r) => setInspectingReport(r)}
                  isPinDropMode={isPinDropMode}
                  onTogglePinDropMode={() => setIsPinDropMode((prev) => !prev)}
                  draftPinLocation={draftPinCoords}
                  onMapPinDropped={(coords, label) => {
                    setDraftPinCoords(coords);
                    if (label) setDraftPinLabel(label);
                    setIsNewReportOpen(true);
                  }}
                  onLocationResolved={(id, loc, addr, pid) =>
                    void handleLocationResolved(id, loc, addr, pid)
                  }
                />
              </div>

              {/* Lower Grid: Left (Hero Guide + Quick Safety Tips) & Right (Reported Dark Spots List) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 space-y-5">
                  <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                    <div>
                      <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
                        Panjab University Student Safety Drive · Sector 14 &amp; Sector 25
                      </div>
                      <h1
                        className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
                        style={{ textWrap: 'balance' }}
                      >
                        Help Map Dark Roads &amp; Broken Streetlights on Campus
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Walking back from AC Joshi Library or your hostel at night? Mark dark stretches on the map above or confirm existing spots on the right.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setIsNewReportOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Report a Dark Spot Now</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDarkMode((d) => !d)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
                      >
                        {darkMode ? (
                          <>
                            <Sun className="w-3.5 h-3.5 text-amber-400" />
                            <span>Day Mode</span>
                          </>
                        ) : (
                          <>
                            <Moon className="w-3.5 h-3.5 text-slate-700" />
                            <span>Night Mode</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-md bg-amber-500 text-slate-950 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          1
                        </span>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          <strong className="text-slate-900 dark:text-slate-100">
                            Mark a Dark Spot (15s):
                          </strong>{' '}
                          Tap <strong>&ldquo;+ Mark Dark Spot on Map&rdquo;</strong> and click the road, or pick your hostel from the list.
                        </p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-md bg-amber-500 text-slate-950 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          2
                        </span>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          <strong className="text-slate-900 dark:text-slate-100">
                            Or Tap &ldquo;I Walk Here Too (+1)&rdquo;:
                          </strong>{' '}
                          Confirm any road you walk on so PU authorities see how many students use it.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Dismissible Quick Safety Tips Widget */}
                  {showSafetyTips ? (
                    <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/60 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                            Quick Safety Tips for Late-Night Campus Walks
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowSafetyTips(false)}
                          aria-label="Dismiss Quick Safety Tips"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-200/60 dark:hover:bg-amber-900/50 rounded-md transition-colors"
                        >
                          <span>Dismiss</span>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <div className="flex items-start gap-2 bg-white/80 dark:bg-slate-900/70 p-2.5 rounded-lg border border-amber-200/50 dark:border-slate-800">
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                            01
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              Walk in well-lit areas:
                            </span>{' '}
                            Stick to illuminated main roads and avoid unlit shortcuts near BH-3 or the Sports Ground.
                          </div>
                        </div>

                        <div className="flex items-start gap-2 bg-white/80 dark:bg-slate-900/70 p-2.5 rounded-lg border border-amber-200/50 dark:border-slate-800">
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                            02
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              Avoid distractions:
                            </span>{' '}
                            Keep earphones off and stay alert to approaching four-wheelers on internal roads.
                          </div>
                        </div>

                        <div className="flex items-start gap-2 bg-white/80 dark:bg-slate-900/70 p-2.5 rounded-lg border border-amber-200/50 dark:border-slate-800">
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                            03
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              Walk in groups at night:
                            </span>{' '}
                            Coordinate return walks from AC Joshi Library (24×7 Reading Hall) with hostel friends.
                          </div>
                        </div>

                        <div className="flex items-start gap-2 bg-white/80 dark:bg-slate-900/70 p-2.5 rounded-lg border border-amber-200/50 dark:border-slate-800">
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                            04
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              Share live location:
                            </span>{' '}
                            Share your walk status with a roommate and alert PU Security if a vehicle follows you.
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowSafetyTips(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Show Quick Safety Tips</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Right 7 Cols: Simple Student Report List */}
                <div className="lg:col-span-7 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Reported Dark &amp; Unsafe Spots ({filteredReports.length})
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Tap &ldquo;I Walk Here Too&rdquo; on any road you use at night
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsNewReportOpen(true)}
                      className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg whitespace-nowrap shrink-0"
                    >
                      + Add Spot
                    </button>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg overflow-x-auto">
                    {[
                      { id: 'all', label: 'All Spots' },
                      { id: 'dark_stretch', label: 'Broken Lights' },
                      { id: 'cctv_blind_spot', label: 'No CCTV' },
                      { id: 'vehicular_harassment', label: 'Car / Geri Issue' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCategoryFilter(tab.id)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          categoryFilter === tab.id
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Sort Toggle Switch: Most Upvoted vs Most Recent */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Sort reports by:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSortBy('upvotes')}
                        className={`text-xs transition-colors whitespace-nowrap ${
                          sortBy === 'upvotes'
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                      >
                        Most Upvoted
                      </button>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={sortBy === 'recent'}
                        aria-label="Toggle sort order between Most Upvoted and Most Recent"
                        onClick={() =>
                          setSortBy((prev) =>
                            prev === 'upvotes' ? 'recent' : 'upvotes'
                          )
                        }
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-md border transition-colors focus:outline-none ${
                          sortBy === 'recent'
                            ? 'bg-amber-500 border-amber-500'
                            : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-sm bg-white dark:bg-slate-950 shadow-sm transition-transform ${
                            sortBy === 'recent'
                              ? 'translate-x-4'
                              : 'translate-x-0.5'
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => setSortBy('recent')}
                        className={`text-xs transition-colors whitespace-nowrap ${
                          sortBy === 'recent'
                            ? 'font-bold text-amber-600 dark:text-amber-400'
                            : 'font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                      >
                        Most Recent
                      </button>
                    </div>
                  </div>
                </div>

                {/* Reports List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 max-h-[540px]">
                  {loading ? (
                    <div className="p-6 space-y-4">
                      {[1, 2, 3].map((n) => (
                        <div
                          key={n}
                          className="h-24 rounded-lg bg-slate-100 dark:bg-slate-800/50 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : error ? (
                    <div className="p-6 text-center text-xs text-red-500">
                      {error}
                    </div>
                  ) : filteredReports.length === 0 ? (
                    <div className="p-8 text-center space-y-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {reports.length === 0
                          ? 'No dark spots reported yet. Tap "+ Mark Dark Spot on Map" or "+ Add Spot" to report the first location.'
                          : 'No reports in this category yet.'}
                      </p>
                      {reports.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => setIsNewReportOpen(true)}
                          className="px-3.5 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg"
                        >
                          + Report First Dark Spot
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCategoryFilter('all')}
                          className="px-3 py-1.5 text-xs font-medium bg-slate-200 dark:bg-slate-800 rounded-md"
                        >
                          Show All Reports
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredReports.map((report) => {
                      const isSelected = selectedReport?.id === report.id;
                      return (
                        <div
                          key={report.id}
                          onClick={() => setSelectedReport(report)}
                          className={`p-4 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-amber-50/70 dark:bg-amber-950/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <div className="flex items-center flex-wrap gap-1.5">
                              <span className="font-semibold text-amber-700 dark:text-amber-400">
                                {CATEGORY_LABELS[report.category]}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{report.corridorName}</span>
                            </div>
                            <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                              {formatReportDate(report.createdAt)}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                            {report.title}
                          </h3>

                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {report.description}
                          </p>

                          <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/70">
                            {upvotedReportIds.includes(report.id) ? (
                              <button
                                type="button"
                                disabled
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 rounded-md cursor-default whitespace-nowrap shrink-0"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>
                                  Confirmed by You ·{' '}
                                  <span className="font-mono tabular-nums">
                                    {report.upvotes}
                                  </span>
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleQuickUpvote(report.id);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500/20 hover:bg-amber-500 text-amber-900 dark:text-amber-300 hover:text-slate-950 dark:hover:text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                                <span>
                                  I Walk Here Too (+1) ·{' '}
                                  <span className="font-mono tabular-nums">
                                    {report.upvotes}
                                  </span>
                                </span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectingReport(report);
                              }}
                              className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline whitespace-nowrap shrink-0"
                            >
                              Comments ({report.observations.length})
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              </div>
            </section>
          )}

          {/* TAB 2: SHARE WITH PU AUTHORITIES (SIMPLE ONE-CLICK SHEET) */}
          {activeTab === 'dossier' && (
            <section className="space-y-6">
              <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Ready-to-Submit Student Safety Audit ·{' '}
                      <span className="font-mono tabular-nums">
                        {new Date().toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                      Panjab University Dark-Spot Report for Authorities
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      For submission to: <strong>PU Electrical Department</strong>,{' '}
                      <strong>Chief of University Security</strong>,{' '}
                      <strong>Dean Student Welfare (DSW)</strong>, and{' '}
                      <strong>PUCSC</strong>.
                    </p>
                  </div>

                  {/* 3 Simple Share Buttons */}
                  <div className="flex flex-wrap items-center gap-2.5 no-print">
                    <button
                      type="button"
                      onClick={() => void handleCopyWhatsAppSummary()}
                      className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm"
                    >
                      {copiedWhatsApp ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Copied for WhatsApp!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Summary for WhatsApp</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Download Excel / CSV Sheet</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-slate-900 text-white dark:bg-slate-800 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Official Letter / Save PDF</span>
                    </button>
                  </div>
                </div>

                {/* Summary Boxes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs text-slate-500">Total Spots Mapped</div>
                    <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                      {metrics.total}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs text-slate-500">Students Agreed</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                      {metrics.totalConfirmations}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs text-slate-500">Broken Streetlights</div>
                    <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                      {metrics.streetlightCount}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs text-slate-500">CCTV Needed (Phase-3)</div>
                    <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                      {metrics.cctvCount}
                    </div>
                  </div>
                </div>

                {/* Filter by Department */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 no-print">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg overflow-x-auto">
                    {[
                      'all',
                      'PU Electrical Department',
                      'Chief of University Security',
                      'Dean Student Welfare (DSW)',
                    ].map((dept) => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => setAuthorityFilter(dept)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          authorityFilter === dept
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {dept === 'all' ? 'All Departments' : dept}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clean Printable Table */}
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-600 dark:text-slate-300">
                        <th className="py-3 px-3">#</th>
                        <th className="py-3 px-3">Campus Road / Hostel Area</th>
                        <th className="py-3 px-3">What is the Problem?</th>
                        <th className="py-3 px-3">Responsible Department</th>
                        <th className="py-3 px-3 text-right">Students Agreed</th>
                        <th className="py-3 px-3">Current Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                      {filteredReports.map((r, index) => (
                        <tr
                          key={r.id}
                          onClick={() => setInspectingReport(r)}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-3 font-mono tabular-nums text-slate-500">
                            {index + 1}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {r.corridorName}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {r.description}
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap font-semibold text-amber-700 dark:text-amber-400">
                            {CATEGORY_LABELS[r.category]}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                            {r.authority}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                            {r.upvotes} students
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {STATUS_LABELS[r.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </main>

        {/* Simple Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 py-4 px-6 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-4 no-print">
          <div>
            PU SafeWalk · Student-Led Campus Lighting &amp; Safety Audit (Panjab University, Chandigarh)
          </div>
          <div>
            No login required · Data compiled for PU Electrical Dept, DSW &amp; Security Chief
          </div>
        </footer>

        {/* Modals */}
        <NewReportModal
          isOpen={isNewReportOpen}
          onClose={() => setIsNewReportOpen(false)}
          draftCoords={draftPinCoords}
          draftLabel={draftPinLabel}
          onRequestMapPinDrop={() => {
            setActiveTab('map');
            setIsPinDropMode(true);
          }}
          onSubmitReport={handleCreateReport}
        />

        <InspectReportModal
          report={inspectingReport}
          onClose={() => setInspectingReport(null)}
          onUpvoteWithNote={handleUpvoteWithNote}
          onUpdateAuthorityStatus={handleUpdateAuthorityStatus}
        />
      </div>
    </APIProvider>
  );
}
