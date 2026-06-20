import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import { Task } from '../../models/models';

interface TaskResponseEnvelope {
  message: string;
  task: Task;
}

/**
 * Task CRUD against the backend. The `_id` field on the wire is a Mongo
 * ObjectId hex string — same shape the FE used before, so consumers
 * don't need to change.
 */
@Injectable({ providedIn: 'root' })
export class TaskService {
  constructor(private api: ApiService) {}

  getallTasks(): Observable<Task[]> {
    return this.api.get<Task[]>('/tasks');
  }

  gettaskbyId(id: string): Observable<Task> {
    return this.api.get<Task>(`/tasks/${id}`);
  }

  addtask(payload: Partial<Task>): Observable<TaskResponseEnvelope> {
    return this.api.post<TaskResponseEnvelope>('/tasks', payload);
  }

  editTask(id: string, payload: Partial<Task>): Observable<TaskResponseEnvelope> {
    return this.api.put<TaskResponseEnvelope>(`/tasks/${id}`, payload);
  }

  deleteTask(id: string): Observable<{ message: string }> {
    return this.api
      .delete<{ message: string }>(`/tasks/${id}`)
      .pipe(map((r) => ({ message: r.message })));
  }
}
