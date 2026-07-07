import { Component, inject, signal, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
  'addr:street', 'addr:housenumber', 'addr:city', 'image', 'wikimedia_commons',
]);

// Les valeurs doivent correspondre à l'enum backend ExportFormat (majuscules),
// sinon la validation Zod côté API rejette la requête ("impossible de créer l'export").
const DOWNLOAD_FORMATS: { value: string; label: string }[] = [
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
  private readonly translate = inject(TranslateService);
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
  readonly imageUrl = signal<string | null>(null);
  readonly imageFailed = signal(false);
  readonly otherProperties = signal<{ key: string; value: string }[]>([]);
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

        // Liste blanche plutôt que liste noire : seules les couches enregistrées comme
        // couches actives du catalogue (MapLayerService.getActiveLayers()) sont éligibles au
        // clic "fiche descriptive". Le fond de carte porte de nombreuses autres couches
        // vectorielles purement décoratives/outils (dessin, mesure, commentaires, altimétrie,
        // marqueur de localisation, géolocalisation, résultat de recherche, surbrillance de
        // la fiche elle-même, masque d'emprise "instance-boundary"...) qui ne représentent pas
        // "un point d'une couche" au sens attendu par l'utilisateur. Énumérer chaque couche à
        // exclure par son nom serait une liste noire fragile, vite incomplète à chaque nouvel
        // outil ajouté - la liste blanche est correcte par construction et n'a jamais besoin
        // d'être mise à jour.
        const activeLayers = this.mapLayerService.getActiveLayers();
        const features = map.getFeaturesAtPixel(pixel, {
          layerFilter: (layer) => activeLayers.some((al) => al.olLayer === layer),
        });
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
          // Repli sur le nom de la couche (ex. "Hôpitaux") quand l'entité OSM n'a pas de nom -
          // même logique que le chemin WMS ci-dessous (queryWmsLayers) ; le mot littéral
          // "Feature" utilisé auparavant n'était ni traduit ni utile à l'utilisateur.
          const activeLayer = this.lastLayerId
            ? this.mapLayerService.getActiveLayers().find((al) => al.layer.id === this.lastLayerId)
            : undefined;
          const fallbackTitle = activeLayer?.layer.name || this.translate.instant('map.featureInfo.genericFeature');
          this.showProperties((targetFeature.get('name') as string) || fallbackTitle, props, event.coordinate);
          return;
        }

        // Check WMS layers - uniquement celles de type point (icônes/POI dont le nombre de
        // features dépasse VECTOR_MODE_FEATURE_CAP et qui retombent donc en rendu WMS au lieu
        // du cluster vectoriel client). Les couches polygones/lignes (limites administratives,
        // zones, parcs...) sont des fonds de contexte, pas des fiches cliquables : sans ce
        // filtre, n'importe quel clic À L'INTÉRIEUR de leur emprise (même loin de tout symbole
        // visible) ouvrait la fiche descriptive, car le serveur QGIS y trouve bien un polygone -
        // ce n'est simplement pas "un point d'une couche" au sens attendu par l'utilisateur.
        const wmsLayers = map.getLayers().getArray().filter((l): l is TileLayer<TileWMS> => {
          if (!(l instanceof TileLayer) || !(l.getSource() instanceof TileWMS) || !l.getVisible()) return false;
          const activeLayer = activeLayers.find((al) => al.olLayer === l);
          const geometryType = (activeLayer?.layer.geometryType || activeLayer?.layer.metadata?.geometryType || '').toLowerCase();
          return geometryType === 'point' || geometryType === 'multipoint';
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
          this.showProperties(layer.get('name') || this.translate.instant('map.featureInfo.genericFeature'), props, coordinate);
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
    this.imageUrl.set(this.resolveImageUrl(merged));
    this.imageFailed.set(false);

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

  /**
   * Certaines contributions OSM renseignent une vraie image (tag `image`, parfois une simple
   * page Wikimedia Commons via `wikimedia_commons`) - on ne l'affiche que si on peut en tirer une
   * URL d'image directe ; sinon on se tait plutôt que d'afficher un lien cassé ou une capture
   * d'écran Google Maps (valeurs `image=` non standard rencontrées dans les données réelles).
   */
  private resolveImageUrl(merged: Record<string, any>): string | null {
    const image = typeof merged['image'] === 'string' ? merged['image'].trim() : '';
    if (/^https?:\/\//i.test(image) || image.startsWith('data:image/')) {
      return image;
    }

    const commons = typeof merged['wikimedia_commons'] === 'string' ? merged['wikimedia_commons'].trim() : '';
    if (/^file:/i.test(commons)) {
      const filename = commons.slice(commons.indexOf(':') + 1);
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=480`;
    }

    return null;
  }

  onImageError(): void {
    this.imageFailed.set(true);
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
      this.snackBar.open(this.translate.instant('featureInfo.errors.noExportableData') || 'Aucune donnée exportable pour cet élément.', 'OK', { duration: 3000 });
      return;
    }
    this.downloading.set(true);
    this.exportService.create({ layerId: this.lastLayerId, format, featureId: this.lastFeatureId }).subscribe({
      next: (exp) => this.pollExportUntilReady(exp.id, format),
      error: (err) => {
        this.downloading.set(false);
        console.error('[FeatureInfo] Échec de la création de l\'export', err);
        this.snackBar.open(this.translate.instant('featureInfo.errors.createExportFailed') || 'Échec du téléchargement : impossible de créer l\'export.', 'OK', { duration: 4000 });
      },
    });
  }

  private pollExportUntilReady(exportId: string, format: string, attempt = 0): void {
    if (attempt > 30) {
      this.downloading.set(false);
      this.snackBar.open(this.translate.instant('featureInfo.errors.downloadExpired') || 'Le téléchargement a expiré, réessayez.', 'OK', { duration: 4000 });
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
              this.snackBar.open(this.translate.instant('featureInfo.errors.downloadFileFailed') || 'Échec du téléchargement du fichier.', 'OK', { duration: 4000 });
            },
          });
        } else if (status === 'FAILED') {
          this.downloading.set(false);
          console.error('[FeatureInfo] Export en échec côté serveur', exp);
          this.snackBar.open(this.translate.instant('featureInfo.errors.serverExportFailed') || 'L\'export a échoué côté serveur.', 'OK', { duration: 4000 });
        } else {
          setTimeout(() => this.pollExportUntilReady(exportId, format, attempt + 1), 1000);
        }
      },
      error: (err) => {
        this.downloading.set(false);
        console.error('[FeatureInfo] Échec de la vérification du statut de l\'export', err);
        this.snackBar.open(this.translate.instant('featureInfo.errors.downloadFailed') || 'Échec du téléchargement.', 'OK', { duration: 4000 });
      },
    });
  }

  close(): void {
    this.visible.set(false);
    this.overlay?.setPosition(undefined);
    this.lastLayerId = null;
    this.lastFeatureId = null;
    this.canDownload.set(false);
    this.imageUrl.set(null);
    this.imageFailed.set(false);
  }
}
