import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  OnDestroy,
  ViewChild,
  afterNextRender,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import type LineString from 'ol/geom/LineString';
import GeoJSON from 'ol/format/GeoJSON';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style';
import type { MapBrowserEvent } from 'ol';

import { concave, convex, points as turfPoints } from '@turf/turf';
import { MapService } from '../../map/services/map.service';
import { RoutingService, IsochronePoint } from '../../../core/services/routing.service';
import { ToolActionService } from '../../../core/services/tool-action.service';
import { GeoportailService } from '../../../core/services/geoportail.service';
import { RouteResult, ElevationPoint } from '../../../core/models/index';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { TranslateModule } from '@ngx-translate/core';
import {
  computeElevationStats,
  renderElevationChart,
  elevationSampleCount,
  ElevationProfileStats,
} from '../shared/elevation-chart.util';

type PickTarget = 'start' | 'end' | 'junction' | number;

interface MultimodalLegResult {
  profile: string;
  distance: number;
  duration: number;
}

@Component({
  selector: 'app-routing-tool',
  standalone: true,
  imports: [
    TranslateModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDividerModule,
    MatTooltipModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './routing-tool.component.html',
  styleUrl: './routing-tool.component.scss',
})
export class RoutingToolComponent implements OnInit, OnDestroy {
  /** Désactivé le 2026-08-07 à la demande utilisateur (repasser à true pour réactiver). */
  protected readonly isochroneEnabled = false;

  @ViewChild('elevationCanvas') elevationCanvas?: ElementRef<HTMLCanvasElement>;

  private readonly mapService = inject(MapService);
  private readonly routingService = inject(RoutingService);
  private readonly toolActionService = inject(ToolActionService);
  private readonly geoportailService = inject(GeoportailService);
  private readonly injector = inject(Injector);

  private map!: Map;
  private readonly vectorSource = new VectorSource();
  private vectorLayer!: VectorLayer<VectorSource>;
  private pickTarget: PickTarget | null = null;
  private clickListener: ((evt: MapBrowserEvent) => void) | null = null;
  private routeGeom3857: LineString | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private elevationChart: any = null;

  // --- Profil altimétrique de l'itinéraire (voir plan "Itinéraires : altimétrie, isochrones,
  // multimodal" du 2026-08-06) - réutilise drapeElevationProfile()/l'endpoint déjà exposés pour
  // le tracé libre de AltimetryToolComponent, la géométrie OSRM est déjà une LineString 4326
  // valide sans transformation supplémentaire nécessaire. ---
  elevationLoading = false;
  elevationStats: ElevationProfileStats | null = null;
  hasElevationProfile = false;

  startText = '';
  endText = '';
  startCoord: [number, number] | null = null;
  endCoord: [number, number] | null = null;
  waypoints: { text: string; coord: [number, number] | null }[] = [];
  profile = 'driving';
  loading = false;
  routeResult: RouteResult | null = null;

  readonly profiles = [
    { value: 'driving', label: 'Voiture', icon: 'directions_car' },
    { value: 'cycling', label: 'Vélo', icon: 'directions_bike' },
    { value: 'walking', label: 'À pied', icon: 'directions_walk' },
  ];

  // --- Isochrone (voir plan "Itinéraires : altimétrie, isochrones, multimodal" du
  // 2026-08-06) - utilise le point de départ déjà saisi comme origine, pas de nouvelle UI de
  // sélection de point. ---
  isochroneMinutes = 15;
  isochroneRunning = false;
  isochroneError: string | null = null;
  hasIsochrone = false;

  // --- Trajet multimodal (voir plan "Itinéraires : altimétrie, isochrones, multimodal" du
  // 2026-08-06) - enchaîne DEUX trajets mono-profil via un point de jonction choisi par
  // l'utilisateur (ex. marche jusqu'à une gare, puis train/voiture) plutôt qu'un unique appel
  // OSRM (qui ne sait router que sur un seul profil à la fois). ---
  multimodalMode = false;
  junctionText = '';
  junctionCoord: [number, number] | null = null;
  profileBeforeJunction = 'walking';
  profileAfterJunction = 'driving';
  multimodalLoading = false;
  multimodalError: string | null = null;
  multimodalLegs: MultimodalLegResult[] | null = null;

  ngOnInit(): void {
    this.map = this.mapService.getMap();

    // Load initial coordinates from RoutingService if set
    if (this.routingService.startCoord) {
      this.startCoord = this.routingService.startCoord;
      this.startText = `${this.startCoord[1].toFixed(5)}, ${this.startCoord[0].toFixed(5)}`;
    }
    if (this.routingService.endCoord) {
      this.endCoord = this.routingService.endCoord;
      this.endText = `${this.endCoord[1].toFixed(5)}, ${this.endCoord[0].toFixed(5)}`;
    }

    this.toolActionService.action$.subscribe((action) => {
      if (action.tool !== 'routing') return;
      const lonLat = action.data as [number, number];
      const label = `${lonLat[1].toFixed(5)}, ${lonLat[0].toFixed(5)}`;
      if (action.action === 'setStart') {
        this.startCoord = lonLat;
        this.startText = label;
        this.routingService.startCoord = lonLat;
      } else if (action.action === 'setEnd') {
        this.endCoord = lonLat;
        this.endText = label;
        this.routingService.endCoord = lonLat;
      }
      this.updateMarkers();
      if (this.startCoord && this.endCoord) {
        this.calculateRoute();
      }
    });

    if (this.startCoord || this.endCoord) {
      this.updateMarkers();
      if (this.startCoord && this.endCoord) {
        this.calculateRoute();
      }
    }

    this.vectorLayer = new VectorLayer({
      source: this.vectorSource,
      style: (feature) => {
        const type = feature.get('pointType') as string;
        if (type === 'start') {
          return new Style({
            image: new CircleStyle({
              radius: 8,
              fill: new Fill({ color: '#4CAF50' }),
              stroke: new Stroke({ color: '#fff', width: 2 }),
            }),
          });
        }
        if (type === 'end') {
          return new Style({
            image: new CircleStyle({
              radius: 8,
              fill: new Fill({ color: '#f44336' }),
              stroke: new Stroke({ color: '#fff', width: 2 }),
            }),
          });
        }
        if (type === 'waypoint') {
          return new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color: '#FF9800' }),
              stroke: new Stroke({ color: '#fff', width: 2 }),
            }),
          });
        }
        if (type === 'isochrone') {
          return new Style({
            fill: new Fill({ color: 'rgba(0, 173, 167, 0.2)' }),
            stroke: new Stroke({ color: '#00ada7', width: 2 }),
          });
        }
        if (type === 'junction') {
          return new Style({
            image: new CircleStyle({
              radius: 7,
              fill: new Fill({ color: '#9C27B0' }),
              stroke: new Stroke({ color: '#fff', width: 2 }),
            }),
          });
        }
        // Deux couleurs distinctes par segment - permet de visuellement distinguer les deux
        // profils d'un trajet multimodal (ex. marche en violet, voiture en bleu) sur la carte.
        if (type === 'route-leg1') {
          return new Style({ stroke: new Stroke({ color: '#9C27B0', width: 4 }) });
        }
        if (type === 'route-leg2') {
          return new Style({ stroke: new Stroke({ color: '#1976d2', width: 4 }) });
        }
        return new Style({
          stroke: new Stroke({ color: '#1976d2', width: 4 }),
        });
      },
    });
    this.map.addLayer(this.vectorLayer);
  }

  ngOnDestroy(): void {
    this.removeClickListener();
    if (this.vectorLayer) {
      this.map.removeLayer(this.vectorLayer);
    }
    this.elevationChart?.destroy();
  }

  pickOnMap(target: PickTarget): void {
    this.removeClickListener();
    this.pickTarget = target;
    this.mapService.isPicking = true;

    this.clickListener = (evt: MapBrowserEvent) => {
      const lonLat = toLonLat(evt.coordinate) as [number, number];
      const label = `${lonLat[1].toFixed(5)}, ${lonLat[0].toFixed(5)}`;

      if (this.pickTarget === 'start') {
        this.startCoord = lonLat;
        this.startText = label;
      } else if (this.pickTarget === 'end') {
        this.endCoord = lonLat;
        this.endText = label;
      } else if (this.pickTarget === 'junction') {
        this.junctionCoord = lonLat;
        this.junctionText = label;
      } else if (typeof this.pickTarget === 'number') {
        this.waypoints[this.pickTarget].coord = lonLat;
        this.waypoints[this.pickTarget].text = label;
      }

      this.updateMarkers();
      this.removeClickListener();
    };

    this.map.on('singleclick', this.clickListener);
  }

  private removeClickListener(): void {
    if (this.clickListener) {
      this.map.un('singleclick', this.clickListener);
      this.clickListener = null;
    }
    this.pickTarget = null;
    this.mapService.isPicking = false;
  }

  addWaypoint(): void {
    this.waypoints.push({ text: '', coord: null });
  }

  removeWaypoint(index: number): void {
    this.waypoints.splice(index, 1);
    this.updateMarkers();
  }

  calculateRoute(): void {
    if (!this.startCoord || !this.endCoord) return;

    const coords: [number, number][] = [this.startCoord];
    for (const wp of this.waypoints) {
      if (wp.coord) coords.push(wp.coord);
    }
    coords.push(this.endCoord);

    this.loading = true;
    this.routingService.getRoute(coords, this.profile).subscribe({
      next: (result) => {
        this.routeResult = result;
        this.displayRoute(result);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  toggleMultimodalMode(): void {
    this.multimodalMode = !this.multimodalMode;
    if (!this.multimodalMode) {
      this.junctionCoord = null;
      this.junctionText = '';
      this.multimodalLegs = null;
      this.multimodalError = null;
      this.updateMarkers();
    }
  }

  /** Enchaîne deux trajets mono-profil via le point de jonction (ex. marche jusqu'à une gare,
   * puis voiture) - OSRM ne route jamais sur plusieurs profils en un seul appel, chaque segment
   * est donc un appel `getRoute()` distinct, affiché avec sa propre couleur (voir style
   * 'route-leg1'/'route-leg2'). */
  calculateMultimodalRoute(): void {
    if (!this.startCoord || !this.junctionCoord || !this.endCoord || this.multimodalLoading) {
      return;
    }
    this.multimodalLoading = true;
    this.multimodalError = null;
    this.multimodalLegs = null;

    const leg1$ = this.routingService.getRoute(
      [this.startCoord, this.junctionCoord],
      this.profileBeforeJunction,
    );
    const leg2$ = this.routingService.getRoute(
      [this.junctionCoord, this.endCoord],
      this.profileAfterJunction,
    );

    forkJoin([leg1$, leg2$]).subscribe({
      next: ([leg1, leg2]) => {
        this.multimodalLoading = false;
        this.multimodalLegs = [
          { profile: this.profileBeforeJunction, distance: leg1.distance, duration: leg1.duration },
          { profile: this.profileAfterJunction, distance: leg2.distance, duration: leg2.duration },
        ];
        this.displayMultimodalRoute(leg1, leg2);
      },
      error: () => {
        this.multimodalLoading = false;
        this.multimodalError = "Impossible de calculer l'un des deux segments du trajet.";
      },
    });
  }

  private displayMultimodalRoute(leg1: RouteResult, leg2: RouteResult): void {
    this.vectorSource
      .getFeatures()
      .filter((f) => f.get('pointType') === 'route-leg1' || f.get('pointType') === 'route-leg2')
      .forEach((f) => this.vectorSource.removeFeature(f));

    const geojsonFormat = new GeoJSON();
    const readOpts = { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' } as const;

    const geom1 = geojsonFormat.readGeometry(leg1.geometry, readOpts);
    const feature1 = new Feature(geom1);
    feature1.set('pointType', 'route-leg1');
    this.vectorSource.addFeature(feature1);

    const geom2 = geojsonFormat.readGeometry(leg2.geometry, readOpts);
    const feature2 = new Feature(geom2);
    feature2.set('pointType', 'route-leg2');
    this.vectorSource.addFeature(feature2);

    const extent = geom1.getExtent().slice() as [number, number, number, number];
    const ext2 = geom2.getExtent();
    extent[0] = Math.min(extent[0], ext2[0]);
    extent[1] = Math.min(extent[1], ext2[1]);
    extent[2] = Math.max(extent[2], ext2[2]);
    extent[3] = Math.max(extent[3], ext2[3]);
    this.map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
  }

  private displayRoute(result: RouteResult): void {
    this.vectorSource
      .getFeatures()
      .filter((f) => f.get('pointType') === 'route')
      .forEach((f) => this.vectorSource.removeFeature(f));

    const geojsonFormat = new GeoJSON();
    const geom = geojsonFormat.readGeometry(result.geometry, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    });
    const routeFeature = new Feature(geom);
    routeFeature.set('pointType', 'route');
    this.vectorSource.addFeature(routeFeature);

    const extent = routeFeature.getGeometry()!.getExtent();
    this.map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });

    this.routeGeom3857 = geom as LineString;
    this.fetchElevationProfile(result.geometry);
  }

  /** Profil altimétrique de l'itinéraire calculé - `result.geometry` est déjà une LineString
   * GeoJSON EPSG:4326 (OSRM `geometries=geojson`), directement compatible avec
   * POST /geoportail/elevation-profile sans reprojection (contrairement à AltimetryToolComponent
   * qui doit convertir depuis une géométrie OL en EPSG:3857 tracée à main levée). */
  private fetchElevationProfile(geometry: GeoJSON.Geometry): void {
    this.elevationLoading = true;
    this.hasElevationProfile = false;
    this.elevationStats = null;

    const lengthMeters = this.routeGeom3857?.getLength() ?? 0;
    this.geoportailService
      .getElevationProfile(geometry, elevationSampleCount(lengthMeters))
      .subscribe({
        next: (result) => {
          this.elevationLoading = false;
          const points = result?.profile || [];
          if (points.length === 0) return;
          this.elevationStats = computeElevationStats(points);
          this.hasElevationProfile = true;
          afterNextRender(() => void this.renderElevationChart(points), {
            injector: this.injector,
          });
        },
        // Le profil altimétrique est un complément, pas une donnée critique du calcul
        // d'itinéraire - un échec ne doit jamais faire paraître l'itinéraire lui-même en échec.
        error: () => {
          this.elevationLoading = false;
        },
      });
  }

  private async renderElevationChart(points: ElevationPoint[]): Promise<void> {
    if (!this.elevationCanvas) return;
    this.elevationChart = await renderElevationChart(
      this.elevationCanvas.nativeElement,
      points,
      this.elevationChart,
    );
  }

  /** Calcule et affiche l'isochrone autour du point de départ - interroge
   * `/routing/isochrone` (nuage de points atteignables, durée routée réelle via OSRM table())
   * puis calcule l'enveloppe côté client avec @turf/turf (jamais calculée côté backend, voir
   * plan "Itinéraires : altimétrie, isochrones, multimodal" du 2026-08-06). */
  runIsochrone(): void {
    if (!this.startCoord || this.isochroneRunning) return;
    this.isochroneRunning = true;
    this.isochroneError = null;

    const [lon, lat] = this.startCoord;
    this.routingService.getIsochrone(lon, lat, this.profile, this.isochroneMinutes).subscribe({
      next: (points) => {
        this.isochroneRunning = false;
        if (points.length < 4) {
          this.isochroneError = 'Zone atteignable trop petite pour être représentée.';
          return;
        }
        this.renderIsochrone(points);
      },
      error: () => {
        this.isochroneRunning = false;
        this.isochroneError = "Impossible de calculer l'isochrone.";
      },
    });
  }

  private renderIsochrone(points: IsochronePoint[]): void {
    this.vectorSource
      .getFeatures()
      .filter((f) => f.get('pointType') === 'isochrone')
      .forEach((f) => this.vectorSource.removeFeature(f));

    const fc = turfPoints(points.map((p) => [p.lon, p.lat]));
    // concave() peut échouer à produire une enveloppe valide sur un nuage de points trop
    // clairsemé (ex. petite zone rurale peu couverte par le réseau routier connu d'OSRM) -
    // repli sur convex() (moins précis, "gonfle" les concavités réelles du réseau, mais
    // toujours calculable dès 3 points non alignés) plutôt que de ne rien afficher.
    const hull = concave(fc, { maxEdge: 5, units: 'kilometers' }) ?? convex(fc);
    if (!hull) {
      this.isochroneError = "Impossible de calculer l'isochrone.";
      return;
    }

    const geojsonFormat = new GeoJSON();
    const geom = geojsonFormat.readGeometry(hull.geometry, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    });
    const feature = new Feature(geom);
    feature.set('pointType', 'isochrone');
    this.vectorSource.addFeature(feature);
    this.hasIsochrone = true;

    this.map.getView().fit(geom.getExtent(), { padding: [50, 50, 50, 50], duration: 500 });
  }

  private updateMarkers(): void {
    // Une isochrone/un trajet multimodal déjà affiché correspond aux anciens points - dès que
    // les points changent (nouveau départ, étape ajoutée/retirée, jonction déplacée...), ils
    // deviennent obsolètes et sont retirés avec les marqueurs ; l'utilisateur doit relancer le
    // calcul explicitement.
    this.hasIsochrone = false;
    this.multimodalLegs = null;
    this.vectorSource
      .getFeatures()
      .filter((f) => f.get('pointType') !== 'route')
      .forEach((f) => this.vectorSource.removeFeature(f));

    if (this.startCoord) {
      const f = new Feature(new Point(fromLonLat(this.startCoord)));
      f.set('pointType', 'start');
      this.vectorSource.addFeature(f);
    }

    if (this.endCoord) {
      const f = new Feature(new Point(fromLonLat(this.endCoord)));
      f.set('pointType', 'end');
      this.vectorSource.addFeature(f);
    }

    if (this.multimodalMode && this.junctionCoord) {
      const f = new Feature(new Point(fromLonLat(this.junctionCoord)));
      f.set('pointType', 'junction');
      this.vectorSource.addFeature(f);
    }

    this.waypoints.forEach((wp) => {
      if (wp.coord) {
        const f = new Feature(new Point(fromLonLat(wp.coord)));
        f.set('pointType', 'waypoint');
        this.vectorSource.addFeature(f);
      }
    });
  }

  clearRoute(): void {
    this.vectorSource.clear();
    this.startText = '';
    this.endText = '';
    this.startCoord = null;
    this.endCoord = null;
    if (this.routingService) {
      this.routingService.startCoord = null;
      this.routingService.endCoord = null;
    }
    this.waypoints = [];
    this.routeResult = null;
    this.removeClickListener();

    this.routeGeom3857 = null;
    this.elevationStats = null;
    this.hasElevationProfile = false;
    this.hasIsochrone = false;
    this.isochroneError = null;
    this.isochroneRunning = false;
    this.elevationLoading = false;
    this.elevationChart?.destroy();
    this.elevationChart = null;

    this.multimodalMode = false;
    this.junctionCoord = null;
    this.junctionText = '';
    this.multimodalLegs = null;
    this.multimodalError = null;
    this.multimodalLoading = false;
  }

  profileLabel(profile: string): string {
    return this.profiles.find((p) => p.value === profile)?.label ?? profile;
  }

  formatDistance(meters: number): string {
    if (meters >= 1000) return (meters / 1000).toFixed(1) + ' km';
    return Math.round(meters) + ' m';
  }

  formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}min`;
    return `${m} min`;
  }
}
