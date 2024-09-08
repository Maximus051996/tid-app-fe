import { Injectable } from '@angular/core';
import { environment } from '../../environment/environment';
import { catchError, Observable, throwError } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  serverUrl = environment.serverUrl;
  constructor(private http: HttpClient) {}

  getallTasks(): Observable<any> {
    const url = `${this.serverUrl}tasks`;
    return this.http.get(url).pipe(catchError(this.handleError));
  }

  gettaskbyId(id: any): Observable<any> {
    const url = `${this.serverUrl}task/${id}`;
    return this.http.get(url).pipe(catchError(this.handleError));
  }

  addtask(payload: any): Observable<any> {
    const url = `${this.serverUrl}add-task`;
    return this.http.post(url, payload).pipe(catchError(this.handleError));
  }

  editTask(id: any, payload: any): Observable<any> {
    const url = `${this.serverUrl}update-task/${id}`;
    return this.http.put(url, payload).pipe(catchError(this.handleError));
  }

  deleteTask(id: any): Observable<any> {
    const url = `${this.serverUrl}delete-task/${id}`;
    return this.http.delete(url).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => new Error(error.error.message));
  }
}
