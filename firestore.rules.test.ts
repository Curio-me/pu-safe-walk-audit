/**
 * Security Rules Specification Test Suite — PU SafeWalk
 * Verifies that all "Dirty Dozen" adversarial payloads return PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  path: string;
  auth: {
    uid: string;
    email: string;
    email_verified: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TEST_CASES: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on Report Create',
    operation: 'create',
    path: '/reports/pu-rep-test-1',
    auth: { uid: 'student-1', email: 'student1@pu.ac.in', email_verified: true },
    payload: {
      title: 'Dark stretch near Hostel 4',
      corridorName: 'GH-4 Internal Road',
      category: 'dark_stretch',
      severity: 'high',
      status: 'reported',
      authority: 'PU Electrical Department',
      description: 'Three poles not working near gate.',
      lightingCondition: 'Completely dark',
      cctvPhase3Candidate: true,
      peakRiskWindow: '21:00 - 02:00 IST',
      upvotes: 1,
      placeSearchQuery: 'Girls Hostel 4 Panjab University Sector 14 Chandigarh',
      lat: 30.761,
      lng: 76.768,
      authorId: 'student-1',
      isPublic: true,
      isVerifiedShadowField: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Identity Spoofing on Report Create',
    operation: 'create',
    path: '/reports/pu-rep-test-2',
    auth: { uid: 'student-1', email: 'student1@pu.ac.in', email_verified: true },
    payload: {
      authorId: 'someone-else-uid',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Spoof Attack on Admin Action',
    operation: 'delete',
    path: '/reports/pu-rep-001',
    auth: {
      uid: 'attacker-uid',
      email: 'rajavikrant.developer@gmail.com',
      email_verified: false,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Out-of-Jurisdiction Coordinates Outside Panjab University',
    operation: 'create',
    path: '/reports/pu-rep-test-4',
    auth: { uid: 'student-1', email: 'student1@pu.ac.in', email_verified: true },
    payload: {
      lat: 28.6139,
      lng: 77.209,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Denial-of-Wallet Oversized String',
    operation: 'create',
    path: '/reports/pu-rep-test-5',
    auth: { uid: 'student-1', email: 'student1@pu.ac.in', email_verified: true },
    payload: {
      description: 'X'.repeat(5000),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'ID Poisoning Attack with Invalid Characters',
    operation: 'create',
    path: '/reports/invalid$id!@#',
    auth: { uid: 'student-1', email: 'student1@pu.ac.in', email_verified: true },
    payload: {},
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Upvote Manipulation Jump (+50 in one update)',
    operation: 'update',
    path: '/reports/pu-rep-001',
    auth: { uid: 'student-1', email: 'student1@pu.ac.in', email_verified: true },
    payload: {
      upvotes: 999,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immortal Field Mutation (changing authorId)',
    operation: 'update',
    path: '/reports/pu-rep-001',
    auth: { uid: 'student-1', email: 'student1@pu.ac.in', email_verified: true },
    payload: {
      authorId: 'hijacked-author-id',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Terminal State Bypass on Resolved Report',
    operation: 'update',
    path: '/reports/pu-rep-resolved',
    auth: { uid: 'student-2', email: 'student2@pu.ac.in', email_verified: true },
    payload: {
      upvotes: 10,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Orphaned Observation Write Without Parent Report',
    operation: 'create',
    path: '/reports/non-existent-report/observations/obs-orphan',
    auth: { uid: 'student-1', email: 'student1@pu.ac.in', email_verified: true },
    payload: {
      reportId: 'non-existent-report',
      authorId: 'student-1',
      authorRole: 'Student',
      note: 'Orphaned note',
      isPublic: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Private Document Read Attempt',
    operation: 'get',
    path: '/admins/other-admin-uid',
    auth: { uid: 'student-1', email: 'student1@pu.ac.in', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Client Timestamp Forgery on Create',
    operation: 'create',
    path: '/reports/pu-rep-test-12',
    auth: { uid: 'student-1', email: 'student1@pu.ac.in', email_verified: true },
    payload: {
      createdAt: '2020-01-01T00:00:00.000Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
