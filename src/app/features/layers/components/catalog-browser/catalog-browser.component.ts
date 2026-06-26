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
import { Subject, forkJoin, takeUntil } from 'rxjs';

import { GroupService } from '../../../../core/services/group.service.js';
import { InstanceService } from '../../../../core/services/instance.service.js';
import { LayerService } from '../../../../core/services/layer.service.js';
import { MapLayerService } from '../../../map/services/map-layer.service.js';
import { Group, SubGroup, Layer } from '../../../../core/models/index.js';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component.js';
import { TruncatePipe } from '../../../../shared/pipes/truncate.pipe.js';

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
  imports: [
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
  private readonly groupService = inject(GroupService);
  private readonly instanceService = inject(InstanceService);
  private readonly layerService = inject(LayerService);
  private readonly mapLayerService = inject(MapLayerService);
  private readonly destroy$ = new Subject<void>();

  groups: CatalogGroup[] = [];
  filteredGroups: CatalogGroup[] = [];
  searchQuery = '';
  loading = true;

  ngOnInit(): void {
    this.instanceService.currentInstance$
      .pipe(takeUntil(this.destroy$))
      .subscribe(instance => {
        if (instance) {
          this.loadCatalog(instance.id);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCatalog(instanceId: string): void {
    this.loading = true;
    this.groupService.listGroups(instanceId).subscribe(groups => {
      const sorted = groups.sort((a, b) => a.order - b.order);
      const groupRequests = sorted.map(group =>
        this.groupService.listSubGroups(group.id)
      );

      if (groupRequests.length === 0) {
        this.groups = [];
        this.filteredGroups = [];
        this.loading = false;
        return;
      }

      forkJoin(groupRequests).subscribe(subGroupArrays => {
        const layerRequests: { groupIdx: number; subGroupIdx: number; subGroup: SubGroup }[] = [];
        const catalogGroups: CatalogGroup[] = sorted.map((group, gi) => ({
          ...group,
          subGroups: (subGroupArrays[gi] || []).sort((a, b) => a.order - b.order).map(sg => ({ ...sg, layers: [] as Layer[] })),
          layerCount: 0,
        }));

        catalogGroups.forEach((cg, gi) => {
          cg.subGroups.forEach((sg, si) => {
            layerRequests.push({ groupIdx: gi, subGroupIdx: si, subGroup: sg });
          });
        });

        if (layerRequests.length === 0) {
          this.groups = catalogGroups;
          this.filteredGroups = catalogGroups;
          this.loading = false;
          return;
        }

        const layerObservables = layerRequests.map(req =>
          this.layerService.list(instanceId, { subGroupId: req.subGroup.id, limit: 100 })
        );

        forkJoin(layerObservables).subscribe(layerResults => {
          layerResults.forEach((result, i) => {
            const req = layerRequests[i];
            catalogGroups[req.groupIdx].subGroups[req.subGroupIdx].layers = result.data;
            catalogGroups[req.groupIdx].layerCount += result.data.length;
          });
          this.groups = catalogGroups;
          this.filteredGroups = catalogGroups;
          this.loading = false;
        });
      });
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
}
