import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';

import { InstanceService } from '../../../../core/services/instance.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { MapLayerService } from '../../../map/services/map-layer.service';
import { Group, SubGroup, Layer } from '../../../../core/models/index';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { TruncatePipe } from '../../../../shared/pipes/truncate.pipe';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface CatalogGroup extends Group {
  subGroups: CatalogSubGroup[];
  layerCount: number;
}

interface CatalogSubGroup extends SubGroup {
  layers: Layer[];
}

@Component({
  selector: 'app-catalog-browser',
  standalone: true,
  imports: [TranslateModule, 
    CommonModule,
    FormsModule,
    MatExpansionModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatBadgeModule,
    MatTooltipModule,
    LoadingSpinnerComponent,
    TruncatePipe,
  ],
  templateUrl: './catalog-browser.component.html',
  styleUrl: './catalog-browser.component.scss',
})
export class CatalogBrowserComponent implements OnInit, OnDestroy {
  private readonly catalogService = inject(CatalogService);
  private readonly instanceService = inject(InstanceService);
  private readonly mapLayerService = inject(MapLayerService);
  private readonly translate = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  groups: CatalogGroup[] = [];
  filteredGroups: CatalogGroup[] = [];
  selectedGroup: CatalogGroup | null = null;
  searchQuery = '';
  loading = true;

  ngOnInit(): void {
    this.instanceService.currentInstance$
      .pipe(takeUntil(this.destroy$))
      .subscribe(instance => {
        if (instance) {
          this.loadCatalog(instance.slug);
        }
      });

    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const instance = this.instanceService.currentInstance$.value;
        if (instance) {
          this.loadCatalog(instance.slug);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private mapLayer(l: any, instanceId: string, subGroupId: string): Layer {
    return {
      ...l,
      bbox: l.bbox || null,
      tags: l.tags || [],
      instanceId,
      subGroupId
    };
  }

  private mapSubGroup(sg: any, instanceId: string): any {
    return {
      ...sg,
      layers: (sg.layers || []).map((l: any) => this.mapLayer(l, instanceId, sg.id))
    };
  }

  private mapGroup(group: any, instanceId: string): CatalogGroup {
    const subGroups = (group.subGroups || []).map((sg: any) => this.mapSubGroup(sg, instanceId));
    const layerCount = subGroups.reduce((acc: number, sg: any) => acc + sg.layers.length, 0);
    return {
      ...group,
      subGroups,
      layerCount
    };
  }

  private loadCatalog(slug: string): void {
    this.loading = true;
    this.catalogService.getCatalogByInstance(slug).subscribe({
      next: (instances: any[]) => {
        const instance = instances?.[0];
        if (instance?.groups) {
          this.groups = instance.groups.map((group: any) => this.mapGroup(group, instance.id));
          this.filteredGroups = this.groups;
          if (this.selectedGroup) {
            const found = this.groups.find(g => g.id === this.selectedGroup?.id);
            this.selectedGroup = found || null;
          }
        } else {
          this.groups = [];
          this.filteredGroups = [];
          this.selectedGroup = null;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load catalog', err);
        this.groups = [];
        this.filteredGroups = [];
        this.selectedGroup = null;
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      this.filteredGroups = this.groups;
      return;
    }

    this.filteredGroups = this.groups
      .map(group => {
        const filteredSubGroups = group.subGroups
          .map(sg => ({
            ...sg,
            layers: sg.layers.filter(l =>
              l.name.toLowerCase().includes(q) ||
              l.description?.toLowerCase().includes(q) ||
              l.tags?.some(t => t.toLowerCase().includes(q))
            ),
          }))
          .filter(sg => sg.layers.length > 0 || sg.name.toLowerCase().includes(q));

        return {
          ...group,
          subGroups: filteredSubGroups,
          layerCount: filteredSubGroups.reduce((acc, sg) => acc + sg.layers.length, 0),
        };
      })
      .filter(g => g.subGroups.length > 0 || g.name.toLowerCase().includes(q));
  }

  addLayerToMap(layer: Layer): void {
    this.mapLayerService.addLayer(layer);
  }

  toggleLayer(layer: Layer, event: MouseEvent): void {
    event.stopPropagation();
    if (this.isLayerActive(layer.id)) {
      this.mapLayerService.removeLayer(layer.id);
    } else {
      this.mapLayerService.addLayer(layer);
    }
  }

  getLayerIconUrl(layer: Layer): string | null {
    if (layer.metadata?.icon) {
      return layer.metadata.icon;
    }
    if (layer.sourceType?.toUpperCase() === 'WMS') {
      const baseUrl = layer.url;
      const layerName = layer.sourceLayer || layer.tableName;
      if (baseUrl && layerName) {
        return `${baseUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&LAYER=${layerName}&FORMAT=image/png`;
      }
    }
    return null;
  }

  isLayerActive(layerId: string): boolean {
    return this.mapLayerService.isLayerActive(layerId);
  }

  getGeometryIcon(sourceType: string): string {
    switch (sourceType?.toLowerCase()) {
      case 'point': return 'place';
      case 'line':
      case 'linestring': return 'timeline';
      case 'polygon': return 'pentagon';
      case 'raster': return 'grid_on';
      default: return 'layers';
    }
  }

  selectGroup(group: CatalogGroup): void {
    this.selectedGroup = group;
  }

  isUrl(icon: string | null | undefined): boolean {
    if (!icon) return false;
    return icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('/') || icon.includes('.');
  }

  getAlphaColor(hex: string, alpha: number): string {
    if (!hex) return 'rgba(2, 63, 95, 0.1)';
    // Check if color is hex
    if (hex.startsWith('#')) {
      const r = Number.parseInt(hex.slice(1, 3), 16);
      const g = Number.parseInt(hex.slice(3, 5), 16);
      const b = Number.parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return hex; // Fallback for named/variable colors
  }
}
