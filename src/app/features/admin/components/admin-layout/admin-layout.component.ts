import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '../../../../core/services/auth.service';
import { Role } from '../../../../core/models/index';
import { OBSERVABILITY_LINKS } from '../../shared/constants/observability-links';

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
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, MatIconModule, MatButtonModule, MatTooltipModule, TranslateModule],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser$;
  readonly observabilityLinks = OBSERVABILITY_LINKS;

  get navItems(): AdminNavItem[] {
    const isSuperAdmin = this.currentUser.value?.role === Role.SUPER_ADMIN;
    return NAV_ITEMS.filter((item) => !item.superAdminOnly || isSuperAdmin);
  }

  backToMap(): void {
    this.router.navigate(['/map']);
  }
}
