import { Injectable } from '@angular/core';
import { defer, Observable } from 'rxjs';
import { StorageService } from '../storage/storage.service';
import { AuthService } from '../auth/auth.service';
import { Goal, GoalCategory, GoalMilestone, GoalStatus } from '../../models/models';

/**
 * Goal CRUD backed by encrypted localStorage.
 */
@Injectable({ providedIn: 'root' })
export class GoalService {
  constructor(
    private storage: StorageService,
    private auth: AuthService
  ) {}

  getAll(): Observable<Goal[]> {
    return defer(() => Promise.resolve(this.scoped()));
  }

  getById(id: string): Observable<Goal> {
    return defer(() => {
      const item = this.scoped().find((g) => g._id === id);
      if (!item) return Promise.reject(new Error('Goal not found'));
      return Promise.resolve(item);
    });
  }

  add(payload: Partial<Goal>): Observable<{ message: string; goal: Goal }> {
    return defer(() => {
      const ownerId = this.requireUserId();
      const all = this.storage.getGoals();
      const now = new Date().toISOString();
      const target = Number(payload.targetValue ?? 100);
      const current = Number(payload.currentValue ?? 0);
      const goal: Goal = {
        _id: 'g-' + Date.now().toString(36),
        ownerId,
        title: (payload.title ?? '').trim(),
        description: (payload.description ?? '').trim(),
        category: (payload.category as GoalCategory) ?? 'Personal',
        targetValue: target,
        currentValue: current,
        unit: (payload.unit ?? '').trim(),
        startDate: payload.startDate ?? now,
        dueDate: payload.dueDate ?? now,
        status: (payload.status as GoalStatus) ?? 'active',
        milestones: payload.milestones ?? [],
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };
      all.push(goal);
      this.storage.saveGoals(all);
      return Promise.resolve({ message: 'Goal created', goal });
    });
  }

  edit(
    id: string,
    payload: Partial<Goal>
  ): Observable<{ message: string; goal: Goal }> {
    return defer(() => {
      const all = this.storage.getGoals();
      const idx = all.findIndex((g) => g._id === id);
      if (idx < 0) return Promise.reject(new Error('Goal not found'));
      if (!this.canMutate(all[idx].ownerId)) {
        return Promise.reject(new Error('Not authorized to edit this goal'));
      }
      const updated: Goal = {
        ...all[idx],
        ...payload,
        targetValue: Number(payload.targetValue ?? all[idx].targetValue),
        currentValue: Number(payload.currentValue ?? all[idx].currentValue),
        title: (payload.title ?? all[idx].title).trim(),
        description: (payload.description ?? all[idx].description).trim(),
        unit: (payload.unit ?? all[idx].unit).trim(),
        _id: all[idx]._id,
        ownerId: all[idx].ownerId,
        updatedAt: new Date().toISOString(),
      };
      all[idx] = updated;
      this.storage.saveGoals(all);
      return Promise.resolve({ message: 'Goal updated', goal: updated });
    });
  }

  setStatus(
    id: string,
    status: GoalStatus
  ): Observable<{ goal: Goal }> {
    return defer(() => {
      const all = this.storage.getGoals();
      const idx = all.findIndex((g) => g._id === id);
      if (idx < 0) return Promise.reject(new Error('Goal not found'));
      if (!this.canMutate(all[idx].ownerId)) {
        return Promise.reject(new Error('Not authorized'));
      }
      all[idx] = {
        ...all[idx],
        status,
        updatedAt: new Date().toISOString(),
      };
      this.storage.saveGoals(all);
      return Promise.resolve({ goal: all[idx] });
    });
  }

  toggleMilestone(
    id: string,
    milestoneId: string
  ): Observable<{ goal: Goal }> {
    return defer(() => {
      const all = this.storage.getGoals();
      const idx = all.findIndex((g) => g._id === id);
      if (idx < 0) return Promise.reject(new Error('Goal not found'));
      if (!this.canMutate(all[idx].ownerId)) {
        return Promise.reject(new Error('Not authorized'));
      }
      const milestones: GoalMilestone[] = all[idx].milestones.map((m) =>
        m.id === milestoneId ? { ...m, done: !m.done } : m
      );
      all[idx] = {
        ...all[idx],
        milestones,
        updatedAt: new Date().toISOString(),
      };
      this.storage.saveGoals(all);
      return Promise.resolve({ goal: all[idx] });
    });
  }

  delete(id: string): Observable<{ message: string }> {
    return defer(() => {
      const all = this.storage.getGoals();
      const idx = all.findIndex((g) => g._id === id);
      if (idx < 0) return Promise.reject(new Error('Goal not found'));
      if (!this.canMutate(all[idx].ownerId)) {
        return Promise.reject(new Error('Not authorized to delete this goal'));
      }
      all.splice(idx, 1);
      this.storage.saveGoals(all);
      return Promise.resolve({ message: 'Goal deleted' });
    });
  }

  private scoped(): Goal[] {
    const all = this.storage.getGoals().filter((g) => !g.isDeleted);
    if (this.auth.isAdmin()) return all;
    const userId = this.auth.getUserId();
    return all.filter((g) => g.ownerId === userId);
  }

  private canMutate(ownerId: string): boolean {
    if (this.auth.isAdmin()) return true;
    return this.auth.getUserId() === ownerId;
  }

  private requireUserId(): string {
    const id = this.auth.getUserId();
    if (!id) throw new Error('Not authenticated');
    return id;
  }
}
