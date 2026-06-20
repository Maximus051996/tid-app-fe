import { Injectable } from '@angular/core';
import { defer, Observable } from 'rxjs';
import { StorageService } from '../storage/storage.service';
import { AuthService } from '../auth/auth.service';
import { Task } from '../../models/models';

/**
 * Task CRUD backed by localStorage. Mirrors the previous HTTP-based API
 * (Observable returns, similar response shapes) so consumers don't change.
 */
@Injectable({ providedIn: 'root' })
export class TaskService {
  constructor(
    private storage: StorageService,
    private auth: AuthService
  ) {}

  getallTasks(): Observable<Task[]> {
    return defer(() => Promise.resolve(this.scopedTasks()));
  }

  gettaskbyId(id: string): Observable<Task> {
    return defer(() => {
      const task = this.scopedTasks().find((t) => t._id === id);
      if (!task) return Promise.reject(new Error('Task not found'));
      return Promise.resolve(task);
    });
  }

  addtask(payload: Partial<Task>): Observable<{ message: string; task: Task }> {
    return defer(() => {
      const ownerId = this.requireUserId();
      const all = this.storage.getTasks();
      const now = new Date().toISOString();
      const task: Task = {
        _id: 't-' + Date.now().toString(36),
        ownerId,
        subject: payload.subject ?? '',
        description: payload.description ?? '',
        priority: (payload.priority as Task['priority']) ?? 'Low',
        startDate: payload.startDate ?? now,
        endDate: payload.endDate ?? now,
        isRemainder: !!payload.isRemainder,
        isDeleted: false,
        taskStatus: (payload.taskStatus as Task['taskStatus']) ?? 'notStarted',
        subtasks: payload.subtasks ?? [],
        createdAt: now,
        updatedAt: now,
      };
      all.push(task);
      this.storage.saveTasks(all);
      return Promise.resolve({ message: 'Task created successfully', task });
    });
  }

  editTask(
    id: string,
    payload: Partial<Task>
  ): Observable<{ message: string; task: Task }> {
    return defer(() => {
      const all = this.storage.getTasks();
      const idx = all.findIndex((t) => t._id === id);
      if (idx < 0) return Promise.reject(new Error('Task not found'));
      if (!this.canMutate(all[idx].ownerId)) {
        return Promise.reject(new Error('Not authorized to edit this task'));
      }
      const updated: Task = {
        ...all[idx],
        ...payload,
        _id: all[idx]._id,
        ownerId: all[idx].ownerId,
        updatedAt: new Date().toISOString(),
      } as Task;
      all[idx] = updated;
      this.storage.saveTasks(all);
      return Promise.resolve({ message: 'Task updated successfully', task: updated });
    });
  }

  deleteTask(id: string): Observable<{ message: string }> {
    return defer(() => {
      const all = this.storage.getTasks();
      const idx = all.findIndex((t) => t._id === id);
      if (idx < 0) return Promise.reject(new Error('Task not found'));
      if (!this.canMutate(all[idx].ownerId)) {
        return Promise.reject(new Error('Not authorized to delete this task'));
      }
      all[idx] = {
        ...all[idx],
        isDeleted: true,
        updatedAt: new Date().toISOString(),
      };
      this.storage.saveTasks(all);
      return Promise.resolve({ message: 'Task deleted successfully' });
    });
  }

  /** Returns tasks for the current user, or all tasks if admin. */
  private scopedTasks(): Task[] {
    const all = this.storage.getTasks();
    if (this.auth.isAdmin()) return all;
    const userId = this.auth.getUserId();
    return all.filter((t) => t.ownerId === userId);
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
