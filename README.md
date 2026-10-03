# Scrooge Global Bank — CRM frontend demo

A local React + TypeScript + Vite prototype for CS301, covering features 1–6. All client information is fictional.

## Run locally

Requires Node.js 20.19+ or a newer supported LTS version, and npm.

```sh
npm install
npm run dev
```

Open the localhost address printed by Vite. Keep the terminal running during your presentation.

```sh
npm test
npm run build
npm run preview
npm run format
```

`build` checks TypeScript and generates a static production bundle in `dist`. No backend or API credentials are needed. Fonts use Google Fonts when online, with local sans-serif fallbacks offline.

## Five-minute walkthrough

1. Choose **Rachel Tan**, continue, and enter the simulated MFA code **123456**.
2. Explore Overview, then choose **Add client**. Complete the three-step form using fictional information. Phone numbers use 10–15 digits (for example +6587654321); Singapore postal codes use six digits.
3. In the new profile, choose **Verify identity**, select a simulated outcome, check the review box, and finish the review.
4. Open **Accounts → Open account**. Create an SGD account with an initial deposit and a branch ID.
5. Open **Transactions → Import transactions**. Choose success, partial success, connection failure, corrupted file, or system exception. Expand Import history to inspect timestamps and rejection reasons. Repeat a scenario to demonstrate duplicate rejection.
6. Use the sign-out icon beside your name in the sidebar. Sign in as **Marcus Lee** to see a different client portfolio.
7. Sign in as **Alex Morgan** to create/edit/disable users and view the administrator-only audit log (Appendix 2 columns: ISO 8601 time, CRUD, attribute, before/after values, agent ID, client ID). The root admin cannot be disabled, deleted, or demoted.
8. To restart the demo, choose **User management → Reset demo data** and confirm.

## Feature 4: product recommendations

1. As **Rachel Tan**, the Overview shows **Next best actions**: the top open recommendation per client, plus deferred follow-ups. Choose a row to open that client's **Recommendations** tab.
2. Each card shows the product, match score and reasons. **Simulate terms** checks requested amount, tenure or rate against pre-approval limits (Pre-approved or Manager override required).
3. **Record outcome**: Accepted (application link, brochure, or open a pending account that is linked to the recommendation), Rejected (reason required; the product category is suppressed for 90 days), or Deferred (reason and follow-up date).
4. **Refresh** regenerates the set. Choose a failure scenario to see the FALLBACK path, where eligibility rules rank the products. Expand **What the AI service received** to see the masked payload.
5. Audit events: `RECO_GENERATED` (products, scores, reasons, model, prompt version, fallback), `RECO_VIEWED`, `RECO_SIMULATED`, `RECO_OUTCOME`, `RECO_AI_FAILURE`, `RECO_CONSENT`.

The AI service is simulated in [src/lib/recommend.ts](src/lib/recommend.ts): it is deterministic, receives only banded, de-identified data, and may only rank eligible catalogue products. Sets are cached until the client's profile, accounts, transactions, open cases or suppressions change. Withdrawn consent stops generation, and deleting a client deletes their recommendations. The product catalogue is seeded; there is no admin editing screen yet.

## Feature 5: attrition risk and retention

1. As **Rachel Tan**, the Overview banner and the **Retention** badge show clients at high attrition risk. Open **Retention** for the dashboard: open flags sorted by risk, each with its triggering reason (for example "56% balance drop in 30 days").
2. Open **James Teo**. The page explains the flag and charts the balance over the last 30 days. Choose **Log intervention**, pick an action (Follow-up Scheduled also needs a date) and add notes. The client moves to **Under Review**.
3. **Update status** moves the client to **Mitigated** or **Churned** (a note is required). Only At Risk → Under Review → Mitigated/Churned is allowed; At Risk can also go straight to Churned.
4. Sign in as **Alex Morgan** for the system-wide view and **Retention by agent** (success rate = mitigated ÷ closed). Admins can view everything but cannot log interventions. **Run analysis now** triggers the daily job.
5. Audit events: `RISK_VIEWED` (filters and result count), `INTERVENTION_LOGGED` (type; notes PII-filtered), `STATUS_UPDATED` (attribute Risk Status, from/to), plus `RISK_FLAGGED` and `RISK_UPDATED` from the job (actor `SYSTEM`).

