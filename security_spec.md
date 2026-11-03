# Security Specification — PU SafeWalk (Panjab University Dark-Spot & Safety Ledger)

## 1. Data Invariants

1. **Default-Deny Catch-All:** All paths not explicitly matched (`/admins/{adminId}`, `/reports/{reportId}`, `/reports/{reportId}/observations/{observationId}`) are unconditionally denied (`allow read, write: if false;`).
2. **Panjab University Geographic Jurisdiction Invariant:** Every `SafetyReport` document MUST have numeric coordinates strictly bounded within Panjab University Chandigarh jurisdiction (`lat >= 30.735 && lat <= 30.770`, `lng >= 76.745 && lng <= 76.780`).
3. **Identity & Verification Invariant:** All write operations (`create`, `update`, `delete`) require an authenticated Google user with `request.auth.token.email_verified == true`. On `create`, `incoming().authorId == request.auth.uid`.
4. **Temporal Integrity Invariant:** `createdAt` and `updatedAt` must equal `request.time` on `create`. On `update`, `createdAt` and `authorId` are immutable (`incoming().createdAt == existing().createdAt && incoming().authorId == existing().authorId`) and `updatedAt == request.time`.
5. **Action-Based Update & Terminal State Invariant:** Once a `SafetyReport` reaches terminal state `status == 'resolved'`, no non-admin updates are permitted. Updates must match one of the explicit action branches (`upvote`, `resolveLocation`, `updateStatus`, or `isAdmin()`) using `incoming().diff(existing()).affectedKeys().hasOnly(...)` wrapped inside `isValidReport(incoming())`.
6. **Master Gate Relational Invariant:** Creating a `FieldObservation` in `/reports/{reportId}/observations/{observationId}` requires that the parent `/reports/{reportId}` exists (`exists(...)`), is not in terminal `'resolved'` state, and `incoming().reportId == reportId`.
7. **Query Enforcer Invariant:** Every `allow list` rule explicitly evaluates `resource.data.isPublic == true` without relying on blanket `isSignedIn()` reads or expensive `get()` calls inside list blocks.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Shadow Field Injection on Report Create):** Includes unauthorized `"isVerified": true` field outside the allowed keys list.
2. **Payload 2 (Identity Spoofing on Report Create):** Sets `"authorId": "spoofed-uid-999"` while authenticated as `"student-uid-123"`.
3. **Payload 3 (Unverified Email Spoof Attack):** Authenticated token has `email == "rajavikrant.developer@gmail.com"` but `email_verified == false`.
4. **Payload 4 (Out-of-Jurisdiction Coordinates):** Attempts to create a report outside Panjab University (`lat: 28.6139, lng: 77.2090`).
5. **Payload 5 (Denial-of-Wallet Oversized String):** Sends a 5,000-character `description` exceeding `maxLength: 1500`.
6. **Payload 6 (ID Poisoning Attack):** Attempts to create a report with an invalid document ID containing spaces/slashes or >128 characters.
7. **Payload 7 (Upvote Manipulation / Jump):** Attempts to increment `upvotes` by +50 in a single update (`incoming().upvotes == existing().upvotes + 50`).
8. **Payload 8 (Immortal Field Mutation):** Attempts to alter `authorId` or `createdAt` during an update.
9. **Payload 9 (Terminal State Bypass):** Attempts to upvote or modify a report whose `existing().status == 'resolved'` as a non-admin.
10. **Payload 10 (Orphaned Observation Write):** Attempts to create an observation under `/reports/non-existent-report/observations/obs-1` where the parent report does not exist.
11. **Payload 11 (Unfiltered / Non-Public List Query):** Attempts to list documents where `isPublic == false`.
12. **Payload 12 (Client Timestamp Forgery):** Attempts to backdate `createdAt` to a past timestamp instead of `request.time`.
