import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { ApiService } from './api.service';
import { AuthTokens, LoginRequest, RegisterRequest, User, OsmProfile } from '../models/index';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly currentUser$ = new BehaviorSubject<User | null>(null);

  login(email: string, password: string): Observable<AuthTokens> {
    return this.api.post<AuthTokens>('/auth/login', { email, password } as LoginRequest).pipe(
      tap((tokens) => this.storeTokens(tokens)),
    );
  }

  register(dto: RegisterRequest): Observable<AuthTokens> {
    return this.api.post<AuthTokens>('/auth/register', dto).pipe(
      tap((tokens) => this.storeTokens(tokens)),
    );
  }

  logout(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this.currentUser$.next(null);
    this.router.navigate(['/login']);
  }

  refreshToken(): Observable<AuthTokens> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    return this.api.post<AuthTokens>('/auth/refresh', { refreshToken }).pipe(
      tap((tokens) => this.storeTokens(tokens)),
    );
  }

  getProfile(): Observable<User> {
    return this.api.get<User>('/auth/me').pipe(
      tap((user) => this.currentUser$.next(user)),
    );
  }

  updateProfile(dto: Partial<User>): Observable<User> {
    return this.api.patch<User>('/auth/me', dto).pipe(
      tap((user) => this.currentUser$.next(user)),
    );
  }

  changePassword(dto: { currentPassword: string; newPassword: string }): Observable<void> {
    return this.api.put<void>('/auth/me/password', dto);
  }

  forgotPassword(email: string): Observable<void> {
    return this.api.post<void>('/auth/forgot-password', { email });
  }

  resetPassword(token: string, password: string): Observable<void> {
    return this.api.post<void>('/auth/reset-password', { token, password });
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  // --- OpenStreetMap ---

  getOsmStatus(): Observable<{ configured: boolean }> {
    return this.api.get<{ configured: boolean }>('/auth/osm/status');
  }

  getOsmLoginUrl(): Observable<{ url: string }> {
    return this.api.get<{ url: string }>('/auth/osm/login-url');
  }

  getOsmLinkUrl(): Observable<{ url: string }> {
    return this.api.get<{ url: string }>('/auth/osm/link-url');
  }

  getOsmProfile(): Observable<OsmProfile | null> {
    return this.api.get<OsmProfile | null>('/auth/osm/profile');
  }

  unlinkOsm(): Observable<void> {
    return this.api.delete<void>('/auth/osm/link');
  }

  /** Utilisé par AuthCallbackComponent après un retour de connexion OpenStreetMap. */
  storeTokensFromOsmCallback(tokens: AuthTokens): void {
    this.storeTokens(tokens);
  }

  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}
