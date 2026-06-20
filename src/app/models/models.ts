export type Role = 'admin' | 'user';

export interface User {
  id: string;
  userName: string;
  userEmail: string;
  phone: string;
  /** Stored only in this frontend-only demo. Never do this in real apps. */
  userPassword: string;
  role: Role;
  createdAt: string;
}

export type Priority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'notStarted' | 'partiallyCompleted' | 'completed';

export interface Task {
  _id: string;
  ownerId: string;
  subject: string;
  description: string;
  priority: Priority;
  startDate: string;
  endDate: string;
  isRemainder: boolean;
  isDeleted: boolean;
  taskStatus: TaskStatus;
  subtasks: string[];
  createdAt: string;
  updatedAt: string;
}

export type InvestmentType =
  | 'Stock'
  | 'Mutual Fund'
  | 'Fixed Deposit'
  | 'Bond'
  | 'Real Estate'
  | 'Crypto'
  | 'Other';

export type Risk = 'Low' | 'Medium' | 'High';
export type InvestmentStatus = 'Active' | 'Matured' | 'Sold';

export interface Investment {
  _id: string;
  ownerId: string;
  name: string;
  type: InvestmentType;
  amount: number;
  currentValue: number;
  startDate: string;
  maturityDate: string | null;
  risk: Risk;
  status: InvestmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface AuthSession {
  userId: string;
  userName: string;
  role: Role;
  issuedAt: number;
  expiresAt: number;
}

/* ============================== Notes ============================== */

export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'violet' | 'orange' | 'slate';

export interface Note {
  _id: string;
  ownerId: string;
  title: string;
  body: string;
  color: NoteColor;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

/* ============================== Goals ============================== */

export type GoalCategory =
  | 'Health'
  | 'Learning'
  | 'Finance'
  | 'Career'
  | 'Personal'
  | 'Habit';

export type GoalStatus = 'active' | 'completed' | 'paused';

export interface GoalMilestone {
  id: string;
  label: string;
  done: boolean;
}

export interface Goal {
  _id: string;
  ownerId: string;
  title: string;
  description: string;
  category: GoalCategory;
  /** Numeric target (e.g. read 30 books, save ₹100000). */
  targetValue: number;
  /** Current progress against target. */
  currentValue: number;
  /** Free-text unit shown next to numbers. Empty string is fine. */
  unit: string;
  startDate: string;
  dueDate: string;
  status: GoalStatus;
  milestones: GoalMilestone[];
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}
