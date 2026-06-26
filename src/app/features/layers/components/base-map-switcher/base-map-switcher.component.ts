import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';

import { BaseMapService } from '../../../../core/services/base-map.service';
import { InstanceService } from '../../../../core/services/instance.service';
import { MapService } from '../../../map/services/map.service';
import { BaseMap } from '../../../../core/models/index';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { TranslateModule } from '@ngx-translate/core';

interface BaseMapOption {
  id: string;
  name: string;
  thumbnail: string | null;
  baseMap: BaseMap | null;
}

@Component({
  selector: 'app-base-map-switcher',
  standalone: true,
  imports: [TranslateModule, 
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatRadioModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './base-map-switcher.component.html',
  styleUrl: './base-map-switcher.component.scss',
})
export class BaseMapSwitcherComponent implements OnInit, OnDestroy {
  private readonly baseMapService = inject(BaseMapService);
  private readonly instanceService = inject(InstanceService);
  private readonly mapService = inject(MapService);
  private readonly destroy$ = new Subject<void>();

  baseMaps: BaseMapOption[] = [];
  selectedBaseMapId = 'osm';
  loading = true;

  private readonly defaultBaseMaps: BaseMapOption[] = [
    { id: 'osm', name: 'OpenStreetMap', thumbnail: null, baseMap: null },
    { id: 'none', name: 'Aucun fond de carte', thumbnail: null, baseMap: null },
  ];

  ngOnInit(): void {
    this.instanceService.currentInstance$
      .pipe(takeUntil(this.destroy$))
      .subscribe(instance => {
        if (instance) {
          this.loadBaseMaps(instance.id);
        } else {
          this.baseMaps = [...this.defaultBaseMaps];
          this.loading = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadBaseMaps(instanceId: string): void {
    this.loading = true;
    this.baseMapService.list(instanceId).subscribe({
      next: (maps) => {
        this.baseMaps = [
          ...this.defaultBaseMaps,
          ...maps.sort((a, b) => a.order - b.order).map(bm => ({
            id: bm.id,
            name: bm.name,
            thumbnail: bm.thumbnail,
            baseMap: bm,
          })),
        ];

        const defaultMap = maps.find(m => m.isDefault);
        if (defaultMap) {
          this.selectedBaseMapId = defaultMap.id;
          this.applyBaseMap(defaultMap.id);
        }

        this.loading = false;
      },
      error: () => {
        this.baseMaps = [...this.defaultBaseMaps];
        this.loading = false;
      },
    });
  }

  applyBaseMap(id: string): void {
    this.selectedBaseMapId = id;

    if (id === 'none') {
      this.mapService.setBaseLayer(new TileLayer({ visible: false }));
      return;
    }

    if (id === 'osm') {
      this.mapService.setBaseLayer(new TileLayer({ source: new OSM() }));
      return;
    }

    const option = this.baseMaps.find(bm => bm.id === id);
    if (option?.baseMap) {
      const source = new XYZ({
        url: option.baseMap.url,
        attributions: option.baseMap.attribution,
      });
      this.mapService.setBaseLayer(new TileLayer({ source }));
    }
  }
}
