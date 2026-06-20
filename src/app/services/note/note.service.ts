import { Injectable } from '@angular/core';
import { defer, Observable } from 'rxjs';
import { StorageService } from '../storage/storage.service';
import { AuthService } from '../auth/auth.service';
import { Note, NoteColor } from '../../models/models';

/**
 * Note CRUD backed by encrypted localStorage. Same Observable pattern
 * the rest of the app uses so consumers can `subscribe` and unsubscribe
 * via takeUntil(destroy$).
 */
@Injectable({ providedIn: 'root' })
export class NoteService {
  constructor(
    private storage: StorageService,
    private auth: AuthService
  ) {}

  getAll(): Observable<Note[]> {
    return defer(() => Promise.resolve(this.scoped()));
  }

  getById(id: string): Observable<Note> {
    return defer(() => {
      const item = this.scoped().find((n) => n._id === id);
      if (!item) return Promise.reject(new Error('Note not found'));
      return Promise.resolve(item);
    });
  }

  add(payload: Partial<Note>): Observable<{ message: string; note: Note }> {
    return defer(() => {
      const ownerId = this.requireUserId();
      const all = this.storage.getNotes();
      const now = new Date().toISOString();
      const note: Note = {
        _id: 'n-' + Date.now().toString(36),
        ownerId,
        title: (payload.title ?? '').trim(),
        body: (payload.body ?? '').trim(),
        color: (payload.color as NoteColor) ?? 'yellow',
        tags: (payload.tags ?? []).map((t) => t.trim()).filter(Boolean),
        pinned: !!payload.pinned,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };
      all.push(note);
      this.storage.saveNotes(all);
      return Promise.resolve({ message: 'Note created', note });
    });
  }

  edit(
    id: string,
    payload: Partial<Note>
  ): Observable<{ message: string; note: Note }> {
    return defer(() => {
      const all = this.storage.getNotes();
      const idx = all.findIndex((n) => n._id === id);
      if (idx < 0) return Promise.reject(new Error('Note not found'));
      if (!this.canMutate(all[idx].ownerId)) {
        return Promise.reject(new Error('Not authorized to edit this note'));
      }
      const updated: Note = {
        ...all[idx],
        ...payload,
        title: (payload.title ?? all[idx].title).trim(),
        body: (payload.body ?? all[idx].body).trim(),
        tags: (payload.tags ?? all[idx].tags).map((t) => t.trim()).filter(Boolean),
        _id: all[idx]._id,
        ownerId: all[idx].ownerId,
        updatedAt: new Date().toISOString(),
      };
      all[idx] = updated;
      this.storage.saveNotes(all);
      return Promise.resolve({ message: 'Note updated', note: updated });
    });
  }

  togglePin(id: string): Observable<{ note: Note }> {
    return defer(() => {
      const all = this.storage.getNotes();
      const idx = all.findIndex((n) => n._id === id);
      if (idx < 0) return Promise.reject(new Error('Note not found'));
      if (!this.canMutate(all[idx].ownerId)) {
        return Promise.reject(new Error('Not authorized'));
      }
      all[idx] = {
        ...all[idx],
        pinned: !all[idx].pinned,
        updatedAt: new Date().toISOString(),
      };
      this.storage.saveNotes(all);
      return Promise.resolve({ note: all[idx] });
    });
  }

  delete(id: string): Observable<{ message: string }> {
    return defer(() => {
      const all = this.storage.getNotes();
      const idx = all.findIndex((n) => n._id === id);
      if (idx < 0) return Promise.reject(new Error('Note not found'));
      if (!this.canMutate(all[idx].ownerId)) {
        return Promise.reject(new Error('Not authorized to delete this note'));
      }
      // Notes are hard-deleted — no soft-delete spam in storage.
      all.splice(idx, 1);
      this.storage.saveNotes(all);
      return Promise.resolve({ message: 'Note deleted' });
    });
  }

  private scoped(): Note[] {
    const all = this.storage.getNotes().filter((n) => !n.isDeleted);
    if (this.auth.isAdmin()) return all;
    const userId = this.auth.getUserId();
    return all.filter((n) => n.ownerId === userId);
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
