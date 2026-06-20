import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import { Investment } from '../../models/models';

interface InvestmentEnvelope {
  message: string;
  investment: Investment;
}

@Injectable({ providedIn: 'root' })
export class InvestmentService {
  constructor(private api: ApiService) {}

  getAll(): Observable<Investment[]> {
    return this.api.get<Investment[]>('/investments');
  }

  getById(id: string): Observable<Investment> {
    return this.api.get<Investment>(`/investments/${id}`);
  }

  add(payload: Partial<Investment>): Observable<InvestmentEnvelope> {
    return this.api.post<InvestmentEnvelope>('/investments', payload);
  }

  edit(id: string, payload: Partial<Investment>): Observable<InvestmentEnvelope> {
    return this.api.put<InvestmentEnvelope>(`/investments/${id}`, payload);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/investments/${id}`);
  }
}
