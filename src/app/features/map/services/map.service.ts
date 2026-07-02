import { Injectable, NgZone, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat, toLonLat } from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import Overlay from 'ol/Overlay';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Cluster from 'ol/source/Cluster';
import { Feature } from 'ol';
import { Style } from 'ol/style';
import { Coordinate } from 'ol/coordinate';
import { Extent } from 'ol/extent';
import BaseLayer from 'ol/layer/Base';

/** URL du fond de carte sombre (CartoDB Dark Matter) */
const DARK_BASEMAP_URL = 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

@Injectable({ providedIn: 'root' })
export class MapService {
  private readonly zone = inject(NgZone);

  private map!: Map;
  private baseLayer!: TileLayer<any>;

  readonly drawingSource = new VectorSource();
  readonly measureSource = new VectorSource();
  readonly commentSource = new VectorSource();
  readonly measureOverlays: Overlay[] = [];
  readonly measurements: any[] = [];

  drawingLayer!: VectorLayer<VectorSource>;
  measureLayer!: VectorLayer<VectorSource>;
  commentLayer!: VectorLayer<any>;

  private readonly clickSubject = new Subject<any>();
  readonly onClick$: Observable<any> = this.clickSubject.asObservable();
  readonly mousePosition$ = new BehaviorSubject<[number, number]>([0, 0]);
  readonly mapReady$ = new BehaviorSubject<boolean>(false);

  initMap(target: string | HTMLElement, center: [number, number] = [0, 0], zoom: number = 2): Map {
    this.baseLayer = new TileLayer({ source: new OSM() });

    this.drawingLayer = new VectorLayer({
      source: this.drawingSource,
      properties: { name: 'drawing-layer' }
    });

    this.measureLayer = new VectorLayer({
      source: this.measureSource,
      properties: { name: 'measure-layer' }
    });

    const clusterSource = new Cluster({
      distance: 40,
      source: this.commentSource,
    });

    this.commentLayer = new VectorLayer({
      source: clusterSource,
      properties: { name: 'comment-layer' }
    });

    this.map = new Map({
      target,
      layers: [
        this.baseLayer,
        this.drawingLayer,
        this.measureLayer,
        this.commentLayer
      ],
      view: new View({
        center: fromLonLat(center),
        zoom,
      }),
    });

    this.map.on('click', (event) => {
      this.zone.run(() => this.clickSubject.next(event));
    });

    this.map.on('pointermove', (event) => {
      const coords = toLonLat(event.coordinate);
      this.mousePosition$.next([coords[0], coords[1]]);
    });

    this.mapReady$.next(true);
    return this.map;
  }

  getMap(): Map {
    return this.map;
  }

  getView(): View {
    return this.map.getView();
  }

  setBaseLayer(layer: TileLayer<any>): void {
    this.map.removeLayer(this.baseLayer);
    this.baseLayer = layer;
    this.map.getLayers().insertAt(0, this.baseLayer);
  }

  /**
   * Bascule le fond de carte entre le thème clair (OSM standard)
   * et le thème sombre (CartoDB Dark Matter).
   */
  switchBasemap(dark: boolean): void {
    if (!this.map) return;
    const source = dark
      ? new XYZ({
          url: DARK_BASEMAP_URL,
          attributions: '&copy; <a href="https://carto.com/">CartoDB</a>',
        })
      : new OSM();
    this.baseLayer.setSource(source);
  }

  getBaseLayer(): TileLayer<any> {
    return this.baseLayer;
  }

  zoomTo(coordinate: [number, number], zoom: number = 16): void {
    if (!this.map) return;
    this.map.getView().animate({
      center: fromLonLat(coordinate),
      zoom,
      duration: 500,
    });
  }

  fitExtent(extent: Extent, padding: number[] = [50, 50, 50, 50]): void {
    if (!this.map) return;
    this.map.getView().fit(extent, { padding, duration: 500 });
  }

  addLayer(layer: VectorLayer<VectorSource> | TileLayer<any>): void {
    this.map.addLayer(layer);
  }

  removeLayer(layer: VectorLayer<VectorSource> | TileLayer<any>): void {
    this.map.removeLayer(layer);
  }

  addVectorLayer(name: string, features?: Feature[], style?: Style): VectorLayer<VectorSource> {
    const source = new VectorSource({ features: features || [] });
    const vectorLayer = new VectorLayer({
      source,
      style: style || undefined,
      properties: { name },
    });
    this.map.addLayer(vectorLayer);
    return vectorLayer;
  }

  addWmsLayer(name: string, url: string, params: Record<string, string>): TileLayer<TileWMS> {
    const layer = new TileLayer({
      source: new TileWMS({
        url,
        params: { ...params, TILED: true },
        serverType: 'geoserver',
      }),
      properties: { name },
    });
    this.map.addLayer(layer);
    return layer;
  }

  addXyzLayer(name: string, url: string): TileLayer<XYZ> {
    const layer = new TileLayer({
      source: new XYZ({ url }),
      properties: { name },
    });
    this.map.addLayer(layer);
    return layer;
  }

  getCenter(): Coordinate {
    return toLonLat(this.map.getView().getCenter()!);
  }

  setCenter(coords: [number, number]): void {
    if (!this.map) return;
    this.map.getView().animate({
      center: fromLonLat(coords),
      duration: 500,
    });
  }

  getZoom(): number {
    return this.map.getView().getZoom()!;
  }

  setZoom(level: number): void {
    if (!this.map) return;
    this.map.getView().animate({ zoom: level, duration: 300 });
  }

  getLayerByName(name: string): BaseLayer | undefined {
    return this.map.getLayers().getArray().find((layer) => layer.get('name') === name);
  }

  removeLayerByName(name: string): void {
    const layer = this.getLayerByName(name);
    if (layer) {
      this.map.removeLayer(layer);
    }
  }
}
