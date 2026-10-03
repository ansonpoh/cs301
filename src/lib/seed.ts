import type { Database } from './types';
import { maskValue } from './audit';
import { analyseRisk, analysisDate } from './retention';
import { EVIDENCE_REQUIREMENTS, analyseWealth, scanEvidence } from './verification';

// Admin-maintained product catalogue; the recommendation engine may only suggest these.
const PRODUCTS: Database['products'] = [
  {
    id: 'PRD-FD12',
    name: 'Fixed Deposit',
    category: 'Deposits',
    summary: 'Guaranteed returns on idle funds for a fixed term.',
    eligibility: { minAge: 18, maxAge: 100, minRelationship: 10_000 },
    terms: {
      amount: { min: 1_000, max: 500_000 },
      tenureMonths: { min: 3, max: 36 },
      rate: { min: 2, max: 4 },
    },
    preApproval: { maxAmountShare: 1, rateAtMost: 3.2 },
  },
  {
    id: 'PRD-HYS',
    name: 'High-Yield Savings Account',
    category: 'Accounts',
    summary: 'Bonus interest when salary is credited monthly.',
    eligibility: { minAge: 18, maxAge: 100, excludesAccountType: 'Savings' },
    opensAccount: 'Savings',
  },
  {
    id: 'PRD-BIZ',
    name: 'Business Current Account',
    category: 'Accounts',
    summary: 'Multi-currency account for sole proprietors and SMEs.',
    eligibility: {
      minAge: 21,
      maxAge: 100,
      minMonthlyInflow: 3_000,
      excludesAccountType: 'Business',
    },
    opensAccount: 'Business',
  },
  {
    id: 'PRD-CC',
    name: 'Rewards Credit Card',
    category: 'Cards',
    summary: 'Cashback on dining and travel with no annual fee in year one.',
    eligibility: { minAge: 21, maxAge: 75, minMonthlyInflow: 2_500, requiresVerified: true },
    terms: { amount: { min: 1_000, max: 50_000 } },
    preApproval: { maxAmountShare: 0.2 },
  },
  {
    id: 'PRD-PL',
    name: 'Personal Instalment Loan',
    category: 'Loans',
    summary: 'Fixed monthly repayments for planned expenses.',
    eligibility: { minAge: 21, maxAge: 65, minMonthlyInflow: 2_000, requiresVerified: true },
    terms: {
      amount: { min: 5_000, max: 200_000 },
      tenureMonths: { min: 12, max: 84 },
      rate: { min: 3.5, max: 9 },
    },
    preApproval: { maxAmountShare: 0.3, maxTenureMonths: 60, rateAtLeast: 4.5 },
  },
  {
    id: 'PRD-INV',
    name: 'Managed Portfolio',
    category: 'Investments',
    summary: 'Diversified portfolio managed to the client’s risk profile.',
    eligibility: { minAge: 21, maxAge: 80, minRelationship: 50_000, requiresVerified: true },
    terms: { amount: { min: 10_000, max: 1_000_000 } },
    preApproval: { maxAmountShare: 0.5 },
  },
  {
    id: 'PRD-LIFE',
    name: 'Term Life Cover',
    category: 'Insurance',
    summary: 'Affordable protection for dependants over a fixed term.',
    eligibility: { minAge: 18, maxAge: 60 },
    terms: { amount: { min: 50_000, max: 2_000_000 }, tenureMonths: { min: 60, max: 360 } },
    preApproval: { maxTenureMonths: 300 },
  },
];

