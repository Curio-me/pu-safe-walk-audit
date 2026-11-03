import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  AuthorityDepartment,
  FieldObservation,
  HazardCategory,
  HazardSeverity,
  ResolutionStatus,
  SafetyReport,
} from './types';
import { INITIAL_PU_REPORTS } from './data/initialReports';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot as required by guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

/**
 * Generates or retrieves a persistent zero-login anonymous student identifier
 * matching ^[a-zA-Z0-9_\-]+$ so students never have to log in.
 */
export function getStudentDeviceId(): string {
  const storageKey = 'pu_safewalk_student_id';
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing && /^[a-zA-Z0-9_-]{4,64}$/.test(existing)) {
      return existing;
    }
    const generated = `pu-student-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    localStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    return `pu-student-${Date.now()}`;
  }
}

const UPVOTED_STORAGE_KEY = 'pu_safewalk_upvoted_reports_v2';
const ACTIVE_REPORT_ID_PREFIX = 'pu-v2-';

try {
  localStorage.removeItem('pu_safewalk_upvoted_reports');
} catch {
  // Ignore storage errors
}

export function getUpvotedReportIds(): string[] {
  try {
    const raw = localStorage.getItem(UPVOTED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export function markReportUpvotedLocally(reportId: string): string[] {
  const current = getUpvotedReportIds();
  if (current.includes(reportId)) return current;
  const updated = [...current, reportId];
  try {
    localStorage.setItem(UPVOTED_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}

// Panjab University Jurisdiction Clamping Helper (matches firebase-blueprint.json & firestore.rules)
export function clampToPUJurisdiction(coords?: { lat: number; lng: number }): {
  lat: number;
  lng: number;
} {
  const rawLat = coords?.lat ?? 30.7603;
  const rawLng = coords?.lng ?? 76.7663;
  return {
    lat: Math.min(30.77, Math.max(30.735, Number(rawLat.toFixed(6)))),
    lng: Math.min(76.78, Math.max(76.745, Number(rawLng.toFixed(6)))),
  };
}

function timestampToIso(val: unknown, fallbackIso?: string): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  return fallbackIso || new Date().toISOString();
}

const ALLOWED_AUTHORITIES: AuthorityDepartment[] = [
  'PU Electrical Department',
  'Chief of University Security',
  'Dean Student Welfare (DSW)',
  'PUCSC Student Council',
  'Internal Complaints Committee (ICC)',
];

function sanitizeAuthority(authority?: string): AuthorityDepartment {
  if (
    authority &&
    ALLOWED_AUTHORITIES.includes(authority as AuthorityDepartment)
  ) {
    return authority as AuthorityDepartment;
  }
  return 'PU Electrical Department';
}

/**
 * Seeds the 8 baseline Panjab University dark spots (with 1 vote each) into Firestore
 * if they do not exist yet.
 */
export async function seedInitialReportsIfNeeded(): Promise<void> {
  const path = 'reports';
  try {
    const deviceId = getStudentDeviceId();

    for (const r of INITIAL_PU_REPORTS) {
      const existingSnap = await getDocFromServer(doc(db, path, r.id));
      if (existingSnap.exists()) continue;

      const coords = clampToPUJurisdiction(r.location);
      const docData: Record<string, unknown> = {
        title: r.title.slice(0, 200),
        corridorName: r.corridorName.slice(0, 160),
        category: r.category,
        severity: r.severity,
        status: r.status === 'resolved' ? 'escalated' : r.status,
        authority: sanitizeAuthority(r.authority),
        description: r.description.slice(0, 1500),
        lightingCondition: r.lightingCondition.slice(0, 300),
        cctvPhase3Candidate: Boolean(r.cctvPhase3Candidate),
        peakRiskWindow: r.peakRiskWindow.slice(0, 100),
        upvotes: 1,
        placeSearchQuery: r.placeSearchQuery.slice(0, 240),
        lat: coords.lat,
        lng: coords.lng,
        authorId: deviceId,
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (r.secondarySearchQuery) {
        docData.secondarySearchQuery = r.secondarySearchQuery.slice(0, 240);
      }
      if (r.formattedAddress) {
        docData.formattedAddress = r.formattedAddress.slice(0, 300);
      }
      if (r.sourceCitation) {
        docData.sourceCitation = r.sourceCitation.slice(0, 240);
      }
      if (r.officialRemarks) {
        docData.officialRemarks = r.officialRemarks.slice(0, 600);
      }

      await setDoc(doc(db, path, r.id), docData);
    }
  } catch (error) {
    console.warn('Initial baseline seed skipped or deferred:', error);
  }
}

/**
 * Subscribes to public Panjab University safety reports in Firestore (pu-v2-* dataset)
 * and merges with INITIAL_PU_REPORTS fallback.
 */
export function subscribeToPublicReports(
  onUpdate: (reports: SafetyReport[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'reports';
  const q = query(collection(db, path), where('isPublic', '==', true));

  return onSnapshot(
    q,
    (snapshot) => {
      const firestoreById = new Map<string, SafetyReport>();

      snapshot.docs.forEach((docSnap) => {
        if (!docSnap.id.startsWith(ACTIVE_REPORT_ID_PREFIX)) {
          return;
        }
        const data = docSnap.data();
        const baseline = INITIAL_PU_REPORTS.find((b) => b.id === docSnap.id);

        const report: SafetyReport = {
          id: docSnap.id,
          title: String(data.title || baseline?.title || ''),
          corridorName: String(data.corridorName || baseline?.corridorName || ''),
          category:
            (data.category as HazardCategory) ||
            baseline?.category ||
            'dark_stretch',
          severity:
            (data.severity as HazardSeverity) ||
            baseline?.severity ||
            'high',
          status:
            (data.status as ResolutionStatus) ||
            baseline?.status ||
            'reported',
          authority: sanitizeAuthority(
            String(data.authority || baseline?.authority || '')
          ),
          description: String(data.description || baseline?.description || ''),
          lightingCondition: String(
            data.lightingCondition || baseline?.lightingCondition || ''
          ),
          cctvPhase3Candidate: Boolean(
            data.cctvPhase3Candidate ?? baseline?.cctvPhase3Candidate
          ),
          peakRiskWindow: String(
            data.peakRiskWindow || baseline?.peakRiskWindow || '21:00 – 02:00 IST'
          ),
          upvotes: Number(data.upvotes || 1),
          createdAt: timestampToIso(data.createdAt, baseline?.createdAt),
          updatedAt: timestampToIso(data.updatedAt, baseline?.updatedAt),
          sourceCitation: data.sourceCitation
            ? String(data.sourceCitation)
            : baseline?.sourceCitation,
          officialRemarks: data.officialRemarks
            ? String(data.officialRemarks)
            : baseline?.officialRemarks,
          placeSearchQuery: String(
            data.placeSearchQuery ||
              baseline?.placeSearchQuery ||
              'AC Joshi Library Panjab University Sector 14 Chandigarh'
          ),
          secondarySearchQuery: data.secondarySearchQuery
            ? String(data.secondarySearchQuery)
            : baseline?.secondarySearchQuery,
          location:
            typeof data.lat === 'number' && typeof data.lng === 'number'
              ? { lat: data.lat, lng: data.lng }
              : baseline?.location,
          formattedAddress: data.formattedAddress
            ? String(data.formattedAddress)
            : baseline?.formattedAddress,
          placeId: data.placeId ? String(data.placeId) : baseline?.placeId,
          observations: baseline?.observations || [],
        };
        firestoreById.set(docSnap.id, report);
      });

      const merged: SafetyReport[] = [...firestoreById.values()];
      INITIAL_PU_REPORTS.forEach((baseItem) => {
        if (!firestoreById.has(baseItem.id)) {
          merged.push(baseItem);
        }
      });

      onUpdate(merged);
    },
    (error) => {
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Creates a new safety report in Firestore with zero login required.
 */
export async function createFirestoreReport(
  reportId: string,
  payload: {
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
  }
): Promise<void> {
  const path = `reports/${reportId}`;
  const deviceId = getStudentDeviceId();
  const coords = clampToPUJurisdiction(payload.location);
  const safeTitle =
    payload.title.trim().length >= 3
      ? payload.title.trim().slice(0, 200)
      : 'Dark Stretch Reported by Student';
  const safeCorridor =
    payload.corridorName.trim().length >= 2
      ? payload.corridorName.trim().slice(0, 160)
      : 'Panjab University Campus Stretch';
  const safeDesc =
    payload.description.trim().length >= 3
      ? payload.description.trim().slice(0, 1500)
      : 'Student reported dark stretch / safety concern.';
  const safeLighting =
    payload.lightingCondition.trim().length >= 2
      ? payload.lightingCondition.trim().slice(0, 300)
      : 'Student reported lighting concern';
  const safeWindow =
    payload.peakRiskWindow.trim().length >= 2
      ? payload.peakRiskWindow.trim().slice(0, 100)
      : '21:00 – 02:00 IST';
  const safeQuery =
    payload.placeSearchQuery.trim().length >= 2
      ? payload.placeSearchQuery.trim().slice(0, 240)
      : `${safeCorridor} Panjab University Sector 14 Chandigarh`.slice(0, 240);

  const docData: Record<string, unknown> = {
    title: safeTitle,
    corridorName: safeCorridor,
    category: payload.category,
    severity: payload.severity,
    status: 'reported',
    authority: sanitizeAuthority(payload.authority),
    description: safeDesc,
    lightingCondition: safeLighting,
    cctvPhase3Candidate: Boolean(payload.cctvPhase3Candidate),
    peakRiskWindow: safeWindow,
    upvotes: 1,
    placeSearchQuery: safeQuery,
    lat: coords.lat,
    lng: coords.lng,
    sourceCitation: 'Crowdsourced PU Student Field Report',
    authorId: deviceId,
    isPublic: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (payload.location) {
    docData.formattedAddress = `${safeCorridor}, Panjab University, Chandigarh`.slice(
      0,
      300
    );
  }

  try {
    await setDoc(doc(db, 'reports', reportId), docData);

    const noteText = (payload.initialNote || payload.description).trim();
    if (noteText.length >= 1) {
      const obsId = `obs-${Date.now()}`;
      await setDoc(doc(db, 'reports', reportId, 'observations', obsId), {
        reportId,
        authorId: deviceId,
        authorRole: (payload.reporterRole || 'Panjab University Student')
          .trim()
          .slice(0, 120),
        note: noteText.slice(0, 1000),
        isPublic: true,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Upvotes a report (+1) and optionally attaches a student observation in Firestore with zero login.
 */
export async function upvoteFirestoreReport(
  report: SafetyReport,
  note?: string,
  authorRole?: string
): Promise<boolean> {
  const path = `reports/${report.id}`;
  const deviceId = getStudentDeviceId();
  let didIncrementVote = false;

  try {
    const voteRef = doc(db, 'reports', report.id, 'votes', deviceId);
    const voteSnap = await getDocFromServer(voteRef);
    const alreadyVoted = voteSnap.exists();

    if (!alreadyVoted) {
      const snap = await getDocFromServer(doc(db, 'reports', report.id));
      if (!snap.exists()) {
        const coords = clampToPUJurisdiction(report.location);
        const seedData: Record<string, unknown> = {
          title: report.title.slice(0, 200),
          corridorName: report.corridorName.slice(0, 160),
          category: report.category,
          severity: report.severity,
          status: report.status === 'resolved' ? 'escalated' : report.status,
          authority: sanitizeAuthority(report.authority),
          description: report.description.slice(0, 1500),
          lightingCondition: report.lightingCondition.slice(0, 300),
          cctvPhase3Candidate: Boolean(report.cctvPhase3Candidate),
          peakRiskWindow: report.peakRiskWindow.slice(0, 100),
          upvotes: Math.min(100000, report.upvotes + 1),
          placeSearchQuery: report.placeSearchQuery.slice(0, 240),
          lat: coords.lat,
          lng: coords.lng,
          authorId: deviceId,
          isPublic: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (report.secondarySearchQuery) {
          seedData.secondarySearchQuery = report.secondarySearchQuery.slice(
            0,
            240
          );
        }
        if (report.formattedAddress) {
          seedData.formattedAddress = report.formattedAddress.slice(0, 300);
        }
        if (report.sourceCitation) {
          seedData.sourceCitation = report.sourceCitation.slice(0, 240);
        }
        if (report.officialRemarks) {
          seedData.officialRemarks = report.officialRemarks.slice(0, 600);
        }
        await setDoc(doc(db, 'reports', report.id), seedData);
      } else {
        const currentUpvotes = Number(snap.data().upvotes || report.upvotes);
        await updateDoc(doc(db, 'reports', report.id), {
          upvotes: Math.min(100000, currentUpvotes + 1),
          updatedAt: serverTimestamp(),
        });
      }

      await setDoc(voteRef, {
        reportId: report.id,
        deviceId,
        createdAt: serverTimestamp(),
      });
      markReportUpvotedLocally(report.id);
      didIncrementVote = true;
    }

    if (note && note.trim().length >= 1) {
      const obsId = `obs-${Date.now()}`;
      await setDoc(doc(db, 'reports', report.id, 'observations', obsId), {
        reportId: report.id,
        authorId: deviceId,
        authorRole: (authorRole || 'Panjab University Student')
          .trim()
          .slice(0, 120),
        note: note.trim().slice(0, 1000),
        isPublic: true,
        createdAt: serverTimestamp(),
      });
    }

    return didIncrementVote;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Saves resolved Places API coordinates back to Firestore.
 */
export async function updateFirestoreReportLocation(
  reportId: string,
  location: { lat: number; lng: number },
  formattedAddress?: string,
  placeId?: string
): Promise<void> {
  try {
    const snap = await getDocFromServer(doc(db, 'reports', reportId));
    if (!snap.exists()) return;
    const coords = clampToPUJurisdiction(location);
    const updatePayload: Record<string, unknown> = {
      lat: coords.lat,
      lng: coords.lng,
      updatedAt: serverTimestamp(),
    };
    if (formattedAddress) {
      updatePayload.formattedAddress = formattedAddress.slice(0, 300);
    }
    if (placeId) {
      updatePayload.placeId = placeId.slice(0, 200);
    }
    await updateDoc(doc(db, 'reports', reportId), updatePayload);
  } catch {
    // Non-fatal background cache write
  }
}

/**
 * Subscribes to observations in /reports/{reportId}/observations
 */
export function subscribeToReportObservations(
  reportId: string,
  baselineObservations: FieldObservation[],
  onUpdate: (observations: FieldObservation[]) => void
): () => void {
  const path = `reports/${reportId}/observations`;
  const q = query(collection(db, path), where('isPublic', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const fromFirestore: FieldObservation[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          authorRole: String(data.authorRole || 'Panjab University Student'),
          note: String(data.note || ''),
          timestamp: timestampToIso(data.createdAt),
        };
      });
      const existingIds = new Set(fromFirestore.map((o) => o.id));
      const merged = [
        ...fromFirestore,
        ...baselineObservations.filter((b) => !existingIds.has(b.id)),
      ].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      onUpdate(merged);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Updates authority status and official remarks in Firestore.
 */
export async function updateFirestoreAuthorityStatus(
  reportId: string,
  status: ResolutionStatus,
  officialRemarks: string
): Promise<void> {
  const path = `reports/${reportId}`;
  try {
    await updateDoc(doc(db, 'reports', reportId), {
      status,
      officialRemarks: officialRemarks.trim().slice(0, 600),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
