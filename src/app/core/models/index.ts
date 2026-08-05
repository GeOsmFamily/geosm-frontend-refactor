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

export interface OsmProfile {
  osmUserId: string;
  displayName: string;
  avatarUrl: string | null;
  osmAccountCreatedAt: string | null;
  changesetCount: number;
  linkedAt: string;
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
  boundaryTable: string | null;
  boundaryId: number | null;
  boundaryGeomCol: string | null;
  adminLevel: number | null;
  isActive: boolean;
}

export interface BoundarySearchResult {
  id: number;
  name: string;
  adminLevel: number | null;
}

export interface BoundaryDetail {
  id: number;
  name: string;
  adminLevel: number | null;
  geojson: unknown;
}

/** Voir InstanceUserRecord côté backend (domain/repositories/instance.repository.ts). */
export interface InstanceUser {
  id: string;
  userId: string;
  instanceId: string;
  role: Role;
  user?: { id: string; email: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  slug: string;
  description: string;
  order: number;
  instanceId: string;
  icon?: string | null;
  color?: string | null;
  isActive?: boolean;
}

export interface SubGroup {
  id: string;
  name: string;
  slug: string;
  description: string;
  order: number;
  groupId: string;
  icon?: string | null;
  isActive?: boolean;
}

export type GeometryTypeEnum =
  'POINT' | 'LINESTRING' | 'POLYGON' | 'MULTIPOINT' | 'MULTILINESTRING' | 'MULTIPOLYGON';
export type LayerSourceType = 'WMS' | 'WFS' | 'WMTS' | 'GEOJSON' | 'MVT' | 'XYZ';

export interface Layer {
  id: string;
  name: string;
  slug?: string;
  sourceType: string;
  url: string;
  sourceUrl?: string | null;
  tableName: string;
  schemaName?: string | null;
  description: string;
  bbox: [number, number, number, number] | null;
  tags: string[];
  instanceId: string;
  subGroupId: string;
  sourceLayer?: string | null;
  geometryType?: string | null;
  minZoom?: number;
  maxZoom?: number;
  isVisible?: boolean;
  isQueryable?: boolean;
  opacity?: number;
  order?: number;
  metadata?: {
    icon?: string | null;
    color?: string | null;
    geometryType?: string | null;
    featureCount?: number | null;
    totalArea?: number | null;
    totalLength?: number | null;
    importedAt?: string | null;
    lastSyncedAt?: string | null;
    /** 'raster' pour une couche importée via /rasters/upload (voir UploadRasterUseCase côté
     * backend) - seul signal fiable pour distinguer une couche raster d'une couche vectorielle,
     * geometryType vaut toujours 'POLYGON' pour un raster (approximation de son emprise). */
    source?: string | null;
    [key: string]: unknown;
  } | null;
}

export interface Feature {
  id: string;
  geometry: GeoJSON.Geometry;
  properties: Record<string, unknown>;
  layerId: string;
}

/** Réponse de l'import d'un fichier (GeoJSON/KML/GPKG/Shapefile zippé/...) en table de staging,
 * avant publication définitive - voir l'assistant de création de couche, source "Fichier". */
export interface StagedFileImport {
  stagingTable: string;
  featureCount: number;
  geometryType: string;
  fields: string[];
  preview: GeoJSON.FeatureCollection;
}

export interface OsmTagCondition {
  key: string;
  value: string;
}

export interface QgisProjectLayerInfo {
  name: string;
  title: string;
}

export type PersonalLayerSourceType = 'FILE' | 'QGIS_PROJECT';
export type PersonalLayerStatus = 'PRIVATE' | 'PENDING_PUBLICATION' | 'PUBLISHED' | 'REJECTED';

/** Donnée PRIVÉE importée par un utilisateur (fichier ou projet QGIS), visible uniquement dans sa
 * propre session tant qu'elle n'est pas publiée - voir PersonalLayer côté backend. */
export interface PersonalLayer {
  id: string;
  userId: string;
  instanceId: string;
  name: string;
  description?: string | null;
  groupName: string;
  subGroupName: string;
  geometryType?: GeometryTypeEnum | null;
  sourceType: PersonalLayerSourceType;
  schemaName?: string | null;
  tableName?: string | null;
  qgisProjectPath?: string | null;
  sourceLayerName?: string | null;
  /** URL WMS publique prête à l'emploi, calculée côté serveur pour les données QGIS_PROJECT
   * uniquement (voir toDto() dans personal-layers.routes.ts) - null pour les données FILE. */
  sourceUrl?: string | null;
  style?: { color?: string; iconKey?: string; shape?: string; qmlPath?: string } | null;
  status: PersonalLayerStatus;
  publicationNote?: string | null;
  reviewNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  publishedLayerId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IconCatalogEntry {
  key: string;
  label: string;
  category: string;
}

export interface LayerStats {
  featureCount: number;
  totalArea: number | null;
  totalLength: number | null;
  bbox: [number, number, number, number] | null;
  narrative?: string;
}

export interface LayerSummaryEntry {
  layerId: string;
  name: string;
  kind: 'vector' | 'raster';
  featureCount?: number;
  totalAreaKm2?: number | null;
  totalLengthKm?: number | null;
  raster?: { min: number | null; max: number | null; mean: number | null; sum: number | null; count: number };
}

export interface ViewportSummary {
  layerCount: number;
  totalFeatureCount: number;
  perLayer: LayerSummaryEntry[];
  narrative?: string;
}

export interface BaseMap {
  id: string;
  name: string;
  slug: string;
  type: 'XYZ' | 'WMS' | 'WMTS' | 'MAPBOX';
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

export interface DefaultTag {
  id: string;
  name: string;
  slug: string;
  themeId: string;
}

/** Voir LayerStyle (schema.prisma) - un layer peut avoir plusieurs styles nommés, GET /layers/:layerId/style renvoie un tableau. */
export interface LayerStyleModel {
  id: string;
  name: string;
  sldBody: string | null;
  mapboxStyle: Record<string, unknown> | null;
  isDefault: boolean;
  layerId: string;
}

export interface QgisProjectModel {
  id: string;
  name: string;
  filePath: string;
  description: string | null;
  instanceId: string;
}

export interface RasterImportResult {
  layer: Layer;
  tableName: string;
  postgisImportWarning: string | null;
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
  meta?: unknown;
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
