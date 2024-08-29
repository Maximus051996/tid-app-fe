import { Injectable } from '@angular/core';
import { environment } from '../../environment/environment';
import { Observable } from 'rxjs/internal/Observable';
import { catchError, throwError } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  serverUrl = environment.serverUrl;
  constructor(private http: HttpClient) {}
  registeruser(payload: any): Observable<any> {
    const url = `${this.serverUrl}register-user`;
    return this.http.post(url, payload).pipe(catchError(this.handleError));
  }

  loginUser(payload: any): Observable<any> {
    const url = `${this.serverUrl}login`;
    return this.http.post(url, payload).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => new Error(error.error.message));
  }
}
