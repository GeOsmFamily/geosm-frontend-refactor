import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import Map from 'ol/Map.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { Fill, Stroke, Style, Circle as CircleStyle, Text } from 'ol/style.js';
import { MapBrowserEvent } from 'ol';
import { Coordinate } from 'ol/coordinate.js';

import { MapService } from '../../map/services/map.service.js';
import { RoutingService } from '../../../core/services/routing.service.js';
import { RouteResult } from '../../../core/models/index.js';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component.js';

type PickTarget = 'start' | 'end' | number;

@Component({
  selector: 'app-routing-tool',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDividerModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './routing-tool.component.html',
  styleUrl: './routing-tool.component.scss',
})
export class RoutingToolComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly routingService = inject(RoutingService);

  private map!: Map;
  private vectorSource = new VectorSource();
  private vectorLayer!: VectorLayer<VectorSource>;
  private pickTarget: PickTarget | null = null;
  private clickListener: ((evt: any) => void) | null = null;

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

  ngOnInit(): void {
    this.map = this.mapService.getMap();
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
  }

  pickOnMap(target: PickTarget): void {
    this.removeClickListener();
    this.pickTarget = target;

    this.clickListener = (evt: any) => {
      const lonLat = toLonLat(evt.coordinate) as [number, number];
      const label = `${lonLat[1].toFixed(5)}, ${lonLat[0].toFixed(5)}`;

      if (this.pickTarget === 'start') {
        this.startCoord = lonLat;
        this.startText = label;
      } else if (this.pickTarget === 'end') {
        this.endCoord = lonLat;
        this.endText = label;
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

  private displayRoute(result: RouteResult): void {
    this.vectorSource.getFeatures()
      .filter(f => f.get('pointType') === 'route')
      .forEach(f => this.vectorSource.removeFeature(f));

    const geojsonFormat = new GeoJSON();
    const routeFeatures = geojsonFormat.readFeatures(result.geometry, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    });
    const routeFeature = routeFeatures[0];
    routeFeature.set('pointType', 'route');
    this.vectorSource.addFeature(routeFeature);

    const extent = routeFeature.getGeometry()!.getExtent();
    this.map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
  }

  private updateMarkers(): void {
    this.vectorSource.getFeatures()
      .filter(f => f.get('pointType') !== 'route')
      .forEach(f => this.vectorSource.removeFeature(f));

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

    this.waypoints.forEach(wp => {
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
    this.waypoints = [];
    this.routeResult = null;
    this.removeClickListener();
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
