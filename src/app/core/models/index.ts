import type * as GeoJSON from 'geojson';

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN_INSTANCE = 'ADMIN_INSTANCE',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  role: Role;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface Instance {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo: string | null;
  bbox: [number, number, number, number] | null;
  centerLat: number;
  centerLon: number;
  defaultZoom: number;
  isActive: boolean;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  order: number;
  instanceId: string;
  icon?: string | null;
  color?: string | null;
}

export interface SubGroup {
  id: string;
  name: string;
  description: string;
  order: number;
  groupId: string;
}

export interface Layer {
  id: string;
  name: string;
  sourceType: string;
  url: string;
  sourceUrl?: string | null;
  tableName: string;
  description: string;
  bbox: [number, number, number, number] | null;
  tags: string[];
  instanceId: string;
  subGroupId: string;
  sourceLayer?: string | null;
  geometryType?: string | null;
  metadata?: {
    icon?: string | null;
    color?: string | null;
    geometryType?: string | null;
    featureCount?: number | null;
    totalArea?: number | null;
    totalLength?: number | null;
    importedAt?: string | null;
    lastSyncedAt?: string | null;
    [key: string]: any;
  } | null;
}

export interface Feature {
  id: string;
  geometry: GeoJSON.Geometry;
  properties: Record<string, unknown>;
  layerId: string;
}

export interface LayerStats {
  featureCount: number;
  totalArea: number | null;
  totalLength: number | null;
  bbox: [number, number, number, number] | null;
  narrative?: string;
}

export interface ViewportSummary {
  layerCount: number;
  totalFeatureCount: number;
  perLayer: { name: string; featureCount: number }[];
  narrative?: string;
}

export interface BaseMap {
  id: string;
  name: string;
  slug: string;
  type: 'xyz' | 'wms' | 'wmts' | 'mapbox';
  url: string;
  thumbnail: string | null;
  attribution: string;
  isDefault: boolean;
  order: number;
  config: Record<string, unknown> | null;
}

export interface Drawing {
  id: string;
  name: string;
  geojson: GeoJSON.GeoJSON;
  description: string;
  isPublic: boolean;
  instanceId: string;
  userId: string;
}

export interface ShareMap {
  id: string;
  shortCode: string;
  instanceId: string;
  instanceSlug: string | null;
  mapState: Record<string, unknown>;
  expiresAt: string | null;
}

export interface MapCompositionLayerRef {
  layerId: string;
  style?: string;
  opacity?: number;
  visible?: boolean;
}

export interface MapComposition {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  instanceId: string;
  layers: MapCompositionLayerRef[];
  center: { lat: number; lon: number };
  zoom: number;
  isPublic: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Export {
  id: string;
  format: string;
  layerId: string | null;
  layerIds?: string[] | null;
  isBulk?: boolean;
  status: string;
  filePath: string;
  createdAt: string;
}

export interface LocationPlan {
  id: string;
  userId: string;
  instanceId: string;
  status: string;
  title: string;
  description: string | null;
  landmark: string | null;
  lon: number;
  lat: number;
  scale: number | null;
  paperSize: string;
  orientation: string;
  includeLegend?: boolean;
  includeScale?: boolean;
  includeGrid?: boolean;
  includeNorthArrow?: boolean;
  filePath: string | null;
  fileSize: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface Document {
  id: string;
  name: string;
  description: string;
  filePath: string;
  instanceId: string;
  layerId: string;
}

export interface DefaultTheme {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  order: number;
  tags?: string[];
}

export interface AnalyticsEvent {
  instanceId: string;
  eventType: string;
  layerId?: string;
  metadata?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: any;
}

export interface SearchResult {
  id: string;
  type: string;
  name: string;
  description: string;
  instanceId?: string;
  layerId?: string;
  score: number;
}

export interface GeocodingResult {
  placeId: string;
  displayName: string;
  lat: number;
  lon: number;
  boundingbox: [number, number, number, number];
  type: string;
  importance: number;
  address: Record<string, string>;
}

export interface RouteResult {
  distance: number;
  duration: number;
  geometry: GeoJSON.Geometry;
  legs: RouteLeg[];
  waypoints: RouteWaypoint[];
}

export interface RouteLeg {
  distance: number;
  duration: number;
  summary: string;
  steps: RouteStep[];
}

export interface RouteStep {
  distance: number;
  duration: number;
  instruction: string;
  name: string;
  geometry: GeoJSON.Geometry;
}

export interface RouteWaypoint {
  name: string;
  location: [number, number];
}

// Forme réelle renvoyée par POST /geoportail/elevation-profile (voir
// PostGISService.drapeElevationProfile()) : un tableau plat de points {distance, altitude}
// (distance en mètres depuis le début de la ligne). Ni lat/lon ni statistiques agrégées ne
// sont renvoyées par le backend - la position sur la ligne se retrouve côté client via
// LineString.getCoordinateAt(fraction), et les statistiques (min/max/dénivelé) sont
// calculées côté client à partir de ces points.
export interface ElevationProfile {
  profile: ElevationPoint[];
}

export interface ElevationPoint {
  distance: number;
  altitude: number;
}
