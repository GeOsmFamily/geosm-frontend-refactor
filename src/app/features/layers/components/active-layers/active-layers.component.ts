import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MapLayerService, ActiveLayer } from '../../../map/services/map-layer.service';
import { TruncatePipe } from '../../../../shared/pipes/truncate.pipe';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SharingService } from '../../../../core/services/sharing.service';
import { InstanceService } from '../../../../core/services/instance.service';
import { MapService } from '../../../map/services/map.service';
import { AuthService } from '../../../../core/services/auth.service';
import { LayerService } from '../../../../core/services/layer.service';
import { GeoportailService } from '../../../../core/services/geoportail.service';
import { Role, ViewportSummary } from '../../../../core/models/index';
import { toLonLat } from 'ol/proj';

@Component({
  selector: 'app-active-layers',
  standalone: true,
  imports: [
    TranslateModule,
    CommonModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatSliderModule,
    MatTooltipModule,
    MatSnackBarModule,
    DragDropModule,
    TruncatePipe,
  ],
  templateUrl: './active-layers.component.html',
  styleUrl: './active-layers.component.scss',
})
export class ActiveLayersComponent implements OnInit {
  private readonly mapLayerService = inject(MapLayerService);
  private readonly sharingService = inject(SharingService);
  private readonly instanceService = inject(InstanceService);
  private readonly mapService = inject(MapService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly authService = inject(AuthService);
  private readonly layerService = inject(LayerService);
  private readonly geoportailService = inject(GeoportailService);

  readonly activeLayers$ = this.mapLayerService.activeLayers$;
  readonly resyncingIds = new Set<string>();

  viewSummary: ViewportSummary | null = null;
  viewSummaryLoading = false;

  ngOnInit(): void {
    // Résumé IA de la vue courante généré une seule fois à l'ouverture du panneau (pas à
    // chaque ajout/suppression de couche, pour éviter de spammer l'API Gemini).
    const layerIds = this.mapLayerService.getActiveLayers().map((al) => al.layer.id);
    if (layerIds.length === 0) return;

    this.viewSummaryLoading = true;
    this.geoportailService.summarizeView(layerIds).subscribe({
      next: (summary) => {
        this.viewSummary = summary;
        this.viewSummaryLoading = false;
      },
      error: () => {
        this.viewSummary = null;
        this.viewSummaryLoading = false;
      },
    });
  }

  toggleVisibility(layer: ActiveLayer): void {
    this.mapLayerService.toggleVisibility(layer.layer.id);
  }

  onOpacityChange(layer: ActiveLayer, event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.mapLayerService.setOpacity(layer.layer.id, value / 100);
  }

  removeLayer(layer: ActiveLayer): void {
    this.mapLayerService.removeLayer(layer.layer.id);
  }

  removeAll(): void {
    this.mapLayerService.removeAll();
  }

  onDrop(event: CdkDragDrop<ActiveLayer[]>): void {
    this.mapLayerService.reorder(event.previousIndex, event.currentIndex);
  }

  toggleHeatmap(layer: ActiveLayer): void {
    const next = layer.viewMode === 'heatmap' ? 'cluster' : 'heatmap';
    this.mapLayerService.setViewMode(layer.layer.id, next);
  }

  // Le bouton de resynchronisation n'a de sens que pour SUPER_ADMIN/ADMIN_INSTANCE (même
  // restriction que côté backend, voir layer.routes.ts) - inutile de l'exposer à un simple
  // visiteur qui n'a de toute façon pas les droits de l'utiliser.
  canResync(): boolean {
    const role = this.authService.currentUser$.value?.role;
    return role === Role.SUPER_ADMIN || role === Role.ADMIN_INSTANCE;
  }

  isResyncing(layer: ActiveLayer): boolean {
    return this.resyncingIds.has(layer.layer.id);
  }

  resyncLayer(layer: ActiveLayer): void {
    const instance = this.instanceService.currentInstance$.value;
    if (!instance || this.isResyncing(layer)) return;

    this.resyncingIds.add(layer.layer.id);
    this.layerService.resync(instance.id, layer.layer.id).subscribe({
      next: (updated) => {
        this.resyncingIds.delete(layer.layer.id);
        layer.layer.metadata = updated.metadata;
        this.snackBar.open(
          this.translate.instant('map.resyncSuccess') || 'Couche resynchronisée avec succès',
          'OK',
          { duration: 3000 }
        );
      },
      error: (err) => {
        this.resyncingIds.delete(layer.layer.id);
        const message = err?.error?.error?.message || this.translate.instant('shared.error') || 'Une erreur est survenue';
        this.snackBar.open(message, 'OK', { duration: 4000 });
      },
    });
  }

  shareLayer(activeLayer: ActiveLayer): void {
    const instance = this.instanceService.currentInstance$.value;
    const map = this.mapService.getMap();
    const mapCenter = map.getView().getCenter();
    // mapService.zoomTo() (utilisé côté carte partagée) attend des coordonnées
    // EPSG:4326 et applique fromLonLat() lui-même - stocker le centre déjà projeté
    // (EPSG:3857) produisait un second fromLonLat() en aval, donc un Y = NaN et
    // une vue invalide (carte totalement blanche sur le lien de partage).
    const center = mapCenter ? toLonLat(mapCenter) : mapCenter;
    const zoom = map.getView().getZoom();

    const layersState = this.mapLayerService.getActiveLayers().map(al => ({
      layerId: al.layer.id,
      opacity: al.opacity,
      visible: al.layer.id === activeLayer.layer.id ? true : al.visible
    }));

    const mapState = {
      center,
      zoom,
      layers: layersState
    };

    this.sharingService.createShare({
      instanceId: instance ? instance.id : '',
      mapState
    }).subscribe({
      next: (res) => {
        const shareUrl = `${globalThis.location.origin}/share/${res.shortCode}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
          this.snackBar.open(
            this.translate.instant('sharing.copied') || 'Lien copié dans le presse-papiers !',
            'OK',
            { duration: 3000 }
          );
        });
      },
      error: () => {
        this.snackBar.open('Erreur lors de la création du partage.', 'OK', { duration: 3000 });
      }
    });
  }
}

