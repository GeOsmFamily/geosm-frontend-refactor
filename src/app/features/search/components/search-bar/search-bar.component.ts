import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { Subject, debounceTime, distinctUntilChanged, switchMap, forkJoin, of, takeUntil, catchError } from 'rxjs';

import { GeocodingService } from '../../../../core/services/geocoding.service';
import { SearchService, LayerSuggestion } from '../../../../core/services/search.service';
import { InstanceService } from '../../../../core/services/instance.service';
import { AnalyticsService } from '../../../../core/services/analytics.service';
import { LayerService } from '../../../../core/services/layer.service';
import { MapService } from '../../../map/services/map.service';
import { MapLayerService } from '../../../map/services/map-layer.service';
import { GeocodingResult } from '../../../../core/models/index';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import GeoJSON from 'ol/format/GeoJSON';
import { fromLonLat } from 'ol/proj';
import { Fill, Stroke, Style, Circle as CircleStyle, Text } from 'ol/style';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../../../environments/environment';

interface SearchResultItem {
  type: 'geocoding' | 'boundary' | 'layer';
  label: string;
  data: any;
}

// Historique des recherches - stocké côté navigateur uniquement (pas d'API dédiée côté
// backend pour l'instant, voir le plan de fonctionnalités). Une seule clé globale (pas de
// scope par utilisateur) : cohérent avec le reste de l'app qui n'a pas non plus de
// préférences utilisateur persistées serveur à ce jour.
const SEARCH_HISTORY_KEY = 'geosm_search_history';
const MAX_HISTORY_ITEMS = 8;

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [
    TranslateModule,
    CommonModule,
    FormsModule,
    MatAutocompleteModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatOptionModule,
    MatDividerModule,
    MatMenuModule,
  ],
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.scss',
})
export class SearchBarComponent implements OnInit, OnDestroy {
  private readonly geocodingService = inject(GeocodingService);
  private readonly searchService = inject(SearchService);
  private readonly instanceService = inject(InstanceService);
  private readonly mapService = inject(MapService);
  private readonly mapLayerService = inject(MapLayerService);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly layerService = inject(LayerService);
  private readonly destroy$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();

  private readonly markerSource = new VectorSource();
  private markerLayer!: VectorLayer<VectorSource>;

  searchQuery = '';
  results: SearchResultItem[] = [];
  geocodingResults: SearchResultItem[] = [];
  boundaryResults: SearchResultItem[] = [];
  layerResults: SearchResultItem[] = [];

  readonly activeBoundary = signal<SearchResultItem | null>(null);
  readonly downloadingBoundary = signal<boolean>(false);
  readonly history = signal<SearchResultItem[]>([]);
  readonly suggestions = signal<SearchResultItem[]>([]);

