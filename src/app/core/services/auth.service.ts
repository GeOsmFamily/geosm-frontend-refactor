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

  /**
   * rememberMe=true (par défaut) persiste la session dans localStorage (survit à la fermeture du
   * navigateur) ; false utilise sessionStorage (effacé à la fermeture) - voir getToken()/
   * getRefreshToken() qui lisent les deux emplacements pour rester cohérents peu importe où la
   * session a été stockée.
   */
  login(email: string, password: string, rememberMe = true): Observable<AuthTokens> {
    return this.api.post<AuthTokens>('/auth/login', { email, password } as LoginRequest).pipe(
      tap((tokens) => this.storeTokens(tokens, rememberMe)),
    );
  }

  register(dto: RegisterRequest): Observable<AuthTokens> {
    return this.api.post<AuthTokens>('/auth/register', dto).pipe(
      tap((tokens) => this.storeTokens(tokens, true)),
    );
  }

  logout(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    this.currentUser$.next(null);
    this.router.navigate(['/login']);
  }

  refreshToken(): Observable<AuthTokens> {
    const refreshToken = this.getRefreshToken();
    // Un refresh conserve le même emplacement (localStorage vs sessionStorage) que la session
    // en cours - sinon un "remember me" décoché finirait par persister le nouveau token dans
    // localStorage au premier rafraîchissement, contournant silencieusement le choix initial.
    const rememberMe = !!localStorage.getItem(REFRESH_TOKEN_KEY);
    return this.api.post<AuthTokens>('/auth/refresh', { refreshToken }).pipe(
      tap((tokens) => this.storeTokens(tokens, rememberMe)),
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

  verifyEmail(token: string): Observable<void> {
    return this.api.post<void>('/auth/verify-email', { token });
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
    return localStorage.getItem(ACCESS_TOKEN_KEY) ?? sessionStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY) ?? sessionStorage.getItem(REFRESH_TOKEN_KEY);
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
    this.storeTokens(tokens, true);
  }

  private storeTokens(tokens: AuthTokens, rememberMe: boolean): void {
    // Change d'emplacement : si une session précédente existait ailleurs (ex. bascule
    // remember-me entre deux connexions), on nettoie l'autre emplacement pour ne pas laisser
    // un jeton obsolète traîner.
    const [target, other] = rememberMe ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
    other.removeItem(ACCESS_TOKEN_KEY);
    other.removeItem(REFRESH_TOKEN_KEY);
    target.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    target.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}
