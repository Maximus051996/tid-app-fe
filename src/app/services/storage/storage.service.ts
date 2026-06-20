import { Injectable } from '@angular/core';
import { SEED_USERS } from '../../data/users.data';
import { SEED_TASKS } from '../../data/tasks.data';
import { SEED_INVESTMENTS } from '../../data/investments.data';
import { SEED_NOTES } from '../../data/notes.data';
import { SEED_GOALS } from '../../data/goals.data';
import { Goal, Investment, Note, Task, User } from '../../models/models';
import { EncryptedStorageService } from '../security/encrypted-storage';
import { hashPassword, isHashed } from '../security/password';

const KEYS = {
  users: 'tid.users',
  tasks: 'tid.tasks',
  investments: 'tid.investments',
  notes: 'tid.notes',
  goals: 'tid.goals',
  seeded: 'tid.seeded.v3',
} as const;

/**
 * Single source of truth for the in-browser data store.
 *
 * Data on disk is AES-256-GCM encrypted via EncryptedStorageService.
 * To preserve the existing synchronous API the rest of the app uses,
 * we keep an in-memory cache that is warmed at boot (`init()`) and
 * persisted asynchronously on every save.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private users: User[] = [];
  private tasks: Task[] = [];
  private investments: Investment[] = [];
  private notes: Note[] = [];
  private goals: Goal[] = [];

  /** Resolves once on first init — APP_INITIALIZER awaits this. */
  private bootPromise: Promise<void> | null = null;

  constructor(private enc: EncryptedStorageService) {}

  /** Awaited from APP_INITIALIZER. Hashes seed passwords and decrypts cached state. */
  init(): Promise<void> {
    if (!this.bootPromise) {
      this.bootPromise = this.bootstrap();
    }
    return this.bootPromise;
  }

  private async bootstrap(): Promise<void> {
    const seeded = localStorage.getItem(KEYS.seeded) === 'true';

    if (!seeded) {
      // Fresh install (or post-reset). Hash seed passwords before they ever land on disk.
      const hashedSeedUsers = await Promise.all(
        SEED_USERS.map(async (u) => ({
          ...u,
          userPassword: isHashed(u.userPassword)
            ? u.userPassword
            : await hashPassword(u.userPassword),
        }))
      );
      this.users = hashedSeedUsers;
      this.tasks = [...SEED_TASKS];
      this.investments = [...SEED_INVESTMENTS];
      this.notes = [...SEED_NOTES];
      this.goals = [...SEED_GOALS];

      await Promise.all([
        this.enc.setEncrypted(KEYS.users, this.users),
        this.enc.setEncrypted(KEYS.tasks, this.tasks),
        this.enc.setEncrypted(KEYS.investments, this.investments),
        this.enc.setEncrypted(KEYS.notes, this.notes),
        this.enc.setEncrypted(KEYS.goals, this.goals),
      ]);
      localStorage.setItem(KEYS.seeded, 'true');
      return;
    }

    // Already seeded — load encrypted state into memory.
    const [u, t, i, n, g] = await Promise.all([
      this.enc.getEncrypted<User[]>(KEYS.users),
      this.enc.getEncrypted<Task[]>(KEYS.tasks),
      this.enc.getEncrypted<Investment[]>(KEYS.investments),
      this.enc.getEncrypted<Note[]>(KEYS.notes),
      this.enc.getEncrypted<Goal[]>(KEYS.goals),
    ]);
    this.users = u ?? [];
    this.tasks = t ?? [];
    this.investments = i ?? [];

    // Notes and goals were added later — backfill seed data on existing installs
    // so the new modules are never empty after upgrade.
    if (n === null) {
      this.notes = [...SEED_NOTES];
      await this.enc.setEncrypted(KEYS.notes, this.notes);
    } else {
      this.notes = n;
    }
    if (g === null) {
      this.goals = [...SEED_GOALS];
      await this.enc.setEncrypted(KEYS.goals, this.goals);
    } else {
      this.goals = g;
    }

    // Self-heal: any user record still holding plaintext (legacy install) gets hashed.
    const needsHash = this.users.some((x) => !isHashed(x.userPassword));
    if (needsHash) {
      this.users = await Promise.all(
        this.users.map(async (x) => ({
          ...x,
          userPassword: isHashed(x.userPassword)
            ? x.userPassword
            : await hashPassword(x.userPassword),
        }))
      );
      await this.enc.setEncrypted(KEYS.users, this.users);
    }
  }

  // ------- Users -------
  getUsers(): User[] {
    return this.users;
  }
  saveUsers(users: User[]): void {
    this.users = users;
    void this.enc.setEncrypted(KEYS.users, users);
  }

  // ------- Tasks -------
  getTasks(): Task[] {
    return this.tasks;
  }
  saveTasks(tasks: Task[]): void {
    this.tasks = tasks;
    void this.enc.setEncrypted(KEYS.tasks, tasks);
  }

  // ------- Investments -------
  getInvestments(): Investment[] {
    return this.investments;
  }
  saveInvestments(items: Investment[]): void {
    this.investments = items;
    void this.enc.setEncrypted(KEYS.investments, items);
  }

  // ------- Notes -------
  getNotes(): Note[] {
    return this.notes;
  }
  saveNotes(notes: Note[]): void {
    this.notes = notes;
    void this.enc.setEncrypted(KEYS.notes, notes);
  }

  // ------- Goals -------
  getGoals(): Goal[] {
    return this.goals;
  }
  saveGoals(goals: Goal[]): void {
    this.goals = goals;
    void this.enc.setEncrypted(KEYS.goals, goals);
  }

  /** Reset the entire local store back to the seed state. */
  async resetAll(): Promise<void> {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    this.bootPromise = null;
    await this.init();
  }

  /**
   * Wipe just the data owned by `userId` — tasks, investments, notes, goals.
   * The user record itself stays intact so they can still log in. Used by the
   * admin "wipe my data" flow which leaves accounts and other users alone.
   */
  wipeUserData(userId: string): void {
    this.tasks = this.tasks.filter((t) => t.ownerId !== userId);
    this.investments = this.investments.filter((i) => i.ownerId !== userId);
    this.notes = this.notes.filter((n) => n.ownerId !== userId);
    this.goals = this.goals.filter((g) => g.ownerId !== userId);
    void Promise.all([
      this.enc.setEncrypted(KEYS.tasks, this.tasks),
      this.enc.setEncrypted(KEYS.investments, this.investments),
      this.enc.setEncrypted(KEYS.notes, this.notes),
      this.enc.setEncrypted(KEYS.goals, this.goals),
    ]);
  }
}
