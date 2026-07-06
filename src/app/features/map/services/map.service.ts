import { Injectable, NgZone, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat, toLonLat, get as getProjection } from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import Overlay from 'ol/Overlay';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';
import WMTS from 'ol/source/WMTS';
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Cluster from 'ol/source/Cluster';
import { Feature } from 'ol';
import { Style } from 'ol/style';
import { Coordinate } from 'ol/coordinate';
import { Extent, getWidth } from 'ol/extent';
import BaseLayer from 'ol/layer/Base';
import { BaseMap } from '../../../core/models/index';

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

  /**
   * Vrai pendant qu'un outil (itinéraire, plan de localisation...) attend un clic sur la
   * carte pour choisir un point. Consulté par FeatureInfoComponent pour ne pas ouvrir la
   * fiche descriptive par-dessus l'outil actif - sans ce garde-fou, le popup "Feature"
   * apparaît sur chaque clic de sélection de point et se retrouve même capturé dans les
   * PDF générés (plan de localisation).
   */
  isPicking = false;
  readonly mapReady$ = new BehaviorSubject<boolean>(false);

  initMap(target: string | HTMLElement, center: [number, number] = [0, 0], zoom = 2): Map {
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
   * Construit et applique le fond de carte correspondant à un BaseMap donné, quel que
   * soit son type (XYZ/Mapbox/WMS/WMTS). Point d'entrée UNIQUE à utiliser par tous les
   * sélecteurs de fond de carte de l'app - avoir deux implémentations séparées (une par
   * composant) a précédemment causé un bug où le sélecteur de la barre d'outils ignorait
   * le cas WMTS et traitait "France Topo" comme une simple URL XYZ (donc sans les
   * paramètres de requête WMTS), cassant le fond de carte.
   */
  applyBaseMap(baseMap: BaseMap): void {
    let layer: TileLayer<any>;

    // Le backend renvoie le type d'enum Prisma en majuscules (XYZ/WMS/WMTS/MAPBOX) ;
    // on normalise ici pour ne pas dépendre de la casse exacte.
    const type = (baseMap.type || '').toString().toLowerCase();

    switch (type) {
      case 'xyz':
      case 'mapbox':
        layer = new TileLayer({
          source: new XYZ({
            url: baseMap.url,
            attributions: baseMap.attribution,
          }),
          properties: { name: baseMap.name },
        });
        break;
      case 'wms':
        layer = new TileLayer({
          source: new TileWMS({
            url: baseMap.url,
            params: { LAYERS: (baseMap.config?.['layers'] as string) || '', TILED: true },
            attributions: baseMap.attribution,
          }),
          properties: { name: baseMap.name },
        });
        break;
      case 'wmts':
        layer = new TileLayer({
          source: this.createWmtsSource(baseMap),
          properties: { name: baseMap.name },
        });
        break;
      default:
        layer = new TileLayer({
          source: new OSM(),
          properties: { name: 'OpenStreetMap' },
        });
        break;
    }

    this.setBaseLayer(layer);
  }

  /**
   * Construit une source WMTS générique à partir de la config stockée en base (utilisé
   * notamment pour le fond "France Topo" de l'IGN, dont la grille de tuiles Web Mercator
   * "PM_0_19" n'est pas adressable en XYZ naïf).
   */
  private createWmtsSource(baseMap: BaseMap): WMTS {
    const projection = getProjection('EPSG:3857')!;
    const tileSizePixels = 256;
    const maxResolution = getWidth(projection.getExtent()) / tileSizePixels;
    const matrixLevels = 20;

    const resolutions: number[] = [];
    const matrixIds: string[] = [];
    for (let i = 0; i < matrixLevels; i++) {
      matrixIds[i] = i.toString();
      resolutions[i] = maxResolution / Math.pow(2, i);
    }

    const tileGrid = new WMTSTileGrid({
      origin: [-20037508, 20037508],
      resolutions,
      matrixIds,
    });

    const cfg = baseMap.config || {};
    return new WMTS({
      url: baseMap.url,
      layer: (cfg['layer'] as string) || baseMap.slug,
      matrixSet: (cfg['matrixSet'] as string) || 'PM',
      format: (cfg['format'] as string) || 'image/png',
      style: (cfg['style'] as string) || 'normal',
      projection,
      tileGrid,
      attributions: baseMap.attribution,
    });
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

  zoomTo(coordinate: [number, number], zoom = 16): void {
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

  addLayer(layer: BaseLayer): void {
    this.map.addLayer(layer);
  }

  removeLayer(layer: BaseLayer): void {
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
