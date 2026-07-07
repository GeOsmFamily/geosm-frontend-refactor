import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';
import { Role } from '../../core/models/index';

/**
 * Le garde de rôle (roleGuard) est appliqué une seule fois au point de montage '/admin' dans
 * app.routes.ts pour SUPER_ADMIN/ADMIN_INSTANCE - inutile de le répéter sur chaque route enfant
 * ici, Angular le réévalue de toute façon à chaque navigation. 'users' est l'exception : la
 * gestion globale des utilisateurs (GET/POST/PATCH/DELETE /users) est réservée à SUPER_ADMIN
 * côté backend (voir user.routes.ts), d'où un second garde plus restrictif sur cette seule route.
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
      {
        path: 'users',
        canActivate: [roleGuard([Role.SUPER_ADMIN])],
        loadComponent: () =>
          import('./components/users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'instances',
        loadComponent: () =>
          import('./components/instances/instances.component').then((m) => m.InstancesComponent),
      },
      {
        path: 'instances/:id/users',
        loadComponent: () =>
          import('./components/instances/instance-users/instance-users.component').then((m) => m.InstanceUsersComponent),
      },
      {
        path: 'catalog',
        loadComponent: () =>
          import('./components/catalog/catalog.component').then((m) => m.CatalogComponent),
      },
      // Lots suivants : 'content' (A4), 'feedback' (A5), 'jobs' (A6),
      // 'observability' (A7), 'infra' (A8), 'system-tools' (A9).
    ],
  },
];
