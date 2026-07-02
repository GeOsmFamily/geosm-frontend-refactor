import { Layer } from '../models/index';
import { environment } from '../../../environments/environment';

/** Simple cercle teal comme repli quand une couche n'a pas d'icône SVG résolvable. */
const DEFAULT_MARKER_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="12" fill="#00ada7" stroke="#ffffff" stroke-width="2.5"/></svg>'
  );

/**
 * Résout l'URL de l'icône SVG d'une couche (null si elle doit retomber sur une
 * mat-icon générique). Logique extraite de CatalogBrowserComponent.getLayerSvgUrl()
 * pour être réutilisée par le rendu des marqueurs/clusters sur la carte.
 */
export function resolveLayerIconUrl(layer: Layer): string | null {
  const icon = layer.metadata?.icon;
  if (!icon) return null;
  if (icon.startsWith('api/v1/')) {
    // environment.apiUrl se termine par "/api/v1" - on le retire pour reconstituer
    // l'origine, car `icon` inclut déjà le préfixe "api/v1/".
    const origin = environment.apiUrl.replace(/\/api\/v1\/?$/, '');
    return `${origin}/${icon}`;
  }
  if (icon.startsWith('assets/')) return icon;
  if (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('/')) return icon;
  return null;
}

/** Comme resolveLayerIconUrl(), mais garantit toujours une image utilisable (jamais null). */
export function resolveLayerIconUrlOrDefault(layer: Layer): string {
  return resolveLayerIconUrl(layer) || DEFAULT_MARKER_SVG;
}

export function getGeometryIcon(type: string | null | undefined): string {
  switch (type?.toLowerCase()) {
    case 'point': return 'place';
    case 'line':
    case 'linestring': return 'timeline';
    case 'polygon': return 'pentagon';
    case 'raster': return 'grid_on';
    default: return 'layers';
  }
}
