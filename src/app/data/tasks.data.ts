import { Task } from '../models/models';

const today = new Date();
const inDays = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
};

/**
 * Seed tasks owned by the demo user so the dashboard isn't empty on first run.
 */
export const SEED_TASKS: Task[] = [
  {
    _id: 't-0001',
    ownerId: 'u-demo-0001',
    subject: 'Quarterly portfolio review',
    description:
      'Review allocation across mutual funds, equities and bonds. Rebalance to target weights.',
    priority: 'High',
    startDate: inDays(-2),
    endDate: inDays(3),
    isRemainder: true,
    isDeleted: false,
    taskStatus: 'partiallyCompleted',
    subtasks: ['Pull statements', 'Compare to benchmark', 'Submit rebalance order'],
    createdAt: inDays(-2),
    updatedAt: inDays(-1),
  },
  {
    _id: 't-0002',
    ownerId: 'u-demo-0001',
    subject: 'Pay credit card bill',
    description: 'Settle the full statement balance before due date.',
    priority: 'Medium',
    startDate: inDays(-1),
    endDate: inDays(5),
    isRemainder: true,
    isDeleted: false,
    taskStatus: 'notStarted',
    subtasks: [],
    createdAt: inDays(-1),
    updatedAt: inDays(-1),
  },
  {
    _id: 't-0003',
    ownerId: 'u-demo-0001',
    subject: 'Read "The Intelligent Investor" — Ch. 8',
    description: 'Finish the chapter on Mr. Market and capture key takeaways.',
    priority: 'Low',
    startDate: inDays(-5),
    endDate: inDays(-1),
    isRemainder: false,
    isDeleted: false,
    taskStatus: 'completed',
    subtasks: [],
    createdAt: inDays(-5),
    updatedAt: inDays(-1),
  },
];
