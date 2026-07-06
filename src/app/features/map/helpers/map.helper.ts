import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Cluster from 'ol/source/Cluster';
import TileWMS from 'ol/source/TileWMS';
import XYZ from 'ol/source/XYZ';
import { Feature } from 'ol';
import { GeoJSON } from 'ol/format';
import { Style, Fill, Stroke, Circle as CircleStyle, Text, Icon } from 'ol/style';
import { FeatureLike } from 'ol/Feature';
import { transform } from 'ol/proj';
import { Geometry } from 'ol/geom';
import Map from 'ol/Map';
import { Extent } from 'ol/extent';

const geojsonFormat = new GeoJSON();

export function createWmsLayer(
  url: string,
  layerName: string,
  params?: Record<string, string>,
): TileLayer<TileWMS> {
  return new TileLayer({
    source: new TileWMS({
      url,
      params: {
        LAYERS: layerName,
        TILED: true,
        ...params,
      },
      serverType: 'geoserver',
    }),
    properties: { name: layerName },
  });
}

export function createXyzLayer(url: string): TileLayer<XYZ> {
  return new TileLayer({
    source: new XYZ({ url }),
  });
}

export function createVectorLayer(
  features: Feature[],
  style?: Style,
): VectorLayer<VectorSource> {
  return new VectorLayer({
    source: new VectorSource({ features }),
    style: style || createDefaultStyle('Point'),
  });
}

const DEFAULT_CLUSTER_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="12" fill="#00ada7" stroke="#ffffff" stroke-width="2.5"/></svg>'
  );

const ICON_SIZE = 30; // taille finale du marqueur/cluster en pixels ("pas trop gros")
const BADGE_HEIGHT = 16;

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const badgeStyleCache: Record<string, Style> = {};
const DEFAULT_BADGE_COLOR = '#00ada7';

/**
 * Petit badge arrondi (pas un cercle) avec le nombre de points regroupés,
 * positionné en haut à droite du marqueur. La couleur reprend celle de la
 * thématique de la couche (metadata.color) pour rester cohérente avec le
 * catalogue, plutôt qu'une couleur fixe qui ne veut rien dire pour l'usager.
 */
function createCountBadgeStyle(count: number, color: string = DEFAULT_BADGE_COLOR): Style {
  const cacheKey = `${color}::${count}`;
  const cached = badgeStyleCache[cacheKey];
  if (cached) return cached;

  const text = count > 99 ? '99+' : String(count);
  const scale = 2; // rendu net (retina-like)
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;
  measureCtx.font = 'bold 10px Roboto, Arial, sans-serif';
  const textWidth = measureCtx.measureText(text).width;
  const width = Math.max(BADGE_HEIGHT, textWidth + 10);

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = BADGE_HEIGHT * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.font = 'bold 10px Roboto, Arial, sans-serif';

  drawRoundRect(ctx, 0.75, 0.75, width - 1.5, BADGE_HEIGHT - 1.5, (BADGE_HEIGHT - 1.5) / 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, BADGE_HEIGHT / 2 + 0.5);

  const style = new Style({
    image: new Icon({
      img: canvas,
      scale: 1 / scale,
      // Décale le badge vers le coin supérieur droit du marqueur (Y positif = vers le haut en OL).
      displacement: [width / 2 + ICON_SIZE / 2 - 6, ICON_SIZE / 2 + 2],
    }),
  });
  badgeStyleCache[cacheKey] = style;
  return style;
}

const markerStyleCache: Record<string, Style> = {};

function createMarkerIconStyle(iconUrl: string): Style {
  const cached = markerStyleCache[iconUrl];
  if (cached) return cached;
  const style = new Style({
    image: new Icon({
      src: iconUrl,
      crossOrigin: 'anonymous',
      width: ICON_SIZE,
      height: ICON_SIZE,
    }),
  });
  markerStyleCache[iconUrl] = style;
  return style;
}

const clusterComboCache: Record<string, Style[]> = {};

/**
 * Crée une couche de clusters dont le style reprend la forme de l'icône de la
 * couche (pas un simple cercle coloré), avec un petit badge arrondi indiquant
 * le nombre de points regroupés quand le cluster contient plus d'un élément.
 */
export function createClusterLayer(
  source: VectorSource,
  layerIconUrl: string = DEFAULT_CLUSTER_ICON,
  distance = 40,
  style?: Style | ((feature: any) => Style | Style[]),
  badgeColor: string = DEFAULT_BADGE_COLOR,
): VectorLayer<Cluster> {
  const clusterSource = new Cluster({
    distance,
    source,
  });

  const defaultStyleFunction = (feature: FeatureLike): Style[] => {
    const size = (feature.get('features') as unknown[] | undefined)?.length ?? 1;
    const cacheKey = `${layerIconUrl}::${badgeColor}::${size}`;
    let combo = clusterComboCache[cacheKey];
    if (!combo) {
      const markerStyle = createMarkerIconStyle(layerIconUrl);
      combo = size > 1 ? [markerStyle, createCountBadgeStyle(size, badgeColor)] : [markerStyle];
      clusterComboCache[cacheKey] = combo;
    }
    return combo;
  };

  return new VectorLayer({
    source: clusterSource,
    style: style || defaultStyleFunction,
  });
}

export function geoJsonToFeatures(geojson: object): Feature<Geometry>[] {
  return geojsonFormat.readFeatures(geojson, {
    featureProjection: 'EPSG:3857',
    dataProjection: 'EPSG:4326',
  });
}

export function featuresToGeoJson(features: Feature<Geometry>[]): object {
  return JSON.parse(
    geojsonFormat.writeFeatures(features, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    }),
  );
}

export function transformCoords(
  coords: number[],
  fromProj: string,
  toProj: string,
): number[] {
  return transform(coords, fromProj, toProj);
}

export function createDefaultStyle(geometryType: string, color?: string): Style {
  const fillColor = color || '#035a8a';
  const strokeColor = color || '#023f5f';

  switch (geometryType) {
    case 'Point':
    case 'MultiPoint':
      return new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
      });

    case 'LineString':
    case 'MultiLineString':
      return new Style({
        stroke: new Stroke({
          color: strokeColor,
          width: 3,
        }),
      });

    case 'Polygon':
    case 'MultiPolygon':
      return new Style({
        fill: new Fill({ color: hexToRgba(fillColor, 0.3) }),
        stroke: new Stroke({
          color: strokeColor,
          width: 2,
        }),
      });

    default:
      return new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
      });
  }
}

export function createLabelStyle(text: string, color?: string): Style {
  return new Style({
    text: new Text({
      text,
      font: '14px Roboto',
      fill: new Fill({ color: color || '#333333' }),
      stroke: new Stroke({ color: '#ffffff', width: 3 }),
      offsetY: -15,
    }),
  });
}

export function formatArea(area: number): string {
  if (area > 1_000_000) {
    return `${(area / 1_000_000).toFixed(2)} km²`;
  }
  return `${area.toFixed(2)} m²`;
}

export function formatLength(length: number): string {
  if (length > 1000) {
    return `${(length / 1000).toFixed(2)} km`;
  }
  return `${length.toFixed(2)} m`;
}

export function fitExtent(
  map: Map,
  extent: Extent,
  options?: { padding?: number[]; duration?: number; maxZoom?: number },
): void {
  map.getView().fit(extent, {
    padding: options?.padding || [50, 50, 50, 50],
    duration: options?.duration || 500,
    maxZoom: options?.maxZoom || 18,
  });
}

function hexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
