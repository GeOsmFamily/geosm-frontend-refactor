import { Injectable, NgZone, inject, signal } from '@angular/core';
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
import Point from 'ol/geom/Point';
import { Style, Icon } from 'ol/style';
import { Coordinate } from 'ol/coordinate';
import { Extent, getWidth } from 'ol/extent';
import BaseLayer from 'ol/layer/Base';
import { BaseMap } from '../../../core/models/index';

/** URL du fond de carte sombre (CartoDB Dark Matter) */
const DARK_BASEMAP_URL = 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

const ZOOM_MARKER_LAYER_NAME = 'zoom-target-marker';
const ZOOM_MARKER_SVG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"><path fill="#e53935" stroke="#ffffff" stroke-width="0.8" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  );

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

  /** Vrai tant qu'un repère de "point zoomé" (showZoomMarker/zoomToWithMarker) est affiché. */
  readonly hasZoomMarker = signal(false);

  initMap(target: string | HTMLElement, center: [number, number] = [0, 0], zoom = 2): Map {
    // `crossOrigin: 'anonymous'` sur TOUTES les sources de tuiles (ici et dans
    // applyBaseMap/switchBasemap/createWmtsSource/addWmsLayer/addXyzLayer) : sans ça, les
    // tuiles cross-origin (OSM, CartoDB, WMTS IGN...) se chargent en mode opaque - la carte
    // s'affiche normalement, mais le canvas interne d'OpenLayers devient "taint" dès qu'une
    // seule tuile cross-origin y est dessinée, et tout export (impression PDF via
    // dom-to-image-more) échoue avec "SecurityError: Tainted canvases may not be exported".
    this.baseLayer = new TileLayer({ source: new OSM({ crossOrigin: 'anonymous' }) });

    this.drawingLayer = new VectorLayer({
      source: this.drawingSource,
      properties: { name: 'drawing-layer' },
    });

    this.measureLayer = new VectorLayer({
      source: this.measureSource,
      properties: { name: 'measure-layer' },
    });

    const clusterSource = new Cluster({
      distance: 40,
      source: this.commentSource,
    });

    this.commentLayer = new VectorLayer({
      source: clusterSource,
      properties: { name: 'comment-layer' },
    });

    this.map = new Map({
      target,
      layers: [this.baseLayer, this.drawingLayer, this.measureLayer, this.commentLayer],
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
            crossOrigin: 'anonymous',
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
            crossOrigin: 'anonymous',
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
          source: new OSM({ crossOrigin: 'anonymous' }),
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
      crossOrigin: 'anonymous',
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
          crossOrigin: 'anonymous',
        })
      : new OSM({ crossOrigin: 'anonymous' });
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

  /**
   * Affiche un repère (pin) sur la carte au point donné - sans ça, une fois centré/zoomé sur
   * une coordonnée saisie manuellement (ZoomModal) ou reçue via un lien partagé (?lat=&lon=),
   * rien ne distingue visuellement ce point précis du reste de la carte.
   */
  showZoomMarker(coordinate: [number, number]): void {
    const feature = new Feature(new Point(fromLonLat(coordinate)));
    feature.setStyle(
      new Style({
        image: new Icon({ anchor: [0.5, 1], src: ZOOM_MARKER_SVG }),
      }),
    );

    const existingLayer = this.getLayerByName(ZOOM_MARKER_LAYER_NAME) as
      VectorLayer<VectorSource> | undefined;
    if (existingLayer) {
      const source = existingLayer.getSource();
      source?.clear();
      source?.addFeature(feature);
    } else {
      this.addVectorLayer(ZOOM_MARKER_LAYER_NAME, [feature]);
    }
    this.hasZoomMarker.set(true);
  }

  /** zoomTo() + showZoomMarker() en un appel, pour les points explicitement recherchés/saisis. */
  zoomToWithMarker(coordinate: [number, number], zoom = 16): void {
    this.zoomTo(coordinate, zoom);
    this.showZoomMarker(coordinate);
  }

  /** Retire le repère posé par showZoomMarker()/zoomToWithMarker(), une fois qu'on n'en a plus besoin. */
  clearZoomMarker(): void {
    const layer = this.getLayerByName(ZOOM_MARKER_LAYER_NAME) as
      VectorLayer<VectorSource> | undefined;
    layer?.getSource()?.clear();
    this.hasZoomMarker.set(false);
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
        crossOrigin: 'anonymous',
      }),
      properties: { name },
    });
    this.map.addLayer(layer);
    return layer;
  }

  addXyzLayer(name: string, url: string): TileLayer<XYZ> {
    const layer = new TileLayer({
      source: new XYZ({ url, crossOrigin: 'anonymous' }),
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
    return this.map
      .getLayers()
      .getArray()
      .find((layer) => layer.get('name') === name);
  }

  removeLayerByName(name: string): void {
    const layer = this.getLayerByName(name);
    if (layer) {
      this.map.removeLayer(layer);
    }
  }
}
