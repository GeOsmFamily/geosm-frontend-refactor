import { Component, inject, signal, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import Overlay from 'ol/Overlay';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import Feature from 'ol/Feature';
import { createEmpty, extend as extendExtent } from 'ol/extent';
import { toLonLat } from 'ol/proj';

import { MapService } from '../../services/map.service';
import { MapLayerService } from '../../services/map-layer.service';
import { ToolActionService } from '../../../../core/services/tool-action.service';
import { ExportService } from '../../../../core/services/export.service';
import { getExportFileExtension } from '../../../../core/utils/export-format.util';

const KNOWN_KEYS = new Set([
  'id', 'geometry', 'tags', 'layerId', 'name', 'name:fr',
  'opening_hours', 'phone', 'contact:phone', 'website', 'contact:website',
  'addr:street', 'addr:housenumber', 'addr:city',
]);

// Les valeurs doivent correspondre à l'enum backend ExportFormat (majuscules),
// sinon la validation Zod côté API rejette la requête ("impossible de créer l'export").
const DOWNLOAD_FORMATS: Array<{ value: string; label: string }> = [
  { value: 'GEOJSON', label: 'GeoJSON' },
  { value: 'KML', label: 'KML' },
  { value: 'GEOPACKAGE', label: 'GeoPackage' },
  { value: 'SHAPEFILE', label: 'Shapefile' },
];

@Component({
  selector: 'app-feature-info',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatMenuModule, MatProgressSpinnerModule, MatSnackBarModule, TranslateModule],
  templateUrl: './feature-info.component.html',
  styleUrl: './feature-info.component.scss',
})
export class FeatureInfoComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly mapLayerService = inject(MapLayerService);
  private readonly toolAction = inject(ToolActionService);
  private readonly exportService = inject(ExportService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly http = inject(HttpClient);
  private readonly elementRef = inject(ElementRef);

  readonly visible = signal(false);
  readonly loading = signal(false);
  readonly title = signal('');
  readonly name = signal<string | null>(null);
  readonly openingHours = signal<string | null>(null);
  readonly phone = signal<string | null>(null);
  readonly website = signal<string | null>(null);
  readonly address = signal<string | null>(null);
  readonly otherProperties = signal<Array<{ key: string; value: string }>>([]);
  readonly showAllProperties = signal(false);
  readonly downloading = signal(false);
  readonly downloadFormats = DOWNLOAD_FORMATS;
  readonly canDownload = signal(false);

  private overlay!: Overlay;
  private readonly subscriptions = new Subscription();
  private lastCoordinate: number[] | null = null;
  private lastLayerId: string | null = null;
  private lastFeatureId: string | null = null;

  ngOnInit(): void {
    this.subscriptions.add(
      this.mapService.mapReady$.subscribe((ready) => {
        if (ready) {
          this.setupOverlay();
          this.setupClickHandler();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.overlay) {
      this.mapService.getMap()?.removeOverlay(this.overlay);
    }
  }

  private setupOverlay(): void {
    this.overlay = new Overlay({
      element: this.elementRef.nativeElement,
      autoPan: { animation: { duration: 250 } },
      positioning: 'bottom-center',
      offset: [0, -10],
    });

    this.mapService.getMap().addOverlay(this.overlay);
  }

  private setupClickHandler(): void {
    this.subscriptions.add(
      this.mapService.onClick$.subscribe((event) => {
        if (this.mapService.isPicking) return;

        const map = this.mapService.getMap();
        const pixel = event.pixel;

        // Check vector features first
        const features = map.getFeaturesAtPixel(pixel);
        if (features && features.length > 0) {
          const feature = features[0];

          // Cluster (OpenLayers ol/source/Cluster convention): the clicked feature
          // wraps the real features in a "features" property.
          const clustered = feature.get('features') as Feature[] | undefined;
          if (clustered && clustered.length > 1) {
            const extent = createEmpty();
            for (const f of clustered) {
              const geom = f.getGeometry();
              if (geom) extendExtent(extent, geom.getExtent());
            }
            this.mapService.fitExtent(extent, [80, 80, 80, 80]);
            return;
          }

          const targetFeature = clustered?.length === 1 ? clustered[0] : feature;
          const props = targetFeature.getProperties();
          delete props['geometry'];
          this.lastLayerId = (props['layerId'] as string) || null;
          this.lastFeatureId = props['id'] != null ? String(props['id']) : null;
          this.showProperties((targetFeature.get('name') as string) || 'Feature', props, event.coordinate);
          return;
        }

        // Check WMS layers
        const wmsLayers = map.getLayers().getArray().filter((l): l is TileLayer<TileWMS> => {
          return l instanceof TileLayer && l.getSource() instanceof TileWMS && l.getVisible();
        });

        if (wmsLayers.length > 0) {
          this.queryWmsLayers(wmsLayers, event.coordinate, map.getView().getResolution()!);
        } else {
          this.close();
        }
      })
    );
  }

  private queryWmsLayers(layers: TileLayer<TileWMS>[], coordinate: number[], resolution: number): void {
    this.loading.set(true);
    this.visible.set(true);
    this.overlay.setPosition(coordinate);

    const layer = layers.at(-1)!;
    const source = layer.getSource()!;
    const url = source.getFeatureInfoUrl(coordinate, resolution, 'EPSG:3857', {
      INFO_FORMAT: 'application/json',
      FI_POINT_TOLERANCE: 16,
      FI_LINE_TOLERANCE: 10,
      FI_POLYGON_TOLERANCE: 4,
    });

    if (!url) {
      this.loading.set(false);
      this.close();
      return;
    }

    // Retrouve l'identifiant de couche (backend) correspondant à cette couche WMS,
    // nécessaire pour les actions itinéraire/téléchargement.
    const activeLayer = this.mapLayerService.getActiveLayers().find((al) => al.olLayer === layer);
    this.lastLayerId = activeLayer?.layer.id || null;

    this.http.get<any>(url).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.features && response.features.length > 0) {
          const props = response.features[0].properties || {};
          this.lastFeatureId = props['osm_id'] != null ? String(props['osm_id']) : null;
          this.showProperties(layer.get('name') || 'WMS Layer', props, coordinate);
        } else {
          this.close();
        }
      },
      error: () => {
        this.loading.set(false);
        this.close();
      },
    });
  }

  private showProperties(title: string, props: Record<string, any>, coordinate: number[]): void {
    const tags = typeof props['tags'] === 'object' && props['tags'] !== null ? props['tags'] : {};
    const merged: Record<string, any> = { ...props, ...tags };
    const get = (key: string): string | null => {
      const v = merged[key];
      return v !== null && v !== undefined && v !== '' ? String(v) : null;
    };

    const name = get('name') || get('name:fr');
    const street = get('addr:street');
    const housenumber = get('addr:housenumber');
    const city = get('addr:city');
    const addressParts = [housenumber, street].filter(Boolean).join(' ');
    const address = [addressParts, city].filter(Boolean).join(', ') || null;

    this.title.set(name || title);
    this.name.set(name);
    this.openingHours.set(get('opening_hours'));
    this.phone.set(get('phone') || get('contact:phone'));
    this.website.set(get('website') || get('contact:website'));
    this.address.set(address);

    this.otherProperties.set(
      Object.entries(merged)
        .filter(([k, v]) => !KNOWN_KEYS.has(k) && v !== null && v !== undefined && v !== '')
        .map(([key, value]) => ({ key, value: String(value) }))
    );
    this.showAllProperties.set(false);
    this.canDownload.set(!!this.lastLayerId && !!this.lastFeatureId);

    this.lastCoordinate = coordinate;
    this.visible.set(true);
    this.overlay.setPosition(coordinate);
  }

  toggleAllProperties(): void {
    this.showAllProperties.update((v) => !v);
  }

  zoomToFeature(): void {
    if (!this.lastCoordinate) return;
    const lonLat = toLonLat(this.lastCoordinate);
    this.mapService.zoomTo(lonLat as [number, number], 18);
  }

  setAsRouteDestination(): void {
    if (!this.lastCoordinate) return;
    const [lon, lat] = toLonLat(this.lastCoordinate);
    this.toolAction.emit({ tool: 'routing', action: 'setEnd', data: [lon, lat] });
    this.close();
  }

  downloadFeature(format: string): void {
    if (!this.lastLayerId || !this.lastFeatureId) {
      this.snackBar.open('Aucune donnée exportable pour cet élément.', 'OK', { duration: 3000 });
      return;
    }
    this.downloading.set(true);
    this.exportService.create({ layerId: this.lastLayerId, format, featureId: this.lastFeatureId }).subscribe({
      next: (exp) => this.pollExportUntilReady(exp.id, format),
      error: (err) => {
        this.downloading.set(false);
        console.error('[FeatureInfo] Échec de la création de l\'export', err);
        this.snackBar.open('Échec du téléchargement : impossible de créer l\'export.', 'OK', { duration: 4000 });
      },
    });
  }

  private pollExportUntilReady(exportId: string, format: string, attempt = 0): void {
    if (attempt > 30) {
      this.downloading.set(false);
      this.snackBar.open('Le téléchargement a expiré, réessayez.', 'OK', { duration: 4000 });
      return;
    }
    this.exportService.getById(exportId).subscribe({
      next: (exp) => {
        const status = (exp.status || '').toUpperCase();
        if (status === 'COMPLETED') {
          this.exportService.download(exportId).subscribe({
            next: (blob) => {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `feature-${this.lastFeatureId}.${getExportFileExtension(format)}`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
              this.downloading.set(false);
            },
            error: (err) => {
              this.downloading.set(false);
              console.error('[FeatureInfo] Échec du téléchargement du fichier', err);
              this.snackBar.open('Échec du téléchargement du fichier.', 'OK', { duration: 4000 });
            },
          });
        } else if (status === 'FAILED') {
          this.downloading.set(false);
          console.error('[FeatureInfo] Export en échec côté serveur', exp);
          this.snackBar.open('L\'export a échoué côté serveur.', 'OK', { duration: 4000 });
        } else {
          setTimeout(() => this.pollExportUntilReady(exportId, format, attempt + 1), 1000);
        }
      },
      error: (err) => {
        this.downloading.set(false);
        console.error('[FeatureInfo] Échec de la vérification du statut de l\'export', err);
        this.snackBar.open('Échec du téléchargement.', 'OK', { duration: 4000 });
      },
    });
  }

  close(): void {
    this.visible.set(false);
    this.overlay?.setPosition(undefined);
    this.lastLayerId = null;
    this.lastFeatureId = null;
    this.canDownload.set(false);
  }
}
