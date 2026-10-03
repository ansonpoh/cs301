import type {
  Account,
  AssetType,
  Client,
  ClaimAssessment,
  EvidenceScenario,
  IdentityScenario,
  WealthAsset,
  WealthCase,
  WealthEvidence,
  WealthOrigin,
  WealthStatus,
} from './types';

const DAY = 86_400_000;

// Demo policy: source-of-wealth review is required once a client's deposits with the bank reach
// this amount. Below it, identity verification alone activates pending accounts.
export const WEALTH_REVIEW_THRESHOLD = 200_000;
// A valuation older than this is flagged as stale during analysis.
export const VALUATION_MAX_AGE_DAYS = 365;
// Documented and declared values within this share of each other corroborate the valuation.
export const VALUE_TOLERANCE = 0.1;
// The client's upload link stops working after this many days (simulated).
export const UPLOAD_LINK_DAYS = 7;

export const ASSET_TYPES: AssetType[] = [
  'Stocks / funds',
  'Crypto',
  'Property',
  'Business interest',
];
export const WEALTH_ORIGINS: WealthOrigin[] = [
  'Employment income',
  'Business proceeds',
  'Inheritance',
  'Investment gains',
  'Property sale',
  'Other',
];
export const WEALTH_STATUSES: WealthStatus[] = [
  'Pending Evidence',
  'Under Review',
  'More Information Required',
  'Verified',
  'Rejected',
];
export const isFinalWealth = (s: WealthStatus) => s === 'Verified' || s === 'Rejected';
// The agent can add evidence and edit the declaration only in these states.
export const isEditableWealth = (s: WealthStatus) =>
  s === 'Pending Evidence' || s === 'More Information Required';

type Check = 'ownership' | 'valuation' | 'origin';
export interface EvidenceRequirement {
  docType: string;
  checks: Check[];
}
// Evidence the bank's policy asks for, by asset type. Each document supports one or more claims.
export const EVIDENCE_REQUIREMENTS: Record<AssetType, EvidenceRequirement[]> = {
  'Stocks / funds': [
    { docType: 'Broker or custodian statement', checks: ['ownership', 'valuation'] },
    { docType: 'Acquisition records', checks: ['origin'] },
  ],
  Crypto: [
    { docType: 'Exchange transaction history', checks: ['valuation', 'origin'] },
    { docType: 'Wallet-control evidence', checks: ['ownership'] },
  ],
  Property: [
    { docType: 'Ownership record', checks: ['ownership'] },
    { docType: 'Independent valuation', checks: ['valuation'] },
    { docType: 'Acquisition or sale documents', checks: ['origin'] },
  ],
  'Business interest': [
    { docType: 'Shareholding record', checks: ['ownership'] },
    { docType: 'Financial statements', checks: ['valuation'] },
    { docType: 'Business sale or funding documents', checks: ['origin'] },
  ],
};

// The user's calendar date (YYYY-MM-DD), not the UTC one, so dates entered today are not 'future'.
export const localDate = (d = new Date()) => d.toLocaleDateString('en-CA');
export const fullName = (c: Pick<Client, 'firstName' | 'lastName'>) =>
  `${c.firstName} ${c.lastName}`;
export const shareValue = (a: Pick<WealthAsset, 'declaredValue' | 'ownershipPct'>) =>
  (a.declaredValue * a.ownershipPct) / 100;

export const wealthReviewRequired = (accounts: Account[]) =>
  accounts.reduce((n, a) => n + a.initialDeposit, 0) >= WEALTH_REVIEW_THRESHOLD;

// Checks still outstanding before a pending account can be activated.
export function activationBlockers(client: Client, accounts: Account[], cases: WealthCase[]) {
  const blockers: string[] = [];
  if (client.verification !== 'Verified') blockers.push('Identity verification');
  if (wealthReviewRequired(accounts) && !cases.some((c) => c.status === 'Verified'))
    blockers.push('Wealth verification');
  return blockers;
}

// The latest upload for each asset and document type is the one that counts.
export function latestEvidence(wc: WealthCase, assetId: string, docType: string) {
  return wc.evidence.find((e) => e.assetId === assetId && e.docType === docType);
}

export function missingEvidence(wc: WealthCase) {
  return wc.assets.flatMap((a) =>
    EVIDENCE_REQUIREMENTS[a.type]
      .filter((r) => latestEvidence(wc, a.id, r.docType)?.status !== 'Accepted')
      .map((r) => `${a.description}: ${r.docType}`),
  );
}

