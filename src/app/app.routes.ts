import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';
import { Role } from './core/models/index';

export const routes: Routes = [
  { path: '', redirectTo: '/map', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/components/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/components/register/register.component').then(
        (m) => m.RegisterComponent,
      ),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/components/auth-callback/auth-callback.component').then(
        (m) => m.AuthCallbackComponent,
      ),
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./features/auth/components/verify-email/verify-email.component').then(
        (m) => m.VerifyEmailComponent,
      ),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/components/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/components/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    // Le géoportail est public : un visiteur anonyme doit pouvoir consulter la carte sans
    // compte (voir MapLayoutComponent, qui ne charge le profil que si une session existe déjà).
    // Les actions qui nécessitent un compte (commentaires, favoris, admin...) restent gardées
    // individuellement côté backend/composant.
    path: 'map',
    loadComponent: () =>
      import('./features/map/components/map-layout/map-layout.component').then(
        (m) => m.MapLayoutComponent,
      ),
  },
  {
    path: 'map/:instanceSlug',
    loadComponent: () =>
      import('./features/map/components/map-layout/map-layout.component').then(
        (m) => m.MapLayoutComponent,
      ),
  },
  {
    path: 'share/:code',
    loadComponent: () =>
      import('./features/sharing/shared-map.component').then((m) => m.SharedMapComponent),
  },
  {
    path: 'admin',
    canActivate: [roleGuard([Role.SUPER_ADMIN, Role.ADMIN_INSTANCE])],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  { path: '**', redirectTo: '/map' },
];
