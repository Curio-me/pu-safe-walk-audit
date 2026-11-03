import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'pu_safety_reports.json');

interface FieldObservation {
  id: string;
  authorRole: string;
  note: string;
  timestamp: string;
}

interface SafetyReportRecord {
  id: string;
  title: string;
  corridorName: string;
  category: 'dark_stretch' | 'cctv_blind_spot' | 'vehicular_harassment' | 'canopy_obstruction';
  severity: 'critical' | 'high' | 'moderate';
  status: 'reported' | 'escalated' | 'work_order_issued' | 'resolved';
  authority:
    | 'PU Electrical Department'
    | 'Chief of University Security'
    | 'Dean Student Welfare (DSW)'
    | 'PUCSC Student Council'
    | 'Internal Complaints Committee (ICC)';
  description: string;
  lightingCondition: string;
  cctvPhase3Candidate: boolean;
  peakRiskWindow: string;
  upvotes: number;
  createdAt: string;
  updatedAt: string;
  sourceCitation?: string;
  officialRemarks?: string;
  placeSearchQuery: string;
  secondarySearchQuery?: string;
  location?: {
    lat: number;
    lng: number;
  };
  formattedAddress?: string;
  placeId?: string;
  observations: FieldObservation[];
}

const INITIAL_REPORTS: SafetyReportRecord[] = [
  {
    id: 'pu-rep-001',
    title: 'Unlit Internal Stretch: Boys Hostel No. 3 to Girls Hostels 1 & 2',
    corridorName: 'BH-3 to GH-1/GH-2 Internal Campus Link Road',
    category: 'dark_stretch',
    severity: 'critical',
    status: 'escalated',
    authority: 'PU Electrical Department',
    description:
      'Multiple consecutive non-functional streetlights create a deep dark patch along the internal Panjab University road used by women students walking back from AC Joshi Library late at night.',
    lightingCondition: 'Non-functional pole fixtures; heavy shadow pockets',
    cctvPhase3Candidate: true,
    peakRiskWindow: '21:30 – 02:30 IST',
    upvotes: 64,
    createdAt: '2026-11-01T00:15:00.000Z',
    updatedAt: '2026-11-02T18:30:00.000Z',
    sourceCitation: 'Times of India Chandigarh Report (Nov 1, 2026)',
    officialRemarks:
      'Escalated by PUCSC President Ankit Bidhan to the PU Electrical Department for urgent rectification.',
    placeSearchQuery: 'Boys Hostel 3 Panjab University Sector 14 Chandigarh',
    secondarySearchQuery: 'Girls Hostel 1 Panjab University Sector 14 Chandigarh',
    observations: [
      {
        id: 'obs-101',
        authorRole: 'Postgraduate Student (AC Joshi Library Reader)',
        note: 'Walked this stretch at 11:45 PM after study hours; three consecutive poles near the turn towards GH-1 were completely off.',
        timestamp: '2026-11-01T23:50:00.000Z',
      },
      {
        id: 'obs-102',
        authorRole: 'PUCSC Safety Volunteer',
        note: 'Verified pole numbers during evening inspection; included in the priority list submitted to the Executive Engineer (Electrical).',
        timestamp: '2026-11-02T14:20:00.000Z',
      },
    ],
  },
  {
    id: 'pu-rep-002',
    title: 'Dark Corridor: University Ground & Tennis Court to Girls Hostels 3, 4 & 5',
    corridorName: 'PU Sports Ground & Tennis Court – GH-3/4/5 Stretch',
    category: 'cctv_blind_spot',
    severity: 'critical',
    status: 'escalated',
    authority: 'Chief of University Security',
    description:
      'Isolated internal campus stretch passing between the Panjab University ground and tennis courts towards Girls Hostels 3, 4, and 5 lacks both perimeter illumination and active CCTV coverage.',
    lightingCondition: 'Sparse perimeter poles obstructed by foliage; zero camera overlap',
    cctvPhase3Candidate: true,
    peakRiskWindow: '20:30 – 03:00 IST',
    upvotes: 58,
    createdAt: '2026-11-01T01:10:00.000Z',
    updatedAt: '2026-11-02T19:00:00.000Z',
    sourceCitation: 'Times of India Chandigarh Report (Nov 1, 2026)',
    officialRemarks:
      'Flagged as a primary site under the proposed Rs 75 lakh Phase-3 CCTV installation covering 10 Panjab University locations.',
    placeSearchQuery: 'Girls Hostel 3 Panjab University Sector 14 Chandigarh',
    secondarySearchQuery: 'Lawn Tennis Courts Panjab University Sector 14 Chandigarh',
    observations: [
      {
        id: 'obs-103',
        authorRole: 'Hostel Resident (GH-4)',
        note: 'This stretch feels completely cut off after 9 PM because the sports ground side has no pedestrian floodlights.',
        timestamp: '2026-11-01T21:15:00.000Z',
      },
    ],
  },
  {
    id: 'pu-rep-003',
    title: 'Late-Night Exit Approach: AC Joshi Library Outer Ring & Cycle Stand Path',
    corridorName: 'AC Joshi Library 24x7 Reading Hall Internal Exit',
    category: 'dark_stretch',
    severity: 'high',
    status: 'work_order_issued',
    authority: 'PU Electrical Department',
    description:
      'While AC Joshi Library remains open round the clock, the immediate pedestrian exit pathways connecting the outer reading hall cycle stand to internal hostel roads have dim lighting and tree canopy blockage.',
    lightingCondition: 'Low-lumen coverage beneath dense peepal/neem canopy',
    cctvPhase3Candidate: true,
    peakRiskWindow: '22:00 – 04:00 IST',
    upvotes: 49,
    createdAt: '2026-11-01T04:00:00.000Z',
    updatedAt: '2026-11-02T16:45:00.000Z',
    sourceCitation: 'Times of India Chandigarh Report (Nov 1, 2026)',
    officialRemarks:
      'Pruning of low-hanging branches and replacement of 4 LED luminaires scheduled with PU Electrical Wing.',
    placeSearchQuery: 'AC Joshi Library Panjab University Sector 14 Chandigarh',
    observations: [
      {
        id: 'obs-104',
        authorRole: 'Research Scholar (Department of Laws)',
        note: 'Leaving the library at 1 AM is stressful when cars slow down near the unlit cycle stand junction.',
        timestamp: '2026-11-02T01:20:00.000Z',
      },
    ],
  },
  {
    id: 'pu-rep-004',
    title: 'Vehicular Harassment & "Geri" Hotspot: StuC to Vice-Chancellor Office Corridor',
    corridorName: 'Student Centre (StuC) – VC Office Internal Campus Road',
    category: 'vehicular_harassment',
    severity: 'high',
    status: 'reported',
    authority: 'Dean Student Welfare (DSW)',
    description:
      'Unrestricted four-wheeler movement in the evening enables cars to follow women students and pass comments along internal Panjab University roads. Student organisations staged an Oct 30 protest demanding a four-wheeler ban and 24/7 free campus shuttle transport.',
    lightingCondition: 'Intermittent street lighting; high glare from oncoming vehicles',
    cctvPhase3Candidate: true,
    peakRiskWindow: '19:30 – 23:30 IST',
    upvotes: 72,
    createdAt: '2026-10-30T18:00:00.000Z',
    updatedAt: '2026-11-02T12:00:00.000Z',
    sourceCitation: 'Times of India Report — Oct 27 "Half the Sky" & Oct 30 Protest',
    officialRemarks:
      'Under review following student memorandum demanding vehicle-free internal corridors and strict checking at PU Gates 1, 2, and 3.',
    placeSearchQuery: 'Student Centre Panjab University Sector 14 Chandigarh',
    observations: [
      {
        id: 'obs-105',
        authorRole: 'Participant ("Half the Sky" Forum)',
        note: 'Cars repeatedly cruise slowly along this stretch after dusk; strict four-wheeler curbing and night shuttle frequency are urgently needed.',
        timestamp: '2026-10-31T20:10:00.000Z',
      },
    ],
  },
  {
    id: 'pu-rep-005',
    title: 'Unlit Internal Approach Road Inside PU Gate No. 2 (Towards Girls Hostels)',
    corridorName: 'PU Gate No. 2 Internal Security Checkpost to Girls Hostels Stretch',
    category: 'cctv_blind_spot',
    severity: 'critical',
    status: 'escalated',
    authority: 'Chief of University Security',
    description:
      'Internal approach stretch inside Panjab University Gate No. 2 leading towards Girls Hostels 1 and 2 has dim boundary lighting and needs ANPR / Phase-3 CCTV surveillance to log external vehicles entering campus at night.',
    lightingCondition: 'Shadowed internal footpath near Gate No. 2 security cabin',
    cctvPhase3Candidate: true,
    peakRiskWindow: '20:00 – 01:00 IST',
    upvotes: 83,
    createdAt: '2026-10-29T21:45:00.000Z',
    updatedAt: '2026-11-02T20:15:00.000Z',
    sourceCitation: 'Times of India Report — Campus Gate Entry & Surveillance Audit',
    officialRemarks:
      'Priority location under PU Security Chief for Gate No. 2 vehicle screening and Phase-3 CCTV camera placement.',
    placeSearchQuery: 'Gate No 2 Panjab University Sector 14 Chandigarh',
    secondarySearchQuery: 'Girls Hostel 1 Panjab University Sector 14 Chandigarh',
    observations: [
      {
        id: 'obs-106',
        authorRole: 'Undergraduate Student (Sector 14 Campus)',
        note: 'Need high-mast lighting and strict 4-wheeler entry logging right inside PU Gate No. 2.',
        timestamp: '2026-11-01T19:40:00.000Z',
      },
    ],
  },
];

