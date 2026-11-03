import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  LightbulbOff,
  MapPin,
  Send,
  ShieldAlert,
  ThumbsUp,
  Trees,
  X,
} from 'lucide-react';
import {
  AuthorityDepartment,
  HazardCategory,
  HazardSeverity,
  ResolutionStatus,
  SafetyReport,
} from '../types';
import {
  isInsidePUJurisdiction,
  isOutsidePUSectorText,
} from '../utils/puBounds';

interface NewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftCoords: { lat: number; lng: number } | null;
  draftLabel?: string;
  onRequestMapPinDrop: () => void;
  onSubmitReport: (payload: {
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
  }) => Promise<void>;
}

const PROBLEM_CHOICES: {
  id: HazardCategory;
  label: string;
  subtext: string;
  defaultAuthority: AuthorityDepartment;
  defaultCondition: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'dark_stretch',
    label: 'Streetlight Not Working',
    subtext: 'Broken bulb, pole off, or dark road',
    defaultAuthority: 'PU Electrical Department',
    defaultCondition: 'Streetlight pole not working; dark walking stretch',
    icon: <LightbulbOff className="w-5 h-5 text-amber-500" />,
  },
  {
    id: 'cctv_blind_spot',
    label: 'No CCTV Camera Here',
    subtext: 'Isolated stretch needing a security camera',
    defaultAuthority: 'Chief of University Security',
    defaultCondition: 'No CCTV camera coverage on this stretch',
    icon: <EyeOff className="w-5 h-5 text-red-500" />,
  },
  {
    id: 'vehicular_harassment',
    label: 'Cars / "Geri" Harassment',
    subtext: 'Outsiders in cars following or passing comments',
    defaultAuthority: 'Dean Student Welfare (DSW)',
    defaultCondition: 'Unrestricted car movement and harassment after dark',
    icon: <ShieldAlert className="w-5 h-5 text-rose-500" />,
  },
  {
    id: 'canopy_obstruction',
    label: 'Trees Blocking Streetlight',
    subtext: 'Branches covering the light over footpath',
    defaultAuthority: 'PU Electrical Department',
    defaultCondition: 'Heavy tree branches blocking streetlight illumination',
    icon: <Trees className="w-5 h-5 text-emerald-500" />,
  },
];

