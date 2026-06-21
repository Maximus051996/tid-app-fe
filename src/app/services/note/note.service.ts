import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import { Note } from '../../models/models';

interface NoteEnvelope {
  message: string;
  note: Note;
}

@Injectable({ providedIn: 'root' })
export class NoteService {
  constructor(private api: ApiService) {}

  getAll(silent = false): Observable<Note[]> {
    return this.api.get<Note[]>('/notes', { silent });
  }

  getById(id: string): Observable<Note> {
    return this.api.get<Note>(`/notes/${id}`);
  }

  add(payload: Partial<Note>): Observable<NoteEnvelope> {
    return this.api.post<NoteEnvelope>('/notes', payload);
  }

  edit(id: string, payload: Partial<Note>): Observable<NoteEnvelope> {
    return this.api.put<NoteEnvelope>(`/notes/${id}`, payload);
  }

  togglePin(id: string): Observable<{ note: Note }> {
    return this.api.patch<{ note: Note }>(`/notes/${id}/toggle-pin`, {});
  }

  delete(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/notes/${id}`);
  }
}
