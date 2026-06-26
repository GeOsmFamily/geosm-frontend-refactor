import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Cluster from 'ol/source/Cluster';
import TileWMS from 'ol/source/TileWMS';
import XYZ from 'ol/source/XYZ';
import { Feature } from 'ol';
import { GeoJSON } from 'ol/format';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import { transform } from 'ol/proj';
import { getArea, getLength } from 'ol/sphere';
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

export function createClusterLayer(
  source: VectorSource,
  distance: number = 40,
  style?: Style,
): VectorLayer<Cluster> {
  const clusterSource = new Cluster({
    distance,
    source,
  });

  return new VectorLayer({
    source: clusterSource,
    style: style || new Style({
      image: new CircleStyle({
        radius: 10,
        fill: new Fill({ color: '#035a8a' }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
      text: new Text({
        text: '',
        fill: new Fill({ color: '#ffffff' }),
        font: 'bold 12px Roboto',
      }),
    }),
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
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
