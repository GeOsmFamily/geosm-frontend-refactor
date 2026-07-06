import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
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
      import('./features/auth/components/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/components/auth-callback/auth-callback.component').then((m) => m.AuthCallbackComponent),
  },
  {
    path: 'map',
    loadComponent: () =>
      import('./features/map/components/map-layout/map-layout.component').then((m) => m.MapLayoutComponent),
    canActivate: [authGuard],
  },
  {
    path: 'map/:instanceSlug',
    loadComponent: () =>
      import('./features/map/components/map-layout/map-layout.component').then((m) => m.MapLayoutComponent),
    canActivate: [authGuard],
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
