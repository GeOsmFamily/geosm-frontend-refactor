import { Style, Fill, Stroke } from 'ol/style';
import type { FeatureLike } from 'ol/Feature';

/** Rampe séquentielle claire → foncé, dérivée de la palette de marque (accent teal → primaire
 * marine) plutôt qu'une palette arc-en-ciel générique - cohérent avec le reste de l'UI. */
const RAMP_LIGHT = [231, 250, 249]; // teinte très claire de l'accent #00ada7
const RAMP_DARK = [2, 63, 95]; // primaire #023f5f

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/** Génère `numClasses` couleurs allant de la teinte claire à la couleur primaire foncée. */
export function graduatedColorRamp(numClasses: number): string[] {
  if (numClasses <= 1) return [`rgb(${RAMP_DARK.join(',')})`];
  const colors: string[] = [];
  for (let i = 0; i < numClasses; i++) {
    const t = i / (numClasses - 1);
    const r = lerp(RAMP_LIGHT[0], RAMP_DARK[0], t);
    const g = lerp(RAMP_LIGHT[1], RAMP_DARK[1], t);
    const b = lerp(RAMP_LIGHT[2], RAMP_DARK[2], t);
    colors.push(`rgb(${r},${g},${b})`);
  }
  return colors;
}

/** Classes par quantiles (même nombre d'observations par classe) - plus robuste que des
 * intervalles égaux face à une distribution asymétrique (fréquent sur des données réelles :
 * quelques zones très peuplées, beaucoup de zones peu peuplées). Retourne numClasses+1 bornes
 * (edges), la classe i couvre [breaks[i], breaks[i+1]]. */
export function computeQuantileBreaks(values: number[], numClasses: number): number[] {
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return [0, 0];
  if (sorted.length === 1) return [sorted[0], sorted[0]];

  const breaks: number[] = [sorted[0]];
  for (let i = 1; i < numClasses; i++) {
    const idx = Math.floor((i / numClasses) * (sorted.length - 1));
    breaks.push(sorted[idx]);
  }
  breaks.push(sorted.at(-1)!);
  // Des quantiles peuvent coïncider sur une distribution très concentrée (beaucoup de zéros) -
  // dédupliquer pour éviter des classes de largeur nulle qui rendraient la légende absurde.
  return [...new Set(breaks)].sort((a, b) => a - b);
}

/** Index de classe (0-based) pour une valeur donnée face à des bornes croissantes - la dernière
 * classe inclut la borne max. */
export function classifyValue(value: number, breaks: number[]): number {
  for (let i = 0; i < breaks.length - 2; i++) {
    if (value < breaks[i + 1]) return i;
  }
  return breaks.length - 2;
}

export interface GraduatedLegendEntry {
  color: string;
  min: number;
  max: number;
}

/** Construit la légende (classe → plage + couleur) à partir des mêmes bornes que le style -
 * garantit que légende et rendu carte restent toujours cohérents (une seule source de vérité). */
export function buildGraduatedLegend(breaks: number[]): GraduatedLegendEntry[] {
  const numClasses = Math.max(breaks.length - 1, 1);
  const colors = graduatedColorRamp(numClasses);
  const entries: GraduatedLegendEntry[] = [];
  for (let i = 0; i < numClasses; i++) {
    entries.push({ color: colors[i], min: breaks[i], max: breaks[i + 1] ?? breaks[i] });
  }
  return entries;
}

/** Style OL gradué pour un choroplèthe (polygones) - lit `valueField` sur chaque feature,
 * classe la valeur et applique la couleur correspondante en remplissage. */
export function buildChoroplethStyleFn(valueField: string, breaks: number[]) {
  const colors = graduatedColorRamp(Math.max(breaks.length - 1, 1));
  return (feature: FeatureLike): Style => {
    const value = feature.get(valueField) as number | null;
    const colorIndex = value != null ? classifyValue(value, breaks) : -1;
    const color = colorIndex >= 0 ? colors[colorIndex] : 'rgba(200,200,200,0.3)';
    return new Style({
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#023f5f', width: 1 }),
    });
  };
}

/** Style OL gradué pour une grille (carroyage/hexbin) - même principe que le choroplèthe mais
 * pensé pour des cellules pleines (pas de bordure marquée, la grille est dense). */
export function buildGridStyleFn(valueField: string, breaks: number[]) {
  const colors = graduatedColorRamp(Math.max(breaks.length - 1, 1));
  return (feature: FeatureLike): Style => {
    const value = (feature.get(valueField) as number | null) ?? 0;
    const colorIndex = classifyValue(value, breaks);
    return new Style({
      fill: new Fill({ color: colors[colorIndex] }),
      stroke: new Stroke({ color: 'rgba(255,255,255,0.4)', width: 0.5 }),
    });
  };
}