export const NewReportModal: React.FC<NewReportModalProps> = ({
  isOpen,
  onClose,
  draftCoords,
  draftLabel,
  onRequestMapPinDrop,
  onSubmitReport,
}) => {
  const [category, setCategory] = useState<HazardCategory>('dark_stretch');
  const [description, setDescription] = useState('');
  const [reporterRole] = useState('PU Student');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setValidationError(null);
  }, [draftLabel, draftCoords, isOpen]);

  if (!isOpen) return null;

  const selectedProblem =
    PROBLEM_CHOICES.find((p) => p.id === category) || PROBLEM_CHOICES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanArea =
      draftLabel?.trim() ||
      (draftCoords
        ? `Pinned Campus Spot (${draftCoords.lat.toFixed(4)}, ${draftCoords.lng.toFixed(4)})`
        : 'Panjab University Campus Spot');

    if (draftCoords) {
      if (!isInsidePUJurisdiction(draftCoords)) {
        setValidationError(
          'Selected map pin is more than 500m outside Panjab University. Please select a spot inside PU (Sector 14 & Sector 25) or within 500m of the campus perimeter.'
        );
        return;
      }
    } else if (isOutsidePUSectorText(description)) {
      setValidationError(
        'Outside Allowed Mapping Zone: Only Panjab University (Sector 14 & Sector 25) and areas within 500m outside the campus perimeter can be reported.'
      );
      return;
    }

    setValidationError(null);
    setSubmitting(true);

    const generatedTitle = `${selectedProblem.label} — ${cleanArea}`;
    const finalDescription =
      description.trim() ||
      `Students reported: ${selectedProblem.label.toLowerCase()} at ${cleanArea}. Unsafe for walking after dark.`;

    try {
      await onSubmitReport({
        title: generatedTitle,
        corridorName: cleanArea,
        category,
        severity: 'critical' as HazardSeverity,
        authority: selectedProblem.defaultAuthority,
        description: finalDescription,
        lightingCondition: selectedProblem.defaultCondition,
        cctvPhase3Candidate: true,
        peakRiskWindow: 'After 8:00 PM',
        placeSearchQuery: `${cleanArea} Panjab University Sector 14 Chandigarh`,
        location: draftCoords || undefined,
        reporterRole: reporterRole.trim() || 'PU Student',
        initialNote: description.trim(),
      });
      setDescription('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Report an Unsafe or Dark Spot (Takes 15 Seconds)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              No login or personal details required. Covers Panjab University (Sector 14 &amp; Sector 25) and up to 500m outside campus.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-5">
          {validationError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 flex items-start gap-2.5 text-xs font-semibold text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Step 1: Map Location */}
          <div className="p-3.5 rounded-lg bg-amber-50/70 dark:bg-slate-950 border border-amber-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <MapPin className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-xs">
                {draftCoords ? (
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                      Exact Spot Marked on Map!
                    </span>
                    <span className="font-mono text-slate-600 dark:text-slate-400">
                      GPS: {draftCoords.lat.toFixed(4)}, {draftCoords.lng.toFixed(4)}
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                      Want to mark the exact spot on the map?
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">
                      Tap the button on the right to drop a pin on the exact dark spot.
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequestMapPinDrop();
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:border-amber-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {draftCoords ? 'Change Spot on Map' : 'Tap Spot on Map'}
            </button>
          </div>

          {/* Step 1: Pick Problem Type (Big Easy Buttons) */}
          <div>
            <label className="block text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
              1. What is the problem here? (Tap one)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PROBLEM_CHOICES.map((item) => {
                const active = category === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id)}
                    className={`p-3 rounded-lg border text-left transition-all flex items-start gap-3 ${
                      active
                        ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 ring-1 ring-amber-500'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">{item.icon}</div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {item.subtext}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Short Optional Note */}
          <div>
            <label className="block text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
              2. Anything else authorities should know? (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Example: 3 streetlights near the turn to Girls Hostel 1 are off every night after 10 PM..."
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Saving...' : 'Submit Report to Map'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface InspectReportModalProps {
  report: SafetyReport | null;
  onClose: () => void;
  onUpvoteWithNote: (
    reportId: string,
    note?: string,
    authorRole?: string
  ) => Promise<void>;
  onUpdateAuthorityStatus: (
    reportId: string,
    status: ResolutionStatus,
    officialRemarks: string
  ) => Promise<void>;
}

export const InspectReportModal: React.FC<InspectReportModalProps> = ({
  report,
  onClose,
  onUpvoteWithNote,
  onUpdateAuthorityStatus,
}) => {
  const [note, setNote] = useState('');
  const [authorRole, setAuthorRole] = useState('PU Student');
  const [status, setStatus] = useState<ResolutionStatus>(
    report?.status || 'reported'
  );
  const [officialRemarks, setOfficialRemarks] = useState(
    report?.officialRemarks || ''
  );
  const [savingStatus, setSavingStatus] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [showAdminBox, setShowAdminBox] = useState(false);

  useEffect(() => {
    if (report) {
      setStatus(report.status);
      setOfficialRemarks(report.officialRemarks || '');
    }
  }, [report]);

  if (!report) return null;

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingVote(true);
    try {
      await onUpvoteWithNote(report.id, note, authorRole);
      setNote('');
    } finally {
      setSubmittingVote(false);
    }
  };

  const handleStatusSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStatus(true);
    try {
      await onUpdateAuthorityStatus(report.id, status, officialRemarks);
      setShowAdminBox(false);
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden my-6">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span>{report.corridorName}</span>
              <span aria-hidden="true"> · </span>
              <span>For {report.authority}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
              {report.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {report.description}
          </p>

          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-slate-950 border border-amber-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
              Do you also walk on this road? Confirm this issue:
            </h3>
            <form
              onSubmit={(e) => void handleConfirmSubmit(e)}
              className="space-y-2.5"
            >
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional comment (e.g., Yes, it is completely dark near GH-1 gate)..."
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <button
                type="submit"
                disabled={submittingVote}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors"
              >
                <ThumbsUp className="w-4 h-4" />
                <span>
                  {submittingVote
                    ? 'Adding your confirmation...'
                    : `I Walk Here Too — Confirm Issue (${report.upvotes} Students Agreed)`}
                </span>
              </button>
            </form>
          </div>

          {/* Student Comments List */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Student Comments ({report.observations.length})
            </h4>
            <div className="space-y-2">
              {report.observations.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No student comments yet.
                </p>
              ) : (
                report.observations.map((obs) => (
                  <div
                    key={obs.id}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <p className="text-slate-800 dark:text-slate-200">
                      &ldquo;{obs.note}&rdquo;
                    </p>
                    <div className="text-[11px] text-slate-500 mt-1">
                      <span>{obs.authorRole}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono tabular-nums">
                        {new Date(obs.timestamp).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Optional Volunteer / Authority Status Update */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => setShowAdminBox((prev) => !prev)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
            >
              {showAdminBox
                ? 'Hide Audit Team Status Update'
                : 'For Audit Team / Volunteers: Update Authority Repair Status'}
            </button>

            {showAdminBox && (
              <form
                onSubmit={(e) => void handleStatusSave(e)}
                className="mt-3 space-y-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Current Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as ResolutionStatus)
                      }
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                    >
                      <option value="reported">Needs Fix (Reported)</option>
                      <option value="escalated">Shared with PU Authorities</option>
                      <option value="work_order_issued">Repair In Progress</option>
                      <option value="resolved">Fixed / Streetlight Working</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Action Note
                    </label>
                    <input
                      type="text"
                      value={officialRemarks}
                      onChange={(e) => setOfficialRemarks(e.target.value)}
                      placeholder="e.g., Given to Electrical Dept..."
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={savingStatus}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white dark:bg-slate-800 rounded-md"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{savingStatus ? 'Saving...' : 'Save Status'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
