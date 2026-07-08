import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

import { BaseMapService } from '../../../../core/services/base-map.service';
import { InstanceService } from '../../../../core/services/instance.service';
import { MapService } from '../../../map/services/map.service';
import { BaseMap } from '../../../../core/models/index';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface BaseMapOption {
  id: string;
  name: string;
  thumbnail: string | null;
  baseMap: BaseMap | null;
}

@Component({
  selector: 'app-base-map-switcher',
  standalone: true,
  imports: [
    TranslateModule,
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
  private readonly translate = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  baseMaps: BaseMapOption[] = [];
  selectedBaseMapId = 'osm';
  loading = true;

  // Tuile représentative (Afrique centrale, zoom 4) utilisée pour générer un
  // aperçu cohérent par fond de carte à partir de sa propre source de tuiles.
  private static readonly THUMB_Z = 4;
  private static readonly THUMB_X = 8;
  private static readonly THUMB_Y = 7;

  private readonly defaultBaseMaps: BaseMapOption[] = [
    {
      id: 'osm',
      name: 'OpenStreetMap',
      thumbnail: `https://a.tile.openstreetmap.org/${BaseMapSwitcherComponent.THUMB_Z}/${BaseMapSwitcherComponent.THUMB_X}/${BaseMapSwitcherComponent.THUMB_Y}.png`,
      baseMap: null,
    },
    { id: 'none', name: 'Aucun fond de carte', thumbnail: null, baseMap: null },
  ];

  /** Construit une URL de vignette à partir de la propre source de tuiles du fond de carte. */
  private buildThumbnailUrl(bm: BaseMap): string | null {
    if (bm.thumbnail) return bm.thumbnail;

    const { THUMB_Z: z, THUMB_X: x, THUMB_Y: y } = BaseMapSwitcherComponent;
    const type = (bm.type || '').toString().toLowerCase();

    if (type === 'xyz' || type === 'mapbox') {
      return bm.url
        .replace('{z}', String(z))
        .replace('{x}', String(x))
        .replace('{y}', String(y))
        .replace('{a-c}', 'a')
        .replace('{r}', '');
    }

    if (type === 'wmts') {
      const cfg = bm.config || {};
      const layer = (cfg['layer'] as string) || '';
      const matrixSet = (cfg['matrixSet'] as string) || 'PM';
      const format = (cfg['format'] as string) || 'image/png';
      const style = (cfg['style'] as string) || 'normal';
      const params = new URLSearchParams({
        SERVICE: 'WMTS',
        REQUEST: 'GetTile',
        VERSION: '1.0.0',
        LAYER: layer,
        STYLE: style,
        TILEMATRIXSET: matrixSet,
        TILEMATRIX: String(z),
        TILEROW: String(y),
        TILECOL: String(x),
        FORMAT: format,
      });
      return `${bm.url}?${params.toString()}`;
    }

    return null;
  }

  ngOnInit(): void {
    this.instanceService.currentInstance$.pipe(takeUntil(this.destroy$)).subscribe((instance) => {
      if (instance) {
        this.loadBaseMaps(instance.id);
      } else {
        this.baseMaps = [...this.defaultBaseMaps];
        this.loading = false;
      }
    });

    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      const instance = this.instanceService.currentInstance$.value;
      if (instance) {
        this.loadBaseMaps(instance.id);
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
        const filtered = maps.filter(
          (m) => m.name.toLowerCase() !== 'openstreetmap' && !m.url?.includes('openstreetmap.org'),
        );
        this.baseMaps = [
          ...this.defaultBaseMaps,
          ...[...filtered]
            .sort((a, b) => a.order - b.order)
            .map((bm) => ({
              id: bm.id,
              name: bm.name,
              thumbnail: this.buildThumbnailUrl(bm),
              baseMap: bm,
            })),
        ];

        const defaultMap = maps.find((m) => m.isDefault);
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

  onThumbnailError(bm: BaseMapOption): void {
    bm.thumbnail = null;
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

    // Délègue à MapService.applyBaseMap() pour gérer correctement chaque type de fond
    // de carte (XYZ/Mapbox/WMS/WMTS) - reconstruire une source XYZ nue ici pour tous
    // les types (comme c'était fait avant) casse les fonds WMTS tel que "France Topo",
    // dont l'URL n'a pas de template {z}/{x}/{y} et nécessite les paramètres WMTS.
    const option = this.baseMaps.find((bm) => bm.id === id);
    if (option?.baseMap) {
      this.mapService.applyBaseMap(option.baseMap);
    }
  }
}
