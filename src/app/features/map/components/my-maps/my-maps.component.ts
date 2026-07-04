import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { MapService } from '../../services/map.service';
import { MapLayerService } from '../../services/map-layer.service';
import { MapCompositionService } from '../../../../core/services/map-composition.service';
import { LayerService } from '../../../../core/services/layer.service';
import { InstanceService } from '../../../../core/services/instance.service';
import { AuthService } from '../../../../core/services/auth.service';
import { MapComposition } from '../../../../core/models/index';

@Component({
  selector: 'app-my-maps',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatInputModule, MatFormFieldModule, MatCardModule, MatTooltipModule, MatSnackBarModule, TranslateModule,
  ],
  templateUrl: './my-maps.component.html',
  styleUrl: './my-maps.component.scss',
})
export class MyMapsComponent implements OnInit {
  private readonly mapService = inject(MapService);
  private readonly mapLayerService = inject(MapLayerService);
  private readonly mapCompositionService = inject(MapCompositionService);
  private readonly layerService = inject(LayerService);
  private readonly instanceService = inject(InstanceService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  readonly currentUser = this.authService.currentUser$;
  readonly maps = signal<MapComposition[]>([]);
  readonly saving = signal(false);
  readonly loadingMapId = signal<string | null>(null);
  mapName = '';

  ngOnInit(): void {
    this.currentUser.subscribe((user) => {
      if (user) {
        this.loadMaps();
      } else {
        this.maps.set([]);
      }
    });
  }

  saveCurrentMap(): void {
    const instance = this.instanceService.currentInstance$.value;
    const user = this.currentUser.value;
    if (!this.mapName.trim() || !instance || !user) return;

    this.saving.set(true);
    const [lon, lat] = this.mapService.getCenter();
    // Le zoom OpenLayers peut être fractionnaire (ex. 6.49) ; le backend exige un entier
    // (schema Zod `z.number().int()`).
    const zoom = Math.round(this.mapService.getZoom());
    const layers = this.mapLayerService.getActiveLayers().map((al) => ({
      layerId: al.layer.id,
      opacity: al.opacity,
      visible: al.visible,
    }));

    this.mapCompositionService.create(instance.id, {
      name: this.mapName.trim(),
      slug: this.slugify(this.mapName.trim()) + '-' + Date.now().toString(36),
      layers,
      center: { lat, lon },
      zoom,
    }).subscribe({
      next: (composition) => {
        this.saving.set(false);
        this.maps.update((m) => [composition, ...m]);
        this.mapName = '';
        this.snackBar.open(
          this.translate.instant('shared.savedSuccessfully') || 'Enregistré avec succès',
          'OK',
          { duration: 3000 },
        );
      },
      error: () => {
        this.saving.set(false);
        this.snackBar.open(
          this.translate.instant('shared.error') || 'Une erreur est survenue',
          'OK',
          { duration: 3000 },
        );
      },
    });
  }

  loadMap(composition: MapComposition): void {
    const instance = this.instanceService.currentInstance$.value;
    if (!instance) return;
    this.loadingMapId.set(composition.id);

    this.mapLayerService.removeAll();

    const layerRequests = composition.layers.map((ref) =>
      this.layerService.getById(instance.id, ref.layerId).pipe(catchError(() => of(null))),
    );

    const applyView = () => {
      this.mapService.zoomTo([composition.center.lon, composition.center.lat], composition.zoom);
      this.loadingMapId.set(null);
    };

    if (layerRequests.length === 0) {
      applyView();
      return;
    }

    forkJoin(layerRequests).subscribe((results) => {
      results.forEach((layer, i) => {
        if (!layer) return;
        this.mapLayerService.addLayer(layer);
        const ref = composition.layers[i];
        if (ref.opacity !== undefined) this.mapLayerService.setOpacity(layer.id, ref.opacity);
        if (ref.visible === false) this.mapLayerService.setVisibility(layer.id, false);
      });
      applyView();
    });
  }

  delete(composition: MapComposition): void {
    const instance = this.instanceService.currentInstance$.value;
    if (!instance) return;
    this.mapCompositionService.delete(instance.id, composition.id).subscribe({
      next: () => {
        this.maps.update((m) => m.filter((c) => c.id !== composition.id));
      },
      error: () => {
        this.snackBar.open(
          this.translate.instant('shared.error') || 'Une erreur est survenue',
          'OK',
          { duration: 3000 },
        );
      },
    });
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  private loadMaps(): void {
    const instance = this.instanceService.currentInstance$.value;
    const user = this.currentUser.value;
    if (!instance || !user) return;
    this.mapCompositionService.list(instance.id).subscribe({
      next: (data) => {
        // Le backend liste TOUTES les compositions de l'instance (pas de filtrage par
        // propriétaire) - "Mes cartes" ne montre donc que les siennes côté client.
        this.maps.set(data.filter((c) => c.userId === user.id));
      },
      error: () => this.maps.set([]),
    });
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'carte';
  }
}
