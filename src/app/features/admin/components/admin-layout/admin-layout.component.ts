import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';
import { Role } from '../../../../core/models/index';
import { OBSERVABILITY_LINKS } from '../../shared/constants/observability-links';
import { CloseOnEscapeOrOutsideDirective } from '../../../../shared/directives/close-on-escape-or-outside.directive';

interface AdminNavItem {
  path: string;
  icon: string;
  labelKey: string;
  /** Non renseigné = visible pour tous les rôles admin (SUPER_ADMIN et ADMIN_INSTANCE). */
  superAdminOnly?: boolean;
}

const NAV_ITEMS: AdminNavItem[] = [
  { path: 'users', icon: 'group', labelKey: 'admin.nav.users', superAdminOnly: true },
  { path: 'instances', icon: 'public', labelKey: 'admin.nav.instances' },
  { path: 'catalog', icon: 'layers', labelKey: 'admin.nav.catalog' },
  { path: 'content', icon: 'forum', labelKey: 'admin.nav.content' },
  { path: 'feedback', icon: 'flag', labelKey: 'admin.nav.feedback' },
  { path: 'jobs', icon: 'schedule', labelKey: 'admin.nav.jobs' },
  { path: 'observability', icon: 'insights', labelKey: 'admin.nav.observability' },
  { path: 'infra', icon: 'dns', labelKey: 'admin.nav.infra', superAdminOnly: true },
  { path: 'system-tools', icon: 'build', labelKey: 'admin.nav.systemTools', superAdminOnly: true },
];

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    TranslateModule,
    CloseOnEscapeOrOutsideDirective,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser$;
  readonly observabilityLinks = OBSERVABILITY_LINKS;

  /** Sidebar en drawer sur mobile/tablette (fermée par défaut) ; toujours visible en desktop via CSS. */
  readonly sidebarOpen = signal(false);

  constructor() {
    // Referme le drawer mobile automatiquement après un changement de page.
    this.router.events.pipe(filter((event) => event instanceof NavigationStart)).subscribe(() => {
      this.sidebarOpen.set(false);
    });
  }

  get navItems(): AdminNavItem[] {
    const isSuperAdmin = this.currentUser.value?.role === Role.SUPER_ADMIN;
    return NAV_ITEMS.filter((item) => !item.superAdminOnly || isSuperAdmin);
  }

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  backToMap(): void {
    this.router.navigate(['/map']);
  }
}
