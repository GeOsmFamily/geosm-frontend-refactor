import { Routes } from '@angular/router';

/**
 * Le garde de rôle (roleGuard) est appliqué une seule fois au point de montage '/admin' dans
 * app.routes.ts - inutile de le répéter sur chaque route enfant ici, Angular le réévalue de
 * toute façon à chaque navigation puisque ce segment reste dans l'arbre de routes actif.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./components/admin-home/admin-home.component').then((m) => m.AdminHomeComponent),
      },
      // Lots suivants : 'users', 'instances' (A2), 'catalog' (A3), 'content' (A4),
      // 'feedback' (A5), 'jobs' (A6), 'observability' (A7), 'infra' (A8), 'system-tools' (A9).
    ],
  },
];