The scheduled job is simulated in [src/lib/retention.ts](src/lib/retention.ts) and runs at sign-in and every minute. It reads completed transactions as of the latest core-banking data, not today's date, so the demo does not drift. Signals: a balance drop of 25% or 50% from the 30-day peak, no activity for 30 days, deposits stopped for 21 days, and transaction frequency halving. An unresolved complaint adds weight but never flags a client on its own. A score of 50+ is High and 25+ is Medium. A closed flag is raised again only if the risk persists 30 days after closing. Encryption at rest is simulated. Deleting a client deletes their risk profile and intervention notes.

## Feature 6: complaints and disputes

1. As **Rachel Tan**, open **Cases**. CASE-1001 is already escalated: the automated SLA check (3 business days) runs at sign-in and every minute.
2. Open a client profile and choose **Raise complaint/dispute**. Transaction disputes must link one of that client's transactions; other categories can link one optionally.
3. Open a case and move it **Open → Investigating → Resolved**. A note is required for each step.
4. Sign in as **Alex Morgan**. The Overview banner and the sidebar badge show escalated cases. Open one and choose **Reassign**; the new agent gets a fresh SLA window. **SLA · 3 business days** changes the SLA.
5. Check the **Audit log** for `CASE_CREATED`, `STATUS_UPDATED`, `CASE_VIEWED` (one per search, with filters and result count), `ESCALATED` (actor `SYSTEM`) and `REASSIGNED`.

Simulated parts: the SES email, the scheduled job (a browser timer), and KMS encryption at rest. Notes are PII-filtered before they are logged. Deleting a client scrubs their case text but keeps the case records and audit entries. Agents see their own clients' cases plus cases reassigned to them; only the assigned agent can update a case.

## Demo boundaries

- Users, client records, accounts, transactions, import history, and audit events persist in this browser under `scrooge-demo-v1`. Each browser/origin has separate data. Signing in again is required after refreshing.
- Authentication, MFA, password reset, identity verification, external banking imports, and audit protection are simulations. No real passwords, documents, emails, transfers, or bank connections are used.
- Client-side role checks demonstrate intended workflows; they are not a security boundary. A production backend must enforce authorization and audit integrity.
- Agents manage only their own clients. Administrators inspect all clients and activity, but client/account editing and import controls belong to agent workflows.
- Deleting an account removes its associated demo transactions. Clients with linked accounts cannot be deleted. Agents with assigned clients cannot be deleted or changed to admins; disabling them is allowed.
- Imports use deterministic IDs for up to three visible accounts, including newly created accounts first. Repeat runs reject duplicates. Failed connection scenarios receive zero records.
- Dashboard volumes are derived from completed demo records. Initial deposits are shown separately and are not calculated account balances.
- Name, age, contact, address, and Singapore postal-code validation follow Appendix 2. Audit records keep before/after values for changed fields; PII (names, email, phone, address, date of birth, postal code) is partially masked before it is logged, while non-PII fields (gender, city, state, verification, role) are stored in full.

## Structure and future integration

- `src/features/` contains overview, client/account, transaction, user, and audit screens.
- `src/components/ui.tsx` provides shared dialogs, fields, badges, formatting, and empty states.
- `src/lib/types.ts` defines the frontend models. `service.ts` provides asynchronous demo operations and `seed.ts` supplies fictional data.
- Replace `DemoService` with authenticated API calls when adding a backend, including server-side filtering, validation, durable logging, and error handling. Browser data currently supplies the whole demo; future APIs must return only authorized records.
- Add later features as separate modules and navigation entries; no speculative innovation features are included now.

Automated tests cover validation boundaries, ownership restrictions, admin protection, onboarding, imports, duplicate handling, persistence, and reset.
