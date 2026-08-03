import { Layer } from '../models/index';
import { environment } from '../../../environments/environment';

/**
 * Génère une couleur déterministe depuis un nom/identifiant pour que chaque
 * couche sans couleur explicite ait une couleur distincte et harmonieuse.
 */
export function stringToColor(str: string): string {
  const palette = [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#14B8A6',
    '#F97316',
    '#6366F1',
    '#059669',
    '#D97706',
    '#DC2626',
    '#7C3AED',
    '#DB2777',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

/**
 * Génère un SVG teardrop ("pin" de carte) élégant aux couleurs de la couche
 * en Data URI (pas d'appel réseau nécessaire).
 */
export function buildPinMarkerSvg(color: string = '#00ada7'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <path d="M18 3 C11.37 3 6 8.37 6 15 C6 23 18 33 18 33 C18 33 30 23 30 15 C30 8.37 24.63 3 18 3 Z" fill="${color}" stroke="#ffffff" stroke-width="2.5"/>
    <circle cx="18" cy="15" r="5.5" fill="#ffffff"/>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

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
  if (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('/'))
    return icon;
  return null;
}

/**
 * Garantit toujours une icône utilisable (jamais null) :
 * 1. Si une icône SVG spécifique est configurée (`metadata.icon`), elle est utilisée.
 * 2. Sinon, génère un marqueur "pin" coloré unique d'après la couleur de la couche
 *    ou le nom de la couche, de sorte que chaque couche apparaisse automatiquement
 *    avec un visuel distinct sans configuration manuelle.
 */
export function resolveLayerIconUrlOrDefault(layer: Layer): string {
  const resolved = resolveLayerIconUrl(layer);
  if (resolved) return resolved;
  const color = layer.metadata?.color || stringToColor(layer.name || layer.id || '');
  return buildPinMarkerSvg(color);
}

export function getGeometryIcon(type: string | null | undefined): string {
  switch (type?.toLowerCase()) {
    case 'point':
      return 'place';
    case 'line':
    case 'linestring':
      return 'timeline';
    case 'polygon':
      return 'pentagon';
    case 'raster':
      return 'grid_on';
    default:
      return 'layers';
  }
}
