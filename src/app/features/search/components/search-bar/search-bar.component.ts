import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { Subject, debounceTime, distinctUntilChanged, switchMap, forkJoin, of, takeUntil, catchError } from 'rxjs';

import { GeocodingService } from '../../../../core/services/geocoding.service.js';
import { SearchService } from '../../../../core/services/search.service.js';
import { MapService } from '../../../map/services/map.service.js';
import { MapLayerService } from '../../../map/services/map-layer.service.js';
import { GeocodingResult } from '../../../../core/models/index.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat } from 'ol/proj.js';
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style.js';
import { TranslateModule } from '@ngx-translate/core';

interface SearchResultItem {
  type: 'geocoding' | 'layer';
  label: string;
  data: any;
}

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [TranslateModule, 
    CommonModule,
    FormsModule,
    MatAutocompleteModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatOptionModule,
    MatDividerModule,
  ],
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.scss',
})
export class SearchBarComponent implements OnInit, OnDestroy {
  private readonly geocodingService = inject(GeocodingService);
  private readonly searchService = inject(SearchService);
  private readonly mapService = inject(MapService);
  private readonly mapLayerService = inject(MapLayerService);
  private readonly destroy$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();

  private markerSource = new VectorSource();
  private markerLayer!: VectorLayer<VectorSource>;

  searchQuery = '';
  results: SearchResultItem[] = [];
  geocodingResults: SearchResultItem[] = [];
  layerResults: SearchResultItem[] = [];

  ngOnInit(): void {
    this.markerLayer = new VectorLayer({
      source: this.markerSource,
      style: new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: '#f44336' }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
      }),
    });

    this.searchInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 2) {
          return of({ geocoding: [] as GeocodingResult[], layers: [] as any[] });
        }
        return forkJoin({
          geocoding: this.geocodingService.search(query, { limit: 5 }).pipe(catchError(() => of([]))),
          layers: this.searchService.searchLayers(query, undefined, 5).pipe(catchError(() => of([]))),
        });
      }),
      takeUntil(this.destroy$),
    ).subscribe(({ geocoding, layers }) => {
      this.geocodingResults = (geocoding || []).map((g: GeocodingResult) => ({
        type: 'geocoding' as const,
        label: g.displayName,
        data: g,
      }));

      const layerArr = Array.isArray(layers) ? layers : (layers as any)?.data || [];
      this.layerResults = layerArr.map((l: any) => ({
        type: 'layer' as const,
        label: l.name,
        data: l,
      }));

      this.results = [...this.geocodingResults, ...this.layerResults];
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.markerLayer) {
      this.mapService.removeLayer(this.markerLayer);
    }
  }

  onInput(): void {
    this.searchInput$.next(this.searchQuery);
  }

  selectResult(item: SearchResultItem): void {
    if (item.type === 'geocoding') {
      const geo = item.data as GeocodingResult;
      this.markerSource.clear();

      const marker = new Feature(new Point(fromLonLat([geo.lon, geo.lat])));
      this.markerSource.addFeature(marker);
      this.mapService.addLayer(this.markerLayer);
      this.mapService.zoomTo([geo.lon, geo.lat], 16);
    } else if (item.type === 'layer') {
      this.mapLayerService.addLayer(item.data);
    }

    this.searchQuery = item.label;
    this.results = [];
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.results = [];
    this.geocodingResults = [];
    this.layerResults = [];
    this.markerSource.clear();
  }

  displayFn(item: SearchResultItem | string): string {
    if (typeof item === 'string') return item;
    return item?.label || '';
  }
}
