import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../../core/services/auth.service';

/**
 * Point d'atterrissage après une connexion OpenStreetMap réussie (voir GET /auth/osm/callback
 * côté backend, qui redirige ici avec les tokens en query params plutôt qu'en JSON puisque
 * c'est une navigation plein-écran initiée par OSM, pas un appel fetch).
 */
@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  template: `
    <div class="callback-page">
      <mat-spinner diameter="40"></mat-spinner>
      <p>Connexion en cours...</p>
    </div>
  `,
  styles: [`
    .callback-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      color: var(--text-secondary, #64748b);
    }
  `],
})
export class AuthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (accessToken && refreshToken) {
      this.authService.storeTokensFromOsmCallback({ accessToken, refreshToken });
      this.router.navigate(['/map']);
    } else {
      this.router.navigate(['/login'], { queryParams: { osmError: '1' } });
    }
  }
}
