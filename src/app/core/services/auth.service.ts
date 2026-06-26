import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { ApiService } from './api.service';
import { AuthTokens, LoginRequest, RegisterRequest, User } from '../models/index';

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
    return this.api.get<User>('/auth/profile').pipe(
      tap((user) => this.currentUser$.next(user)),
    );
  }

  updateProfile(dto: Partial<User>): Observable<User> {
    return this.api.patch<User>('/auth/profile', dto).pipe(
      tap((user) => this.currentUser$.next(user)),
    );
  }

  changePassword(dto: { currentPassword: string; newPassword: string }): Observable<void> {
    return this.api.post<void>('/auth/change-password', dto);
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

  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}
