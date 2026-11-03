import { SafetyReport } from '../types';

/**
 * Baseline Panjab University dark spots (Sector 14 & Sector 25) initialized with 1 vote each.
 * Pre-grounded with campus coordinates so pins render immediately without consuming Places API quota.
 */
export const INITIAL_PU_REPORTS: SafetyReport[] = [
  {
    id: 'pu-v2-001',
    title: 'Boys Hostel No. 3 to Girls Hostels 1 & 2',
    corridorName: 'Boys Hostel No. 3 to Girls Hostels 1 & 2',
    category: 'dark_stretch',
    severity: 'critical',
    status: 'reported',
    authority: 'PU Electrical Department',
    description:
      'Unlit pedestrian stretch between Boys Hostel No. 3 and the approach road to Mata Gujri Hall (GH-1) and Laxmi Bai Hall (GH-2). Multiple pole lights remain non-functional after 9 PM.',
    lightingCondition: 'Multiple non-functional pole lamps (~4 lux)',
    cctvPhase3Candidate: true,
    peakRiskWindow: '20:30 – 01:30 IST',
    upvotes: 1,
    createdAt: '2026-03-01T18:00:00.000Z',
    updatedAt: '2026-03-01T18:00:00.000Z',
    sourceCitation: 'PU Student Campus Safety Audit',
    placeSearchQuery:
      'Girls Hostel 1 Panjab University Sector 14 Chandigarh',
    secondarySearchQuery:
      'Boys Hostel 3 Panjab University Sector 14 Chandigarh',
    location: {
      lat: 30.7592,
      lng: 76.7668,
    },
    formattedAddress:
      'Boys Hostel No. 3 to Girls Hostels 1 & 2, Sector 14, Panjab University, Chandigarh 160014',
    observations: [],
  },
  {
    id: 'pu-v2-002',
    title: 'University Ground & Tennis Court to Girls Hostels 3, 4 & 5',
    corridorName: 'University Ground & Tennis Court to Girls Hostels 3, 4 & 5',
    category: 'canopy_obstruction',
    severity: 'critical',
    status: 'reported',
    authority: 'Dean Student Welfare (DSW)',
    description:
      'Dense overhanging tree canopy and unlit perimeter path running alongside the University Sports Ground & Tennis Courts toward Sarojini Hall (GH-3), Kasturba Hall (GH-4), and Savitribai Phule Hall (GH-5).',
    lightingCondition: 'Severe canopy shadow & unlit sports ground fence',
    cctvPhase3Candidate: true,
    peakRiskWindow: '20:00 – 23:30 IST',
    upvotes: 1,
    createdAt: '2026-03-01T18:05:00.000Z',
    updatedAt: '2026-03-01T18:05:00.000Z',
    sourceCitation: 'PU Student Campus Safety Audit',
    placeSearchQuery:
      'Girls Hostel 3 Panjab University Sector 14 Chandigarh',
    secondarySearchQuery:
      'Sports Ground Panjab University Sector 14 Chandigarh',
    location: {
      lat: 30.7581,
      lng: 76.7654,
    },
    formattedAddress:
      'Sports Ground to Girls Hostels 3, 4 & 5 Corridor, Sector 14, Panjab University, Chandigarh 160014',
    observations: [],
  },
  {
    id: 'pu-v2-003',
    title: 'AC Joshi Library 24x7 Reading Hall Outer Ring',
    corridorName: 'AC Joshi Library 24x7 Reading Hall Outer Ring',
    category: 'dark_stretch',
    severity: 'critical',
    status: 'reported',
    authority: 'PU Electrical Department',
    description:
      'Outer ring walkway and cycle parking stretch around AC Joshi Library used by students leaving the 24x7 reading hall late at night. Dim sodium lamps leave blind corners along the rear path.',
    lightingCondition: 'Dim outer ring walkway with unlit cycle stand corners',
    cctvPhase3Candidate: true,
    peakRiskWindow: '22:00 – 03:30 IST',
    upvotes: 1,
    createdAt: '2026-03-01T18:10:00.000Z',
    updatedAt: '2026-03-01T18:10:00.000Z',
    sourceCitation: 'PU Student Campus Safety Audit',
    placeSearchQuery:
      'AC Joshi Library Panjab University Sector 14 Chandigarh',
    location: {
      lat: 30.7607,
      lng: 76.7694,
    },
    formattedAddress:
      'AC Joshi Library Outer Ring, Sector 14, Panjab University, Chandigarh 160014',
    observations: [],
  },
  {
    id: 'pu-v2-004',
    title: 'Student Centre (StuC) to Vice-Chancellor Office Corridor',
    corridorName: 'Student Centre (StuC) to Vice-Chancellor Office Corridor',
    category: 'cctv_blind_spot',
    severity: 'high',
    status: 'reported',
    authority: 'Chief of University Security',
    description:
      'Main administrative and pedestrian corridor linking Student Centre (StuC) parking to the Vice-Chancellor Office becomes deserted and dimly lit after StuC eateries close.',
    lightingCondition: 'Wide road with weak pedestrian footpath illumination',
    cctvPhase3Candidate: true,
    peakRiskWindow: '21:30 – 01:00 IST',
    upvotes: 1,
    createdAt: '2026-03-01T18:15:00.000Z',
    updatedAt: '2026-03-01T18:15:00.000Z',
    sourceCitation: 'PU Student Campus Safety Audit',
    placeSearchQuery:
      'Student Centre Panjab University Sector 14 Chandigarh',
    secondarySearchQuery:
      'Vice Chancellor Office Panjab University Sector 14 Chandigarh',
    location: {
      lat: 30.7615,
      lng: 76.7684,
    },
    formattedAddress:
      'Student Centre to VC Office Corridor, Sector 14, Panjab University, Chandigarh 160014',
    observations: [],
  },
  {
    id: 'pu-v2-005',
    title: 'Girls Hostels 6 & 7 Approach Road (Sector 14)',
    corridorName: 'Girls Hostels 6 & 7 Approach Road (Sector 14)',
    category: 'dark_stretch',
    severity: 'critical',
    status: 'reported',
    authority: 'Dean Student Welfare (DSW)',
    description:
      'Approach road leading to Mother Teresa Hall (GH-6) and Bebe Nanki Hall (GH-7) in the southern residential pocket of Sector 14 has dark stretches and isolated turns.',
    lightingCondition: 'Intermittent streetlamps along hostel approach road',
    cctvPhase3Candidate: true,
    peakRiskWindow: '20:30 – 01:00 IST',
    upvotes: 1,
    createdAt: '2026-03-01T18:20:00.000Z',
    updatedAt: '2026-03-01T18:20:00.000Z',
    sourceCitation: 'PU Student Campus Safety Audit',
    placeSearchQuery:
      'Girls Hostel 6 Panjab University Sector 14 Chandigarh',
    secondarySearchQuery:
      'Girls Hostel 7 Panjab University Sector 14 Chandigarh',
    location: {
      lat: 30.7573,
      lng: 76.7642,
    },
    formattedAddress:
      'Girls Hostels 6 & 7 Approach Road, Sector 14, Panjab University, Chandigarh 160014',
    observations: [],
  },
  {
    id: 'pu-v2-006',
    title: 'UIET Academic Block to Girls Hostels 8, 9 & 10 (Sector 25 South Campus)',
    corridorName:
      'UIET Academic Block to Girls Hostels 8, 9 & 10 (Sector 25 South Campus)',
    category: 'dark_stretch',
    severity: 'critical',
    status: 'reported',
    authority: 'PU Electrical Department',
    description:
      'Internal South Campus road connecting UIET and Dental Institute academic blocks to Florence Nightingale Hall (GH-8), Amrita Pritam Hall (GH-9), and Neerja Bhanot Hall (GH-10) in Sector 25.',
    lightingCondition: 'Long dark stretch between academic & residential blocks',
    cctvPhase3Candidate: true,
    peakRiskWindow: '20:00 – 01:30 IST',
    upvotes: 1,
    createdAt: '2026-03-01T18:25:00.000Z',
    updatedAt: '2026-03-01T18:25:00.000Z',
    sourceCitation: 'PU Student Campus Safety Audit',
    placeSearchQuery:
      'UIET Panjab University Sector 25 Chandigarh',
    secondarySearchQuery:
      'Girls Hostel 8 Panjab University Sector 25 Chandigarh',
    location: {
      lat: 30.7481,
      lng: 76.7568,
    },
    formattedAddress:
      'UIET to Girls Hostels 8, 9 & 10, Sector 25 South Campus, Panjab University, Chandigarh 160014',
    observations: [],
  },
  {
    id: 'pu-v2-007',
    title: 'Gandhi Bhawan to Department of Laws Walkway',
    corridorName: 'Gandhi Bhawan to Department of Laws Walkway',
    category: 'canopy_obstruction',
    severity: 'high',
    status: 'reported',
    authority: 'PU Electrical Department',
    description:
      'Pedestrian footpath between Gandhi Bhawan pond perimeter and the Department of Laws / Arts Blocks is heavily shaded by low tree branches blocking overhead street lighting.',
    lightingCondition: 'Tree foliage obstructing overhead LED fixtures',
    cctvPhase3Candidate: true,
    peakRiskWindow: '19:30 – 23:30 IST',
    upvotes: 1,
    createdAt: '2026-03-01T18:30:00.000Z',
    updatedAt: '2026-03-01T18:30:00.000Z',
    sourceCitation: 'PU Student Campus Safety Audit',
    placeSearchQuery:
      'Gandhi Bhawan Panjab University Sector 14 Chandigarh',
    secondarySearchQuery:
      'Department of Laws Panjab University Sector 14 Chandigarh',
    location: {
      lat: 30.7611,
      lng: 76.7706,
    },
    formattedAddress:
      'Gandhi Bhawan to Department of Laws Walkway, Sector 14, Panjab University, Chandigarh 160014',
    observations: [],
  },
  {
    id: 'pu-v2-008',
    title: 'PU Gate No. 2 Internal Security Checkpost Approach',
    corridorName: 'PU Gate No. 2 Internal Security Checkpost Approach',
    category: 'vehicular_harassment',
    severity: 'high',
    status: 'reported',
    authority: 'Chief of University Security',
    description:
      'Internal approach road inside PU Gate No. 2 experiences fast-moving late-evening vehicular traffic and poor pedestrian sidewalk visibility just past the security checkpost.',
    lightingCondition: 'High glare from vehicle headlights, dim pedestrian verge',
    cctvPhase3Candidate: true,
    peakRiskWindow: '21:00 – 02:00 IST',
    upvotes: 1,
    createdAt: '2026-03-01T18:35:00.000Z',
    updatedAt: '2026-03-01T18:35:00.000Z',
    sourceCitation: 'PU Student Campus Safety Audit',
    placeSearchQuery:
      'Gate No 2 Panjab University Sector 14 Chandigarh',
    location: {
      lat: 30.7576,
      lng: 76.7689,
    },
    formattedAddress:
      'PU Gate No. 2 Internal Security Checkpost Approach, Sector 14, Panjab University, Chandigarh 160014',
    observations: [],
  },
];
