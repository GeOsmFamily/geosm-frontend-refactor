import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

import { MapViewComponent } from '../map/components/map-view/map-view.component';
import { MapService } from '../map/services/map.service';
import { ApiService } from '../../core/services/api.service';
import { CatalogService } from '../../core/services/catalog.service';
import { InstanceService } from '../../core/services/instance.service';
import { MapLayerService } from '../map/services/map-layer.service';
import { ShareMap, Layer, Instance } from '../../core/models/index';

@Component({
  selector: 'app-shared-map',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatIconModule, MapViewComponent],
  templateUrl: './shared-map.component.html',
  styleUrl: './shared-map.component.scss',
})
export class SharedMapComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly apiService = inject(ApiService);
  private readonly mapService = inject(MapService);
  private readonly catalogService = inject(CatalogService);
  private readonly instanceService = inject(InstanceService);
  private readonly mapLayerService = inject(MapLayerService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly shareInfo = signal<ShareMap | null>(null);

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code');
    if (!code) {
      this.error.set('Invalid share link.');
      this.loading.set(false);
      return;
    }

    // Corrected backend endpoint to /share/:code
    this.apiService.get<ShareMap>(`/share/${code}`).subscribe({
      next: (share) => {
        this.shareInfo.set(share);
        this.loadInstanceAndApply(share);
      },
      error: () => {
        this.error.set('This shared map could not be found or has expired.');
        this.loading.set(false);
      },
    });
  }

  private loadInstanceAndApply(share: ShareMap): void {
    // Get instance slug from instanceId
    this.instanceService.getById(share.instanceId).subscribe({
      next: (instance: Instance) => {
        this.instanceService.setCurrentInstance(instance);
        // Load the catalog to resolve layers
        this.catalogService.getCatalogByInstance(instance.slug).subscribe({
          next: (instances: any[]) => {
            const catalogInstance = instances?.[0];
            const allLayers = this.extractLayers(catalogInstance?.groups || []);
            this.applyMapState(share, allLayers);
            this.loading.set(false);
          },
          error: () => {
            // Apply coordinates anyway even if catalog fails
            this.applyMapCoordinates(share);
            this.loading.set(false);
          }
        });
      },
      error: () => {
        this.applyMapCoordinates(share);
        this.loading.set(false);
      }
    });
  }

  private extractLayers(groups: any[]): Layer[] {
    const layers: Layer[] = [];
    if (!groups) return layers;
    for (const group of groups) {
      if (group.subGroups) {
        for (const sg of group.subGroups) {
          if (sg.layers) {
            for (const l of sg.layers) {
              layers.push({
                ...l,
                bbox: l.bbox || null,
                tags: l.tags || [],
                instanceId: group.instanceId || '',
                subGroupId: sg.id
              });
            }
          }
        }
      }
    }
    return layers;
  }

  private applyMapCoordinates(share: ShareMap): void {
    const state = share.mapState as Record<string, any>;
    if (state && state['center'] && state['zoom']) {
      const center = state['center'] as [number, number];
      const zoom = state['zoom'] as number;
      setTimeout(() => {
        this.mapService.zoomTo(center, zoom);
      }, 500);
    }
  }

  private applyMapState(share: ShareMap, catalogLayers: Layer[]): void {
    this.applyMapCoordinates(share);

    const state = share.mapState as Record<string, any>;
    if (state && Array.isArray(state['layers'])) {
      const layersState = state['layers'] as Array<{ layerId: string; opacity: number; visible: boolean }>;
      setTimeout(() => {
        for (const layerEntry of layersState) {
          const catalogLayer = catalogLayers.find(l => l.id === layerEntry.layerId);
          if (catalogLayer) {
            this.mapLayerService.addLayer(catalogLayer);
            this.mapLayerService.setOpacity(catalogLayer.id, layerEntry.opacity);
            this.mapLayerService.setVisibility(catalogLayer.id, layerEntry.visible);
          }
        }
      }, 600);
    }
  }
}