// Stands in for the scanner and Textract. The scenario decides what the "document" contains.
export function extractIdentity(client: Client, scenario: IdentityScenario) {
  if (scenario === 'unclear')
    return { reason: 'Extraction confidence 41% is below the 85% threshold' } as const;
  if (scenario === 'service-down')
    return { reason: 'Extraction service unavailable (simulated timeout)' } as const;
  const otherLast = client.lastName === 'Tan' ? 'Lim' : 'Tan';
  const name = scenario === 'match' ? fullName(client) : `${client.firstName} ${otherLast}`;
  const dob =
    scenario === 'match'
      ? client.dob
      : `${Number(client.dob.slice(0, 4)) + 1}${client.dob.slice(4)}`;
  const mismatches = [
    name.toLowerCase() !== fullName(client).toLowerCase() && 'Name does not match the profile',
    dob !== client.dob && 'Date of birth does not match the profile',
  ].filter((x): x is string => !!x);
  // Only a masked NRIC is ever kept; the demo has no real document.
  return {
    extracted: { name: name.toUpperCase(), nric: 'S****567D', dob, confidence: 97 },
    mismatches,
  };
}

export function scanEvidence(
  client: Client,
  asset: WealthAsset,
  req: EvidenceRequirement,
  scenario: EvidenceScenario,
): Pick<WealthEvidence, 'status' | 'reason' | 'extracted'> {
  if (scenario === 'unsupported')
    return { status: 'Rejected', reason: 'Unsupported or unsafe file (simulated scan)' };
  const ok = scenario === 'consistent';
  return {
    status: 'Accepted',
    extracted: {
      owner: req.checks.includes('ownership')
        ? ok
          ? fullName(client)
          : `${client.firstName} ${client.lastName === 'Tan' ? 'Lim' : 'Tan'} Holdings`
        : undefined,
      value: req.checks.includes('valuation')
        ? Math.round(asset.declaredValue * (ok ? 0.98 : 0.62))
        : undefined,
      date: asset.valuationDate,
      originConsistent: req.checks.includes('origin') ? ok : undefined,
    },
  };
}

// Stands in for the ECS wealth worker: compares accepted evidence with each declared claim.
export function analyseWealth(client: Client, wc: WealthCase, now = new Date()) {
  const exceptions: string[] = [];
  const claims: ClaimAssessment[] = wc.assets.map((a) => {
    const docs = EVIDENCE_REQUIREMENTS[a.type]
      .map((r) => ({ r, e: latestEvidence(wc, a.id, r.docType) }))
      .filter((x) => x.e?.status === 'Accepted');
    const notes: string[] = [];
    const flag = (text: string) => {
      notes.push(text);
      exceptions.push(`${a.description}: ${text}`);
    };

    let ownership: ClaimAssessment['ownership'] = 'Corroborated';
    for (const { r, e } of docs)
      if (r.checks.includes('ownership') && e!.extracted?.owner !== fullName(client)) {
        ownership = 'Exception';
        flag(`owner on ${r.docType.toLowerCase()} does not match the client`);
      }

    let valuation: ClaimAssessment['valuation'] = 'Corroborated';
    let documented: number | undefined;
    for (const { r, e } of docs) {
      if (!r.checks.includes('valuation') || e!.extracted?.value === undefined) continue;
      documented = e!.extracted.value;
      const gap = Math.abs(documented - a.declaredValue) / a.declaredValue;
      if (gap > VALUE_TOLERANCE) {
        valuation = 'Exception';
        flag(`documented value differs from the declaration by ${Math.round(gap * 100)}%`);
      }
    }
    if (
      valuation === 'Corroborated' &&
      now.getTime() - Date.parse(a.valuationDate) > VALUATION_MAX_AGE_DAYS * DAY
    ) {
      valuation = 'Stale';
      flag(`valuation dated ${a.valuationDate} is older than ${VALUATION_MAX_AGE_DAYS} days`);
    }

    let origin: ClaimAssessment['origin'] = 'Documented';
    for (const { r, e } of docs)
      if (r.checks.includes('origin') && e!.extracted?.originConsistent === false) {
        origin = 'Needs review';
        flag(`${r.docType.toLowerCase()} are inconsistent with the declared origin`);
      }
    // A balance or current price shows what is held, not where the money came from.
    if (a.type === 'Crypto' && origin === 'Documented') {
      origin = 'Needs review';
      notes.push('Exchange balance alone does not prove origin; reviewer to assess history');
    }

    return {
      assetId: a.id,
      ownership,
      valuation,
      origin,
      corroboratedValue:
        ownership === 'Corroborated' && valuation === 'Corroborated' && documented !== undefined
          ? Math.round((documented * a.ownershipPct) / 100)
          : undefined,
      notes,
    };
  });
  const checks = claims.length * 3;
  return { exceptions, claims, checks };
}
