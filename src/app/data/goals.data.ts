import { Goal } from '../models/models';

const today = new Date();
const dayShift = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

/**
 * Seed goals for the demo user — covers a few categories and shows off
 * the progress + milestones UI.
 */
export const SEED_GOALS: Goal[] = [
  {
    _id: 'g-0001',
    ownerId: 'u-demo-0001',
    title: 'Build a 6-month emergency fund',
    description:
      'Park six months of essential expenses in a high-yield savings account and stop touching it.',
    category: 'Finance',
    targetValue: 300000,
    currentValue: 185000,
    unit: '₹',
    startDate: dayShift(-90),
    dueDate: dayShift(180),
    status: 'active',
    milestones: [
      { id: 'm1', label: 'Hit ₹100,000', done: true },
      { id: 'm2', label: 'Hit ₹200,000', done: false },
      { id: 'm3', label: 'Hit ₹300,000', done: false },
    ],
    createdAt: dayShift(-90),
    updatedAt: dayShift(-2),
    isDeleted: false,
  },
  {
    _id: 'g-0002',
    ownerId: 'u-demo-0001',
    title: 'Read 24 books this year',
    description:
      'Two non-fiction books per month — pick one finance/business and one general.',
    category: 'Learning',
    targetValue: 24,
    currentValue: 11,
    unit: 'books',
    startDate: dayShift(-160),
    dueDate: dayShift(205),
    status: 'active',
    milestones: [
      { id: 'm1', label: 'Q1 — 6 books', done: true },
      { id: 'm2', label: 'Q2 — 12 books', done: false },
      { id: 'm3', label: 'Q3 — 18 books', done: false },
      { id: 'm4', label: 'Q4 — 24 books', done: false },
    ],
    createdAt: dayShift(-160),
    updatedAt: dayShift(-5),
    isDeleted: false,
  },
  {
    _id: 'g-0003',
    ownerId: 'u-demo-0001',
    title: 'Run 3× per week consistently',
    description: 'Build the habit of three short runs per week — distance grows over time.',
    category: 'Health',
    targetValue: 52,
    currentValue: 18,
    unit: 'weeks',
    startDate: dayShift(-130),
    dueDate: dayShift(235),
    status: 'active',
    milestones: [
      { id: 'm1', label: 'First 4-week streak', done: true },
      { id: 'm2', label: 'First 5K run', done: true },
      { id: 'm3', label: 'First 10K run', done: false },
    ],
    createdAt: dayShift(-130),
    updatedAt: dayShift(-1),
    isDeleted: false,
  },
];
