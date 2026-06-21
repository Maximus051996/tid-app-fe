import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import { Goal, GoalStatus } from '../../models/models';

interface GoalEnvelope {
  message: string;
  goal: Goal;
}

@Injectable({ providedIn: 'root' })
export class GoalService {
  constructor(private api: ApiService) {}

  getAll(silent = false): Observable<Goal[]> {
    return this.api.get<Goal[]>('/goals', { silent });
  }

  getById(id: string): Observable<Goal> {
    return this.api.get<Goal>(`/goals/${id}`);
  }

  add(payload: Partial<Goal>): Observable<GoalEnvelope> {
    return this.api.post<GoalEnvelope>('/goals', payload);
  }

  edit(id: string, payload: Partial<Goal>): Observable<GoalEnvelope> {
    return this.api.put<GoalEnvelope>(`/goals/${id}`, payload);
  }

  setStatus(id: string, status: GoalStatus): Observable<{ goal: Goal }> {
    return this.api.patch<{ goal: Goal }>(`/goals/${id}/status`, { status });
  }

  toggleMilestone(id: string, milestoneId: string): Observable<{ goal: Goal }> {
    return this.api.patch<{ goal: Goal }>(
      `/goals/${id}/milestones/${milestoneId}/toggle`,
      {}
    );
  }

  delete(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/goals/${id}`);
  }
}
