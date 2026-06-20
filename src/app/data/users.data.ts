import { User } from '../models/models';

/**
 * Seed users — loaded into localStorage on first app launch.
 * The admin account ships with the build; everything else is created at runtime.
 */
export const SEED_USERS: User[] = [
  {
    id: 'u-admin-0001',
    userName: 'admin',
    userEmail: 'admin@tid.com',
    phone: '9999999999',
    userPassword: 'Admin@123',
    role: 'admin',
    createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'u-demo-0001',
    userName: 'demo',
    userEmail: 'demo@tid.com',
    phone: '8888888888',
    userPassword: 'Demo@123',
    role: 'user',
    createdAt: new Date('2024-01-15T00:00:00Z').toISOString(),
  },
];
