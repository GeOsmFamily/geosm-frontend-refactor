import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { Role } from '../models/index';

/**
 * currentUser$ n'est peuplé que si MapLayoutComponent a déjà été instancié (seul appelant de
 * getProfile()) - une navigation directe vers une route gardée (rafraîchissement, lien direct)
 * peut donc arriver ici avec un token valide mais currentUser$ encore à null. On refait l'appel
 * dans ce cas plutôt que de supposer l'utilisateur non autorisé.
 */
export const roleGuard = (allowedRoles: Role[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }

    const cachedUser = authService.currentUser$.value;
    if (cachedUser) {
      return allowedRoles.includes(cachedUser.role) ? true : router.createUrlTree(['/map']);
    }

    return authService.getProfile().pipe(
      map((user) => (allowedRoles.includes(user.role) ? true : router.createUrlTree(['/map']))),
      catchError(() => of(router.createUrlTree(['/login']))),
    );
  };
};