  ngOnInit(): void {
    this.history.set(this.loadHistory());
    // Abonnement réactif (et non lecture ponctuelle de .value) : au premier rendu de ce
    // composant (dans l'en-tête, monté avant que l'instance courante ait fini de se résoudre),
    // currentInstance$.value pouvait encore valoir null, ce qui faisait échouer silencieusement
    // le chargement des suggestions - jamais réessayé ensuite. Voir CatalogBrowserComponent qui
    // suit déjà ce pattern réactif.
    this.instanceService.currentInstance$
      .pipe(takeUntil(this.destroy$))
      .subscribe((instance) => {
        if (instance) this.loadSuggestions();
      });
    this.markerLayer = new VectorLayer({
      source: this.markerSource,
      style: (feature) => {
        const type = feature.get('featureType') as string;
        if (type === 'boundary') {
          return new Style({
            fill: new Fill({ color: 'rgba(0, 173, 167, 0.15)' }),
            stroke: new Stroke({ color: '#00ada7', width: 3 }),
            text: new Text({
              font: 'bold 12px "Avenir Next Rounded Pro", sans-serif',
              text: feature.get('name') as string,
              fill: new Fill({ color: '#023f5f' }),
              stroke: new Stroke({ color: '#ffffff', width: 3 }),
              placement: 'point',
              overflow: true,
            }),
          });
        }

        return new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: '#f44336' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }),
          text: new Text({
            font: 'bold 12px "Avenir Next Rounded Pro", sans-serif',
            text: feature.get('name') as string,
            fill: new Fill({ color: '#2d3748' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
            offsetY: 20,
            placement: 'point',
          }),
        });
      },
    });

    this.searchInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 2) {
          return of({ geocoding: [] as GeocodingResult[], layers: [] as any[] });
        }

        const country = this.getCountryCode();
        const searchOpts: Record<string, any> = { limit: 10 };
        if (country) {
          searchOpts['countrycodes'] = country;
        }

        return forkJoin({
          geocoding: this.geocodingService.search(query, searchOpts).pipe(catchError(() => of([]))),
          layers: this.searchService.searchLayers(query, undefined, 5).pipe(catchError(() => of([]))),
        });
      }),
      takeUntil(this.destroy$),
    ).subscribe(({ geocoding, layers }) => {
      const allGeocoding = (geocoding || []).map((g: any) => {
        const isBoundary =
          g.class === 'boundary' ||
          g.type === 'administrative' ||
          ['country', 'state', 'state_district', 'county', 'municipality', 'city', 'town', 'village', 'suburb', 'neighbourhood'].includes(g.type) ||
          (g.class === 'place' && ['state', 'country', 'city', 'county', 'municipality', 'district', 'suburb', 'town', 'village'].includes(g.type)) ||
          (g.geojson && (g.geojson.type === 'Polygon' || g.geojson.type === 'MultiPolygon'));

        return {
          type: (isBoundary ? 'boundary' : 'geocoding') as 'boundary' | 'geocoding',
          label: g.displayName || g.display_name,
          data: g,
        };
      });

      this.geocodingResults = allGeocoding.filter(item => item.type === 'geocoding');
      this.boundaryResults = allGeocoding.filter(item => item.type === 'boundary');

      const layerArr = Array.isArray(layers) ? layers : (layers as any)?.data || [];
      this.layerResults = layerArr.map((l: any) => ({
        type: 'layer' as const,
        label: l.name,
        data: l,
      }));

      this.results = [...this.geocodingResults, ...this.boundaryResults, ...this.layerResults];
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

  getCountryCode(): string | undefined {
    const instance = this.instanceService.currentInstance$.value;
    if (!instance) return undefined;
    const slug = instance.slug.toLowerCase();
    if (slug === 'cameroon' || slug === 'cameroun') return 'cm';
    if (slug === 'france') return 'fr';
    if (slug === 'senegal') return 'sn';
    if (slug === 'mali') return 'ml';
    if (slug.length === 2) return slug;
    return undefined;
  }

  selectResult(item: SearchResultItem): void {
    this.trackSearchSelection(item);
    this.markerSource.clear();

    if (item.type === 'boundary') {
      const geo = item.data;
      if (geo.geojson?.type === 'Polygon' || geo.geojson?.type === 'MultiPolygon') {
        const geojsonFormat = new GeoJSON();
        const geom = geojsonFormat.readGeometry(geo.geojson, {
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:4326',
        });
        const feature = new Feature(geom);
        feature.set('featureType', 'boundary');
        feature.set('name', item.label.split(',')[0]);
        this.markerSource.addFeature(feature);
        this.mapService.addLayer(this.markerLayer);

        const view = this.mapService.getMap().getView();
        view.fit(geom.getExtent(), { padding: [50, 50, 50, 50], duration: 500 });
        this.activeBoundary.set(item);
      } else if (geo.boundingbox && geo.boundingbox.length === 4) {
        // Fallback: draw the bounding box as a polygon
        const latMin = Number(geo.boundingbox[0]);
        const latMax = Number(geo.boundingbox[1]);
        const lonMin = Number(geo.boundingbox[2]);
        const lonMax = Number(geo.boundingbox[3]);
        
        const bboxPolygon = {
          type: 'Polygon',
          coordinates: [
            [
              [lonMin, latMin],
              [lonMax, latMin],
              [lonMax, latMax],
              [lonMin, latMax],
              [lonMin, latMin]
            ]
          ]
        };

        const geojsonFormat = new GeoJSON();
        const geom = geojsonFormat.readGeometry(bboxPolygon, {
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:4326',
        });
        const feature = new Feature(geom);
        feature.set('featureType', 'boundary');
        feature.set('name', item.label.split(',')[0]);
        this.markerSource.addFeature(feature);
        this.mapService.addLayer(this.markerLayer);

        const view = this.mapService.getMap().getView();
        view.fit(geom.getExtent(), { padding: [50, 50, 50, 50], duration: 500 });
        
        // Save the generated bbox polygon so that the download feature gets it
        geo.geojson = bboxPolygon;
        this.activeBoundary.set(item);
      }
    } else if (item.type === 'geocoding') {
      const geo = item.data;
      const geom = new Point(fromLonLat([Number(geo.lon), Number(geo.lat)]));
      const feature = new Feature(geom);
      feature.set('featureType', 'point');
      feature.set('name', item.label.split(',')[0]);
      this.markerSource.addFeature(feature);
      this.mapService.addLayer(this.markerLayer);
      this.mapService.zoomTo([Number(geo.lon), Number(geo.lat)], 16);
      this.activeBoundary.set(null);
    } else if (item.type === 'layer') {
      // item.data ne contient que {id, name, description} (résultat MeiliSearch ou suggestion
      // contextuelle, voir SearchService) - il manque sourceUrl/sourceLayer/geometryType etc.
      // nécessaires au rendu. Sans ce fetch, la couche s'ajoutait à la liste "actives" mais
      // rien ne s'affichait sur la carte (MapLayerService.addLayer() ne peut rien dessiner
      // à partir d'un objet incomplet).
      const instanceId = this.instanceService.currentInstance$.value?.id;
      if (instanceId) {
        this.layerService.getById(instanceId, item.data.id).subscribe({
          next: (layer) => {
            this.mapLayerService.addLayer(layer);
            this.mapLayerService.setVisibility(layer.id, true);
          },
        });
      }
      this.activeBoundary.set(null);
    }

    this.searchQuery = item.label;
    this.results = [];
    this.addToHistory(item);
  }

  private trackSearchSelection(item: SearchResultItem): void {
    const instanceId = this.instanceService.currentInstance$.value?.id;
    if (!instanceId) return;
    this.analyticsService.trackEvent({
      instanceId,
      eventType: 'search_performed',
      layerId: item.type === 'layer' ? item.data?.id : undefined,
      metadata: { resultType: item.type, query: this.searchQuery },
    }).subscribe({ error: () => {} });
  }

  private loadSuggestions(): void {
    const instance = this.instanceService.currentInstance$.value;
    if (!instance) return;
    this.searchService.getSuggestions(instance.id, 5).subscribe({
      next: (layers: LayerSuggestion[]) => {
        this.suggestions.set(layers.map((l) => ({ type: 'layer' as const, label: l.name, data: l })));
      },
      error: () => this.suggestions.set([]),
    });
  }

  private loadHistory(): SearchResultItem[] {
    try {
      const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private addToHistory(item: SearchResultItem): void {
    // On ne garde que les champs nécessaires pour rejouer la sélection (voir selectResult()),
    // pas la réponse brute complète (un résultat "boundary" Nominatim peut embarquer un
    // polygone GeoJSON volumineux) - évite de saturer le quota localStorage.
    const trimmed: SearchResultItem = {
      type: item.type,
      label: item.label,
      data: item.type === 'geocoding'
        ? { lat: item.data.lat, lon: item.data.lon }
        : item.type === 'boundary'
          ? { boundingbox: item.data.boundingbox, osm_id: item.data.osm_id, osm_type: item.data.osm_type }
          : item.data,
    };

    const withoutDuplicate = this.history().filter((h) => h.label !== item.label);
    const updated = [trimmed, ...withoutDuplicate].slice(0, MAX_HISTORY_ITEMS);
    this.history.set(updated);
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // Quota dépassé ou navigation privée : l'historique reste fonctionnel pour la session
      // en cours (signal en mémoire) mais ne persiste pas - non bloquant.
    }
  }

  removeHistoryItem(item: SearchResultItem, event: Event): void {
    event.stopPropagation();
    const updated = this.history().filter((h) => h.label !== item.label);
    this.history.set(updated);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  }

  clearHistory(event: Event): void {
    event.stopPropagation();
    this.history.set([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.results = [];
    this.geocodingResults = [];
    this.boundaryResults = [];
    this.layerResults = [];
    this.markerSource.clear();
    this.mapService.removeLayer(this.markerLayer);
    this.activeBoundary.set(null);
  }

  clearActiveBoundary(): void {
    this.activeBoundary.set(null);
    this.markerSource.clear();
    this.mapService.removeLayer(this.markerLayer);
  }

  downloadBoundary(boundary: SearchResultItem, format: 'geojson' | 'shapefile'): void {
    const geojson = boundary.data.geojson;
    if (!geojson) return;
    const name = boundary.label.split(',')[0];
    const safeName = name.toLowerCase().replace(/\s+/g, '_');
    this.downloadingBoundary.set(true);

    const featureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            name,
            displayName: boundary.label,
            osmId: boundary.data.osm_id,
            osmType: boundary.data.osm_type,
          },
          geometry: geojson,
        },
      ],
    };

    const apiUrl = `${environment.apiUrl}/geocode/export`;

    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        geojson: featureCollection,
        fileName: `${safeName}_limite`,
        format: format
      })
    })
    .then(response => {
      if (!response.ok) throw new Error('Export failed');
      return response.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = format === 'geojson' ? `${safeName}_limite.geojson` : `${safeName}_limite.zip`;
      link.click();
      URL.revokeObjectURL(url);
    })
    .catch(err => {
      console.error('Error exporting boundary:', err);
      // Fallback for GeoJSON in case of backend issues
      if (format === 'geojson') {
        const jsonStr = JSON.stringify(featureCollection, null, 2);
        const localBlob = new Blob([jsonStr], { type: 'application/json' });
        const localUrl = URL.createObjectURL(localBlob);
        const localLink = document.createElement('a');
        localLink.href = localUrl;
        localLink.download = `${safeName}_limite.geojson`;
        localLink.click();
        URL.revokeObjectURL(localUrl);
      }
    })
    .finally(() => {
      this.downloadingBoundary.set(false);
    });
  }

  displayFn(item: SearchResultItem | string): string {
    if (typeof item === 'string') return item;
    return item?.label || '';
  }
}
