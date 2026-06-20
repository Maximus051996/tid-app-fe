import { Injectable } from '@angular/core';
import { defer, Observable } from 'rxjs';
import { StorageService } from '../storage/storage.service';
import { AuthService } from '../auth/auth.service';
import { Investment } from '../../models/models';

/**
 * Investment CRUD backed by localStorage with the same Observable shape
 * as the task service.
 */
@Injectable({ providedIn: 'root' })
export class InvestmentService {
  constructor(
    private storage: StorageService,
    private auth: AuthService
  ) {}

  getAll(): Observable<Investment[]> {
    return defer(() => Promise.resolve(this.scoped()));
  }

  getById(id: string): Observable<Investment> {
    return defer(() => {
      const item = this.scoped().find((i) => i._id === id);
      if (!item) return Promise.reject(new Error('Investment not found'));
      return Promise.resolve(item);
    });
  }

  add(payload: Partial<Investment>): Observable<{ message: string; investment: Investment }> {
    return defer(() => {
      const ownerId = this.requireUserId();
      const all = this.storage.getInvestments();
      const now = new Date().toISOString();
      const investment: Investment = {
        _id: 'i-' + Date.now().toString(36),
        ownerId,
        name: payload.name ?? '',
        type: (payload.type as Investment['type']) ?? 'Other',
        amount: Number(payload.amount ?? 0),
        currentValue: Number(payload.currentValue ?? payload.amount ?? 0),
        startDate: payload.startDate ?? now,
        maturityDate: payload.maturityDate ?? null,
        risk: (payload.risk as Investment['risk']) ?? 'Medium',
        status: (payload.status as Investment['status']) ?? 'Active',
        notes: payload.notes ?? '',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };
      all.push(investment);
      this.storage.saveInvestments(all);
      return Promise.resolve({ message: 'Investment created successfully', investment });
    });
  }

  edit(
    id: string,
    payload: Partial<Investment>
  ): Observable<{ message: string; investment: Investment }> {
    return defer(() => {
      const all = this.storage.getInvestments();
      const idx = all.findIndex((i) => i._id === id);
      if (idx < 0) return Promise.reject(new Error('Investment not found'));
      if (!this.canMutate(all[idx].ownerId)) {
        return Promise.reject(new Error('Not authorized to edit this investment'));
      }
      const updated: Investment = {
        ...all[idx],
        ...payload,
        amount: Number(payload.amount ?? all[idx].amount),
        currentValue: Number(payload.currentValue ?? all[idx].currentValue),
        _id: all[idx]._id,
        ownerId: all[idx].ownerId,
        updatedAt: new Date().toISOString(),
      } as Investment;
      all[idx] = updated;
      this.storage.saveInvestments(all);
      return Promise.resolve({ message: 'Investment updated successfully', investment: updated });
    });
  }

  delete(id: string): Observable<{ message: string }> {
    return defer(() => {
      const all = this.storage.getInvestments();
      const idx = all.findIndex((i) => i._id === id);
      if (idx < 0) return Promise.reject(new Error('Investment not found'));
      if (!this.canMutate(all[idx].ownerId)) {
        return Promise.reject(new Error('Not authorized to delete this investment'));
      }
      all[idx] = {
        ...all[idx],
        isDeleted: true,
        updatedAt: new Date().toISOString(),
      };
      this.storage.saveInvestments(all);
      return Promise.resolve({ message: 'Investment deleted successfully' });
    });
  }

  private scoped(): Investment[] {
    const all = this.storage.getInvestments();
    if (this.auth.isAdmin()) return all;
    const userId = this.auth.getUserId();
    return all.filter((i) => i.ownerId === userId);
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
