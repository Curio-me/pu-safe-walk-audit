export type HazardCategory =
  | 'dark_stretch'
  | 'cctv_blind_spot'
  | 'vehicular_harassment'
  | 'canopy_obstruction';

export type HazardSeverity = 'critical' | 'high' | 'moderate';

export type ResolutionStatus =
  | 'reported'
  | 'escalated'
  | 'work_order_issued'
  | 'resolved';

export type AuthorityDepartment =
  | 'PU Electrical Department'
  | 'Chief of University Security'
  | 'Dean Student Welfare (DSW)'
  | 'PUCSC Student Council'
  | 'Internal Complaints Committee (ICC)';

export interface FieldObservation {
  id: string;
  authorRole: string;
  note: string;
  timestamp: string;
}

export interface SafetyReport {
  id: string;
  title: string;
  corridorName: string;
  category: HazardCategory;
  severity: HazardSeverity;
  status: ResolutionStatus;
  authority: AuthorityDepartment;
  description: string;
  lightingCondition: string;
  cctvPhase3Candidate: boolean;
  peakRiskWindow: string;
  upvotes: number;
  createdAt: string;
  updatedAt: string;
  sourceCitation?: string;
  officialRemarks?: string;
  /**
   * Search query used to dynamically resolve coordinates via Google Maps Places API (New)
   * so no place data is hardcoded from LLM memory.
   */
  placeSearchQuery: string;
  secondarySearchQuery?: string;
  /**
   * Coordinates populated either from live user map click or live Places API (New) resolution.
   */
  location?: {
    lat: number;
    lng: number;
  };
  formattedAddress?: string;
  placeId?: string;
  observations: FieldObservation[];
}

export interface WalkingCorridorPreset {
  id: string;
  name: string;
  originQuery: string;
  destinationQuery: string;
  viaDescription: string;
  riskSummary: string;
  toiReference: string;
}