export function createSeed(): Database {
  const names = [
    ['Amelia', 'Tan'],
    ['Ethan', 'Lim'],
    ['Sophia', 'Chen'],
    ['Lucas', 'Wong'],
    ['Olivia', 'Ng'],
    ['Noah', 'Lee'],
    ['Isabella', 'Goh'],
    ['James', 'Teo'],
    ['Mia', 'Koh'],
    ['Benjamin', 'Chua'],
    ['Charlotte', 'Ong'],
    ['Daniel', 'Yeo'],
  ];

  const users: Database['users'] = [
    {
      id: 'USR-001',
      firstName: 'Alex',
      lastName: 'Morgan',
      email: 'alex.morgan@example.com',
      role: 'Admin',
      active: true,
      root: true,
    },
    {
      id: 'USR-002',
      firstName: 'Priya',
      lastName: 'Shah',
      email: 'priya.shah@example.com',
      role: 'Admin',
      active: true,
    },
    {
      id: 'USR-003',
      firstName: 'Rachel',
      lastName: 'Tan',
      email: 'rachel.tan@example.com',
      role: 'Agent',
      active: true,
    },
    {
      id: 'USR-004',
      firstName: 'Marcus',
      lastName: 'Lee',
      email: 'marcus.lee@example.com',
      role: 'Agent',
      active: true,
    },
  ];

  const clients: Database['clients'] = names.map(([firstName, lastName], i) => ({
    id: `CL-${String(1001 + i)}`,
    agentId: i < 8 ? 'USR-003' : 'USR-004',
    firstName,
    lastName,
    dob: `${1980 + i}-0${(i % 8) + 1}-15`,
    gender: i % 2 ? 'Male' : 'Female',
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
    phone: `+658100${String(i + 1).padStart(4, '0')}`,
    address: `${21 + i * 3} ${['River Valley Road', 'Tanjong Pagar Road', 'Orchard Boulevard'][i % 3]}`,
    city: 'Singapore',
    state: 'Singapore',
    country: 'Singapore',
    postal: `${238001 + i}`,
    verification: i === 5 ? 'Manual Review' : i === 2 || i === 9 ? 'Pending' : 'Verified',
    createdAt: `2026-09-${String(10 + i).padStart(2, '0')}T08:00:00Z`,
  }));
  const accounts: Database['accounts'] = clients
    .filter((c) => c.verification === 'Verified')
    .map((c, i) => ({
      id: `AC-${80001 + i}`,
      clientId: c.id,
      type: i % 3 === 0 ? 'Business' : 'Savings',
      status: 'Active',
      openingDate: '2026-09-12',
      initialDeposit: 12500 + i * 7350,
      currency: 'SGD',
      branchId: 'SG-001',
    }));
  const transactions: Database['transactions'] = accounts.flatMap((a, i) =>
    Array.from({ length: 5 }, (_, j) => ({
      id: `TX-${40001 + i * 5 + j}`,
      clientId: a.clientId,
      accountId: a.id,
      type: j % 3 === 0 ? 'Withdrawal' : 'Deposit',
      amount: [1250, 4200, 8500, 650, 3200][j] + i * 75,
      date: `2026-09-${String(29 - j * 3).padStart(2, '0')}T${String(9 + i).padStart(2, '0')}:30:00Z`,
      status: j === 4 && i % 3 === 0 ? 'Pending' : j === 3 && i === 1 ? 'Failed' : 'Completed',
    })),
  );
  // Large outflows that the attrition job (feature 5) flags as balance drops.
  transactions.push(
    ...(
      [
        ['CL-1001', 'AC-80001', 6_000, '2026-09-28T10:15:00Z'],
        ['CL-1004', 'AC-80003', 12_000, '2026-09-27T11:40:00Z'],
        ['CL-1008', 'AC-80006', 20_000, '2026-09-27T14:05:00Z'],
        ['CL-1008', 'AC-80006', 15_000, '2026-09-28T15:20:00Z'],
        ['CL-1009', 'AC-80007', 36_000, '2026-09-27T16:10:00Z'],
      ] as const
    ).map(([clientId, accountId, amount, date], i) => ({
      id: `TX-${40101 + i}`,
      clientId,
      accountId,
      type: 'Withdrawal' as const,
      amount,
      date,
      status: 'Completed' as const,
    })),
  );

  const audit: Database['audit'] = clients.map((c, i) =>
    i % 3 === 0
      ? {
          id: `EV-${i}`,
          actorId: c.agentId,
          crud: 'Update',
          action: 'Client updated',
          entityId: c.id,
          clientId: c.id,
          at: c.createdAt,
          changes: [
            {
              field: 'lastName',
              before: maskValue('lastName', 'Lee'),
              after: maskValue('lastName', c.lastName),
            },
            {
              field: 'address',
              before: maskValue('address', '8 Marina View'),
              after: maskValue('address', c.address),
            },
          ],
          detail: 'Fictional seed activity',
        }
      : {
          id: `EV-${i}`,
          actorId: c.agentId,
          crud: 'Create',
          action: 'Client created',
          entityId: c.id,
          clientId: c.id,
          at: c.createdAt,
          detail: 'Fictional seed activity',
        },
  );

  // Case dates are relative to now so the SLA demo works whenever the seed is created.
  const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  // Oldest transaction of the given type, so it predates the case that disputes it.
  const txFor = (clientId: string, type: 'Deposit' | 'Withdrawal') =>
    transactions.filter((t) => t.clientId === clientId && t.type === type).at(-1)!.id;
  const cases: Database['cases'] = [
    {
      id: 'CASE-1001',
      clientId: 'CL-1001',
      agentId: 'USR-003',
      category: 'Transaction dispute',
      description: 'Client reports this withdrawal was debited twice from the account.',
      transactionId: txFor('CL-1001', 'Withdrawal'),
      status: 'Investigating',
      escalated: false,
      createdAt: ago(8),
      slaStartedAt: ago(8),
      history: [
        { type: 'CASE_CREATED', at: ago(8), actorId: 'USR-003' },
        {
          type: 'STATUS_UPDATED',
          at: ago(7),
          actorId: 'USR-003',
          from: 'Open',
          to: 'Investigating',
          note: 'Requested ledger extract from operations.',
        },
      ],
    },
    {
      id: 'CASE-1002',
      clientId: 'CL-1002',
      agentId: 'USR-003',
      category: 'Service complaint',
      description: 'Client waited over 40 minutes at the branch counter without being served.',
      status: 'Open',
      escalated: false,
      createdAt: ago(1),
      slaStartedAt: ago(1),
      history: [{ type: 'CASE_CREATED', at: ago(1), actorId: 'USR-003' }],
    },
    {
      id: 'CASE-1003',
      clientId: 'CL-1004',
      agentId: 'USR-003',
      category: 'Account issue',
      description: 'Online banking access locked after password change.',
      status: 'Resolved',
      escalated: false,
      createdAt: ago(10),
      slaStartedAt: ago(10),
      resolvedAt: ago(9),
      history: [
        { type: 'CASE_CREATED', at: ago(10), actorId: 'USR-003' },
        {
          type: 'STATUS_UPDATED',
          at: ago(9.8),
          actorId: 'USR-003',
          from: 'Open',
          to: 'Investigating',
          note: 'Raised ticket with digital banking support.',
        },
        {
          type: 'STATUS_UPDATED',
          at: ago(9),
          actorId: 'USR-003',
          from: 'Investigating',
          to: 'Resolved',
          note: 'Access restored; client confirmed sign-in works.',
        },
      ],
    },
    {
      id: 'CASE-1004',
      clientId: 'CL-1009',
      agentId: 'USR-004',
      category: 'Transaction dispute',
      description: 'Client does not recognise this deposit and asked for its source.',
      transactionId: txFor('CL-1009', 'Deposit'),
      status: 'Open',
      escalated: false,
      createdAt: ago(9),
      slaStartedAt: ago(9),
      history: [{ type: 'CASE_CREATED', at: ago(9), actorId: 'USR-004' }],
    },
    {
      id: 'CASE-1005',
      clientId: 'CL-1011',
      agentId: 'USR-004',
      category: 'Other',
      description: 'Client asked for monthly statements to be sent by post instead of email.',
      status: 'Investigating',
      escalated: false,
      createdAt: ago(1.5),
      slaStartedAt: ago(1.5),
      history: [
        { type: 'CASE_CREATED', at: ago(1.5), actorId: 'USR-004' },
        {
          type: 'STATUS_UPDATED',
          at: ago(1),
          actorId: 'USR-004',
          from: 'Open',
          to: 'Investigating',
          note: 'Checking statement delivery options with operations.',
        },
      ],
    },
  ];

  // Open risk flags come from the same analysis the scheduled job runs; closed ones are history.
  const asOf = analysisDate(transactions);
  const riskProfiles: Database['riskProfiles'] = ['CL-1001', 'CL-1004', 'CL-1008', 'CL-1009'].map(
    (clientId, i) => {
      const r = analyseRisk(
        accounts.filter((a) => a.clientId === clientId),
        transactions.filter((t) => t.clientId === clientId),
        cases.filter((c) => c.clientId === clientId),
        asOf,
      );
      const flaggedAt = ago(2 + i);
      return {
        clientId,
        level: r!.level,
        score: r!.score,
        reasons: r!.reasons,
        status: 'At Risk',
        flaggedAt,
        history: [{ type: 'RISK_FLAGGED', at: flaggedAt, to: r!.level }],
      };
    },
  );
  const interventions: Database['interventions'] = [
    {
      id: 'INT-1001',
      clientId: 'CL-1004',
      agentId: 'USR-003',
      type: 'Financial Review Conducted',
      notes:
        'Reviewed the large withdrawal with the client: funds went to a property down payment. Agreed to review the savings plan next month.',
      at: ago(1),
    },
    {
      id: 'INT-1002',
      clientId: 'CL-1005',
      agentId: 'USR-003',
      type: 'Fee Waiver Offered',
      notes: 'Client was unhappy with monthly account fees. Waived fees for six months.',
      at: ago(10),
    },
    {
      id: 'INT-1003',
      clientId: 'CL-1011',
      agentId: 'USR-004',
      type: 'Relationship Check-in',
      notes: 'Called to understand the reduced activity. Client is travelling and will resume.',
      at: ago(11),
    },
    {
      id: 'INT-1004',
      clientId: 'CL-1012',
      agentId: 'USR-004',
      type: 'Retention Offer Made',
      notes: 'Offered a preferential fixed deposit rate. Client is comparing offers elsewhere.',
      at: ago(13),
    },
  ];
  const lucas = riskProfiles[1];
  lucas.status = 'Under Review';
  lucas.history.push(
    { type: 'INTERVENTION_LOGGED', at: ago(1), actorId: 'USR-003', interventionId: 'INT-1001' },
    { type: 'STATUS_UPDATED', at: ago(1), actorId: 'USR-003', from: 'At Risk', to: 'Under Review' },
  );
  const closed = (
    clientId: string,
    agentId: string,
    level: 'High' | 'Medium',
    reason: string,
    days: [flagged: number, intervened: number, closed: number],
    to: 'Mitigated' | 'Churned',
    note: string,
  ): Database['riskProfiles'][number] => ({
    clientId,
    level,
    score: level === 'High' ? 50 : 25,
    reasons: [reason],
    status: to,
    flaggedAt: ago(days[0]),
    closedAt: ago(days[2]),
    history: [
      { type: 'RISK_FLAGGED', at: ago(days[0]), to: level },
      {
        type: 'INTERVENTION_LOGGED',
        at: ago(days[1]),
        actorId: agentId,
        interventionId: interventions.find((x) => x.clientId === clientId)!.id,
      },
      {
        type: 'STATUS_UPDATED',
        at: ago(days[1]),
        actorId: agentId,
        from: 'At Risk',
        to: 'Under Review',
      },
      {
        type: 'STATUS_UPDATED',
        at: ago(days[2]),
        actorId: agentId,
        from: 'Under Review',
        to,
        note,
      },
    ],
  });
  riskProfiles.push(
    closed(
      'CL-1005',
      'USR-003',
      'Medium',
      '34% balance drop in 30 days',
      [12, 10, 5],
      'Mitigated',
      'Client confirmed salary will keep crediting to this account.',
    ),
    closed(
      'CL-1011',
      'USR-004',
      'Medium',
      'Transaction frequency down 60% and deposits slowing',
      [14, 11, 6],
      'Mitigated',
      'Activity resumed after the client returned from travel.',
    ),
    closed(
      'CL-1012',
      'USR-004',
      'High',
      '58% balance drop in 30 days',
      [15, 13, 7],
      'Churned',
      'Client moved main savings to another bank.',
    ),
  );

  // Feature 2: a high-value account waiting on identity and wealth checks (CL-1003), an identity
  // check routed to manual review (CL-1006), one awaiting the client's upload (CL-1010), and a
  // wealth case ready for an admin decision (CL-1002).
  accounts.push({
    id: 'AC-80010',
    clientId: 'CL-1003',
    type: 'Business',
    status: 'Pending',
    openingDate: '2026-09-25',
    initialDeposit: 250_000,
    currency: 'SGD',
    branchId: 'SG-001',
  });
  const identityChecks: Database['identityChecks'] = [
    {
      id: 'IDV-1001',
      clientId: 'CL-1006',
      requestedBy: 'USR-003',
      requestedAt: ago(2),
      status: 'Manual Review',
      uploadedAt: ago(1.8),
      evidenceId: 'EVD-1001',
      reason: 'Extraction confidence 41% is below the 85% threshold',
    },
    {
      id: 'IDV-1002',
      clientId: 'CL-1010',
      requestedBy: 'USR-004',
      requestedAt: ago(1),
      status: 'Awaiting Upload',
    },
  ];
  const day = (n: number) => ago(n).slice(0, 10);
  const wc: Database['wealthCases'][number] = {
    id: 'WC-1001',
    clientId: 'CL-1002',
    agentId: 'USR-003',
    version: 1,
    status: 'Under Review',
    createdAt: ago(6),
    updatedAt: ago(1),
    assets: [
      {
        id: 'AST-1001',
        type: 'Stocks / funds',
        description: 'Brokerage portfolio (global equities)',
        ownershipPct: 100,
        declaredValue: 180_000,
        valuationDate: day(20),
        origin: 'Employment income',
      },
      {
        id: 'AST-1002',
        type: 'Property',
        description: 'Condominium unit, River Valley',
        ownershipPct: 50,
        declaredValue: 1_450_000,
        valuationDate: day(420),
        origin: 'Property sale',
      },
    ],
    liabilities: 520_000,
    sourceNarrative:
      'Salary savings from 12 years in banking operations, invested monthly; condominium bought jointly with spouse using proceeds from the sale of an HDB flat.',
    evidence: [],
    history: [],
  };
  wc.evidence = wc.assets.flatMap((a, i) =>
    EVIDENCE_REQUIREMENTS[a.type].map((r, j) => ({
      id: `EVD-20${i}${j}`,
      assetId: a.id,
      docType: r.docType,
      uploadedAt: ago(4 - j * 0.1),
      uploadedBy: 'USR-003',
      ...scanEvidence(clients[1], a, r, 'consistent'),
    })),
  );
  const analysed = analyseWealth(clients[1], wc);
  wc.analysis = {
    at: ago(1),
    jobId: 'JOB-1001',
    exceptions: analysed.exceptions,
    claims: analysed.claims,
  };
  wc.history = [
    { type: 'WEALTH_CASE_CREATED', at: ago(6), actorId: 'USR-003', to: 'Pending Evidence' },
    {
      type: 'WEALTH_EVIDENCE_UPLOADED',
      at: ago(4),
      actorId: 'USR-003',
      note: `${wc.evidence.length} documents · Accepted`,
    },
    {
      type: 'WEALTH_CASE_SUBMITTED',
      at: ago(1),
      actorId: 'USR-003',
      from: 'Pending Evidence',
      to: 'Under Review',
    },
    {
      type: 'WEALTH_ANALYSIS_COMPLETED',
      at: ago(1),
      note: `${analysed.exceptions.length} exception(s)`,
    },
  ];

  return {
    identityChecks,
    wealthCases: [wc],
    version: 1,
    riskProfiles,
    interventions,
    riskJob: {},
    users,
    clients,
    accounts,
    transactions,
    cases,
    caseSettings: { slaBusinessDays: 3 },
    products: PRODUCTS,
    recoSets: [],
    recoOptOuts: [],
    audit: audit.sort((a, b) => b.at.localeCompare(a.at)),
    imports: [
      {
        id: 'IMP-1001',
        actorId: 'USR-003',
        source: 'core-banking-feed-20260929090000.csv',
        startedAt: '2026-09-29T09:00:00Z',
        endedAt: '2026-09-29T09:00:02Z',
        status: 'Successful',
        processed: 30,
        accepted: 30,
        rejected: 0,
        errors: [],
      },
    ],
  };
}
