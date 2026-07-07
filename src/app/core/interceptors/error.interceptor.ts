import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

let isRefreshing = false;

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error) => {
      // Le géoportail est consultable sans compte (voir app.routes.ts) - un visiteur anonyme
      // qui touche un endpoint protégé (ex. resync, favoris) reçoit un 401 légitime sans jamais
      // avoir eu de refresh token. Tenter un refresh avec un token null renvoyait un 400 et,
      // pire, appelait authService.logout() -> redirection forcée vers /login pour un visiteur
      // qui n'a jamais été connecté. On ne tente le refresh que si une session existait déjà.
      if (error.status === 401 && !req.url.includes('/auth/') && authService.getRefreshToken()) {
        if (!isRefreshing) {
          isRefreshing = true;
          return authService.refreshToken().pipe(
            switchMap((tokens) => {
              isRefreshing = false;
              const cloned = req.clone({
                setHeaders: { Authorization: `Bearer ${tokens.accessToken}` },
              });
              return next(cloned);
            }),
            catchError((refreshError) => {
              isRefreshing = false;
              authService.logout();
              return throwError(() => refreshError);
            }),
          );
        }
        authService.logout();
      }

      if (error.status === 403) {
        router.navigate(['/map']);
      }

      return throwError(() => error);
    }),
  );
};
