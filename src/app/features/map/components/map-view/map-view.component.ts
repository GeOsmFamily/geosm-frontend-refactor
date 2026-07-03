import { Component, ElementRef, OnDestroy, ViewChild, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import ScaleLine from 'ol/control/ScaleLine';
import GeoJSON from 'ol/format/GeoJSON';
import { Polygon } from 'ol/geom';
import Feature from 'ol/Feature';
import { Style, Fill } from 'ol/style';

import { MapService } from '../../services/map.service';
import { InstanceService } from '../../../../core/services/instance.service';
import { BaseMapService } from '../../../../core/services/base-map.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { BaseMap, Instance } from '../../../../core/models/index';
import { environment } from '../../../../../environments/environment';
import { transformExtent } from 'ol/proj';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-view.component.html',
  styleUrl: './map-view.component.scss',
})
export class MapViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private readonly mapService = inject(MapService);
  private readonly instanceService = inject(InstanceService);
  private readonly baseMapService = inject(BaseMapService);
  private readonly themeService = inject(ThemeService);
  private readonly http = inject(HttpClient);
  private readonly destroy$ = new Subject<void>();
  private currentInstance: Instance | null = null;
  private mapMoveListener: any;

  readonly baseMaps = signal<BaseMap[]>([]);

  ngAfterViewInit(): void {
    const map = this.mapService.initMap(
      this.mapContainer.nativeElement,
      environment.mapDefaults.center,
      environment.mapDefaults.zoom,
    );

    const scaleLine = new ScaleLine({ units: 'metric' });
    map.addControl(scaleLine);

    // Apply current theme basemap immediately
    this.mapService.switchBasemap(this.themeService.isDark);

    // Subscribe to theme changes to switch basemap dynamically
    this.themeService.isDark$
      .pipe(takeUntil(this.destroy$))
      .subscribe((dark) => this.mapService.switchBasemap(dark));

    this.instanceService.currentInstance$
      .pipe(takeUntil(this.destroy$))
      .subscribe((instance) => {
        if (instance) {
          this.loadBaseMaps(instance.id);
          if (instance.slug === 'cameroon') {
            this.loadCameroonBoundary();
          } else {
            this.mapService.removeLayerByName('instance-boundary');
          }
          this.currentInstance = instance;
        }
      });

    this.mapMoveListener = () => {
      this.checkInstanceBoundary();
    };
    map.on('moveend', this.mapMoveListener);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    const map = this.mapService.getMap();
    if (map) {
      if (this.mapMoveListener) {
        map.un('moveend', this.mapMoveListener);
      }
      map.setTarget();
    }
  }

  private checkInstanceBoundary(): void {
    if (!this.currentInstance?.bbox || this.currentInstance?.bbox?.length !== 4) return;

    const map = this.mapService.getMap();
    const view = map.getView();
    const center = view.getCenter();
    if (!center) return;

    // Transform instance bbox from EPSG:4326 to EPSG:3857
    const instanceExtent = transformExtent(
      this.currentInstance.bbox,
      'EPSG:4326',
      'EPSG:3857'
    );

    // Recentrer uniquement quand le CENTRE de la vue s'éloigne significativement de
    // l'emprise de l'instance (avec une marge de tolérance) - pas quand une simple
    // proportion de surface visible est faible. Un ratio de surface (aire visible /
    // aire de l'instance) casse dès qu'on zoome fort sur un point ou un cluster à
    // l'intérieur de l'instance : la vue est alors minuscule par rapport à l'emprise
    // totale, ce qui déclenchait un dézoom immédiat et intempestif après chaque zoom
    // sur un cluster.
    const width = instanceExtent[2] - instanceExtent[0];
    const height = instanceExtent[3] - instanceExtent[1];
    const marginX = width * 0.5;
    const marginY = height * 0.5;
    const bufferedExtent = [
      instanceExtent[0] - marginX,
      instanceExtent[1] - marginY,
      instanceExtent[2] + marginX,
      instanceExtent[3] + marginY,
    ];
    const centerInBounds =
      center[0] >= bufferedExtent[0] && center[0] <= bufferedExtent[2] &&
      center[1] >= bufferedExtent[1] && center[1] <= bufferedExtent[3];

    if (!centerInBounds) {
      view.fit(instanceExtent, { duration: 800, padding: [50, 50, 50, 50] });
    }
  }

  private loadBaseMaps(instanceId: string): void {
    this.baseMapService.list(instanceId).subscribe({
      next: (basemaps) => {
        this.baseMaps.set(basemaps);
        const defaultMap = basemaps.find((bm) => bm.isDefault);
        if (defaultMap) {
          this.mapService.applyBaseMap(defaultMap);
        }
      },
      error: () => {
        // Keep the default OSM layer if API fails
      },
    });
  }

  private loadCameroonBoundary(): void {
    this.http.get('assets/cameroon-boundary.json').subscribe({
      next: (geojson: any) => {
        this.mapService.removeLayerByName('instance-boundary');

        const format = new GeoJSON();
        const features = format.readFeatures(geojson, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });

        if (features.length === 0) return;

        const geom = features[0].getGeometry();
        if (!geom) return;

        // Inverted polygon for masking (dimming area outside Cameroon)
        const worldCoords = [
          [-20037508.34, -20037508.34],
          [20037508.34, -20037508.34],
          [20037508.34, 20037508.34],
          [-20037508.34, 20037508.34],
          [-20037508.34, -20037508.34]
        ];

        let invertedGeom: Polygon | null = null;
        const geomType = geom.getType();

        if (geomType === 'Polygon') {
          const polyGeom = geom as Polygon;
          const rings = [worldCoords, ...polyGeom.getCoordinates()];
          invertedGeom = new Polygon(rings);
        } else if (geomType === 'MultiPolygon') {
          const multiPolyGeom = geom as any;
          const rings = [worldCoords];
          multiPolyGeom.getPolygons().forEach((poly: any) => {
            rings.push(poly.getLinearRing(0).getCoordinates());
          });
          invertedGeom = new Polygon(rings);
        }

        if (!invertedGeom) return;

        const maskFeature = new Feature(invertedGeom);

        const maskStyle = new Style({

          fill: new Fill({
            color: 'rgba(2, 27, 50, 0.45)', // Premium dimming mask overlay
          }),
        });

        maskFeature.setStyle(maskStyle);

        this.mapService.addVectorLayer('instance-boundary', [maskFeature]);
      },
      error: (err) => console.error('Failed to load Cameroon boundary:', err)

    });
  }

}
