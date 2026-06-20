import { Note } from '../models/models';

const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

/**
 * Seed notes for the demo user — short scratch-pad entries that show off
 * the variety of color tones and the pinned state.
 */
export const SEED_NOTES: Note[] = [
  {
    _id: 'n-0001',
    ownerId: 'u-demo-0001',
    title: 'Investment ideas to research',
    body:
      'Look into balanced advantage funds for the conservative bucket. Compare HDFC vs ICICI variants on rolling 5y returns.',
    color: 'yellow',
    tags: ['research', 'finance'],
    pinned: true,
    createdAt: daysAgo(8),
    updatedAt: daysAgo(2),
    isDeleted: false,
  },
  {
    _id: 'n-0002',
    ownerId: 'u-demo-0001',
    title: 'Weekly review checklist',
    body:
      '• Inbox to zero\n• Review investment dashboard\n• Plan next week’s 3 priorities\n• Reflect on what worked',
    color: 'blue',
    tags: ['routine'],
    pinned: true,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(1),
    isDeleted: false,
  },
  {
    _id: 'n-0003',
    ownerId: 'u-demo-0001',
    title: 'Books to read',
    body:
      '1. Psychology of Money — Morgan Housel\n2. Deep Work — Cal Newport\n3. Same as Ever — Morgan Housel',
    color: 'pink',
    tags: ['reading'],
    pinned: false,
    createdAt: daysAgo(15),
    updatedAt: daysAgo(15),
    isDeleted: false,
  },
  {
    _id: 'n-0004',
    ownerId: 'u-demo-0001',
    title: 'Quote',
    body:
      '"Risk comes from not knowing what you’re doing." — Warren Buffett',
    color: 'green',
    tags: ['quote'],
    pinned: false,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30),
    isDeleted: false,
  },
];
