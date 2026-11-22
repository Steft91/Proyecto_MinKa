import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import type { SesionActual } from '@minka/contracts';
import { Observable, tap } from 'rxjs';

const tokenKey = 'minka.google.id_token';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  readonly session = signal<SesionActual | null>(null);

  constructor(private readonly http: HttpClient) {}

  loginWithGoogle(idToken: string): Observable<SesionActual> {
    return this.http
      .post<SesionActual>('/api/v1/auth/google', { idToken })
      .pipe(tap(() => localStorage.setItem(tokenKey, idToken)));
  }

  loadSession(): Observable<SesionActual> {
    return this.http.get<SesionActual>('/api/v1/auth/me').pipe(
      tap((session) => this.session.set(session)),
    );
  }

  token(): string | null {
    return localStorage.getItem(tokenKey);
  }

  logout(): void {
    localStorage.removeItem(tokenKey);
    this.session.set(null);
  }
}