function loadReports(): SafetyReportRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_REPORTS, null, 2), 'utf-8');
      return INITIAL_REPORTS;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as SafetyReportRecord[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure legacy outside-campus Sector 15 entry is migrated to internal PU Gate 2 jurisdiction
      let migrated = false;
      const updated = parsed.map((item) => {
        if (item.id === 'pu-rep-005' && item.placeSearchQuery === 'Sector 15 Market Chandigarh') {
          migrated = true;
          return {
            ...INITIAL_REPORTS[4],
            upvotes: item.upvotes,
          };
        }
        return item;
      });
      if (migrated) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(updated, null, 2), 'utf-8');
      }
      return updated;
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_REPORTS, null, 2), 'utf-8');
    return INITIAL_REPORTS;
  } catch (err) {
    console.error('Error loading safety reports:', err);
    return INITIAL_REPORTS;
  }
}

function saveReports(reports: SafetyReportRecord[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(reports, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving safety reports:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/reports', (_req, res) => {
    const reports = loadReports();
    res.json({ reports });
  });

  app.post('/api/reports', (req, res) => {
    const reports = loadReports();
    const {
      title,
      corridorName,
      category,
      severity,
      authority,
      description,
      lightingCondition,
      cctvPhase3Candidate,
      peakRiskWindow,
      placeSearchQuery,
      location,
      formattedAddress,
      placeId,
      reporterRole,
      initialNote,
    } = req.body;

    if (!title || !corridorName || !category || !severity || !authority || !description) {
      res.status(400).json({ error: 'Missing required report fields.' });
      return;
    }

    const now = new Date().toISOString();
    const newReport: SafetyReportRecord = {
      id: `pu-rep-${Date.now()}`,
      title: String(title).slice(0, 140),
      corridorName: String(corridorName).slice(0, 120),
      category,
      severity,
      status: 'reported',
      authority,
      description: String(description).slice(0, 600),
      lightingCondition: String(lightingCondition || 'Unlit / Faulty Streetlight').slice(0, 160),
      cctvPhase3Candidate: Boolean(cctvPhase3Candidate),
      peakRiskWindow: String(peakRiskWindow || '20:00 – 02:00 IST').slice(0, 60),
      upvotes: 1,
      createdAt: now,
      updatedAt: now,
      sourceCitation: 'Crowdsourced PU Student Field Audit',
      placeSearchQuery: String(placeSearchQuery || `${corridorName} Panjab University Sector 14 Chandigarh`),
      location:
        location && typeof location.lat === 'number' && typeof location.lng === 'number'
          ? { lat: location.lat, lng: location.lng }
          : undefined,
      formattedAddress: formattedAddress ? String(formattedAddress) : undefined,
      placeId: placeId ? String(placeId) : undefined,
      observations: initialNote
        ? [
            {
              id: `obs-${Date.now()}`,
              authorRole: String(reporterRole || 'PU Student Reporter').slice(0, 80),
              note: String(initialNote).slice(0, 300),
              timestamp: now,
            },
          ]
        : [],
    };

    reports.unshift(newReport);
    saveReports(reports);
    res.status(201).json({ report: newReport });
  });

  app.post('/api/reports/:id/upvote', (req, res) => {
    const reports = loadReports();
    const report = reports.find((r) => r.id === req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    report.upvotes += 1;
    report.updatedAt = new Date().toISOString();

    const { note, authorRole } = req.body || {};
    if (note && String(note).trim().length > 0) {
      report.observations.unshift({
        id: `obs-${Date.now()}`,
        authorRole: String(authorRole || 'PU Student Verifier').slice(0, 80),
        note: String(note).trim().slice(0, 300),
        timestamp: report.updatedAt,
      });
    }

    saveReports(reports);
    res.json({ report });
  });

  app.patch('/api/reports/:id/status', (req, res) => {
    const reports = loadReports();
    const report = reports.find((r) => r.id === req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const { status, officialRemarks } = req.body || {};
    if (status && ['reported', 'escalated', 'work_order_issued', 'resolved'].includes(status)) {
      report.status = status;
    }
    if (typeof officialRemarks === 'string' && officialRemarks.trim().length > 0) {
      report.officialRemarks = officialRemarks.trim().slice(0, 400);
    }
    report.updatedAt = new Date().toISOString();

    saveReports(reports);
    res.json({ report });
  });

  app.patch('/api/reports/:id/resolve-location', (req, res) => {
    const reports = loadReports();
    const report = reports.find((r) => r.id === req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const { location, formattedAddress, placeId } = req.body || {};
    if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
      report.location = { lat: location.lat, lng: location.lng };
    }
    if (formattedAddress) {
      report.formattedAddress = String(formattedAddress);
    }
    if (placeId) {
      report.placeId = String(placeId);
    }

    saveReports(reports);
    res.json({ report });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PU SafeWalk server listening on http://localhost:${PORT}`);
  });
}

startServer();
