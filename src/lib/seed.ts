import type { Database } from './types';
import { maskValue } from './audit';

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
    verification: i === 2 || i === 5 || i === 9 ? 'Pending' : 'Verified',
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

  return {
    version: 1,
    users,
    clients,
    accounts,
    transactions,
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
