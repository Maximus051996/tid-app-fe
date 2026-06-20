import { Injectable } from '@angular/core';
import { Goal, Investment, Note, Task, User } from '../../models/models';

/**
 * @deprecated The app now reads/writes through the backend API. This stub
 * exists only so legacy callers compile; new code should use the
 * domain-specific services (TaskService, GoalService, etc.) directly.
 *
 * Returns empty arrays from `getX()` and ignores `saveX()`. Initialization
 * is a no-op since there's no local seed to apply anymore.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  init(): Promise<void> {
    return Promise.resolve();
  }

  getUsers(): User[] { return []; }
  saveUsers(_users: User[]): void { /* no-op */ }

  getTasks(): Task[] { return []; }
  saveTasks(_tasks: Task[]): void { /* no-op */ }

  getInvestments(): Investment[] { return []; }
  saveInvestments(_items: Investment[]): void { /* no-op */ }

  getNotes(): Note[] { return []; }
  saveNotes(_notes: Note[]): void { /* no-op */ }

  getGoals(): Goal[] { return []; }
  saveGoals(_goals: Goal[]): void { /* no-op */ }

  resetAll(): Promise<void> {
    // No local data to reset anymore.
    return Promise.resolve();
  }

  wipeUserData(_userId: string): void { /* no-op */ }
}
