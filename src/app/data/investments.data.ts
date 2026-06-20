import { Investment } from '../models/models';

const months = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString();
};

/**
 * Seed investments for the demo user.
 */
export const SEED_INVESTMENTS: Investment[] = [
  {
    _id: 'i-0001',
    ownerId: 'u-demo-0001',
    name: 'Nifty 50 Index Fund',
    type: 'Mutual Fund',
    amount: 150000,
    currentValue: 178500,
    startDate: months(-12),
    maturityDate: months(36),
    risk: 'Medium',
    status: 'Active',
    notes: 'Monthly SIP of 12,500.',
    createdAt: months(-12),
    updatedAt: months(-1),
    isDeleted: false,
  },
  {
    _id: 'i-0002',
    ownerId: 'u-demo-0001',
    name: 'Tata Motors',
    type: 'Stock',
    amount: 75000,
    currentValue: 92000,
    startDate: months(-8),
    maturityDate: null,
    risk: 'High',
    status: 'Active',
    notes: 'Long-term hold.',
    createdAt: months(-8),
    updatedAt: months(-2),
    isDeleted: false,
  },
  {
    _id: 'i-0003',
    ownerId: 'u-demo-0001',
    name: 'HDFC Bank FD',
    type: 'Fixed Deposit',
    amount: 200000,
    currentValue: 214000,
    startDate: months(-18),
    maturityDate: months(6),
    risk: 'Low',
    status: 'Active',
    notes: '7% p.a., compounded quarterly.',
    createdAt: months(-18),
    updatedAt: months(-18),
    isDeleted: false,
  },
  {
    _id: 'i-0004',
    ownerId: 'u-demo-0001',
    name: 'Sovereign Gold Bond',
    type: 'Bond',
    amount: 50000,
    currentValue: 56500,
    startDate: months(-24),
    maturityDate: months(60),
    risk: 'Low',
    status: 'Active',
    notes: '2.5% interest + price appreciation.',
    createdAt: months(-24),
    updatedAt: months(-24),
    isDeleted: false,
  },
];
