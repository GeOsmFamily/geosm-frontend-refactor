import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../services/auth.service';

const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/catalog'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/')) {
    return next(req);
  }

  const translate = inject(TranslateService);
  const lang = translate.currentLang || 'fr';
  const headers: Record<string, string> = {
    'Accept-Language': lang,
  };

  const isPublic = PUBLIC_PATHS.some((path) => req.url.includes(path));
  if (!isPublic) {
    const authService = inject(AuthService);
    const token = authService.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const cloned = req.clone({ setHeaders: headers });
  return next(cloned);
};

