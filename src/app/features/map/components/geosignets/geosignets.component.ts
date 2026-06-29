import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';

import { MapService } from '../../services/map.service';
import { GeosignetService, Geosignet } from '../../../../core/services/geosignet.service';
import { AuthService } from '../../../../core/services/auth.service';
import { MapLayoutComponent } from '../map-layout/map-layout.component';

@Component({
  selector: 'app-geosignets',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatInputModule, MatFormFieldModule, MatListModule, MatTooltipModule,
    MatCardModule, MatSnackBarModule, TranslateModule,
  ],
  templateUrl: './geosignets.component.html',
  styleUrl: './geosignets.component.scss',
})
export class GeosignetsComponent implements OnInit {
  private readonly mapService = inject(MapService);
  private readonly geosignetService = inject(GeosignetService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly parentLayout = inject(MapLayoutComponent, { optional: true });

  readonly currentUser = this.authService.currentUser$;
  readonly bookmarks = signal<Geosignet[]>([]);
  bookmarkName = '';

  ngOnInit(): void {
    this.currentUser.subscribe(user => {
      if (user) {
        this.loadBookmarks();
      } else {
        this.bookmarks.set([]);
      }
    });
  }

  saveCurrentView(): void {
    if (!this.bookmarkName.trim()) return;

    const center = this.mapService.getCenter() as [number, number];
    const zoom = this.mapService.getZoom();

    this.geosignetService.create({
      name: this.bookmarkName.trim(),
      center,
      zoom,
    }).subscribe({
      next: (bookmark) => {
        this.bookmarks.update((bm) => [bookmark, ...bm]);
        this.bookmarkName = '';
        this.snackBar.open(
          this.translate.instant('shared.savedSuccessfully') || 'Enregistré avec succès',
          'OK',
          { duration: 3000 }
        );
      },
      error: () => {
        this.snackBar.open(
          this.translate.instant('shared.error') || 'Une erreur est survenue',
          'OK',
          { duration: 3000 }
        );
      }
    });
  }

  flyTo(bookmark: Geosignet): void {
    this.mapService.zoomTo(bookmark.center, bookmark.zoom);
  }

  delete(id: string): void {
    this.geosignetService.delete(id).subscribe({
      next: () => {
        this.bookmarks.update((bm) => bm.filter((b) => b.id !== id));
      },
      error: () => {
        this.snackBar.open(
          this.translate.instant('shared.error') || 'Une erreur est survenue',
          'OK',
          { duration: 3000 }
        );
      }
    });
  }

  share(bookmark: Geosignet): void {
    const lat = bookmark.center[1];
    const lon = bookmark.center[0];
    const zoom = bookmark.zoom;
    
    // Generate share URL
    const url = `${globalThis.location.origin}${globalThis.location.pathname}?lat=${lat}&lon=${lon}&z=${zoom}`;
    
    // Copy link to clipboard
    navigator.clipboard.writeText(url).then(() => {
      if (this.parentLayout) {
        this.parentLayout.shareUrlText.set(url);
        this.parentLayout.shareModalOpen.set(true);
      } else {
        this.snackBar.open(
          this.translate.instant('geosignets.share') || 'Lien copié !',
          'OK',
          { duration: 3000 }
        );
      }
    });
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  private loadBookmarks(): void {
    this.geosignetService.list().subscribe({
      next: (data) => {
        this.bookmarks.set(data);
      },
      error: () => {
        // Silent fail or default empty
        this.bookmarks.set([]);
      }
    });
  }
}
