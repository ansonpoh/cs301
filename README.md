# Scrooge Global Bank — CRM frontend demo

A local React + TypeScript + Vite prototype for CS301, covering features 1–3. Features 4–6 are intentionally omitted. All client information is fictional.

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
