import { ElevationPoint } from '../../../core/models/index';

export interface ElevationProfileStats {
  distanceM: number;
  minAltitude: number;
  maxAltitude: number;
  ascent: number;
  descent: number;
}

/** Extrait de AltimetryToolComponent (voir plan "Itinéraires : altimétrie, isochrones,
 * multimodal" du 2026-08-06) - partagé avec RoutingToolComponent, qui affiche le même profil
 * pour un itinéraire calculé plutôt qu'une ligne tracée à main levée. */
export function computeElevationStats(points: ElevationPoint[]): ElevationProfileStats {
  let ascent = 0;
  let descent = 0;
  let minAltitude = points[0].altitude;
  let maxAltitude = points[0].altitude;

  for (let i = 1; i < points.length; i++) {
    const delta = points[i].altitude - points[i - 1].altitude;
    if (delta > 0) ascent += delta;
    else descent += -delta;
    minAltitude = Math.min(minAltitude, points[i].altitude);
    maxAltitude = Math.max(maxAltitude, points[i].altitude);
  }

  return {
    distanceM: points[points.length - 1].distance,
    minAltitude,
    maxAltitude,
    ascent,
    descent,
  };
}

/** Instancie (ou remplace) un graphique Chart.js du profil altimétrique sur le canvas donné.
 * `onHoverFraction` reçoit la fraction (0-1) de la distance totale survolée, pour permettre à
 * l'appelant de positionner un marqueur sur la ligne correspondante de la carte - le composant
 * appelant reste seul responsable de savoir QUELLE géométrie marquer (tracé libre ou itinéraire). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function renderElevationChart(
  canvas: HTMLCanvasElement,
  points: ElevationPoint[],
  previousChart: unknown,
  onHoverFraction?: (fraction: number) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const { Chart } = await import('chart.js/auto');
  (previousChart as { destroy?: () => void } | null)?.destroy?.();

  const labels = points.map((p) => (p.distance / 1000).toFixed(2));
  const data = points.map((p) => p.altitude);
  const totalDistance = points[points.length - 1].distance || 1;

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data,
          borderColor: '#00ada7',
          backgroundColor: 'rgba(0, 173, 167, 0.15)',
          fill: true,
          tension: 0.15,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#e74c3c',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { title: { display: true, text: 'Distance (km)' }, ticks: { maxTicksLimit: 8 } },
        y: { title: { display: true, text: 'Altitude (m)' } },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items: { label: string }[]) => `${items[0].label} km`,
            label: (item: { formattedValue: string }) => `${item.formattedValue} m`,
          },
        },
      },
      onHover: (_event: unknown, elements: { index: number }[]) => {
        if (elements.length === 0 || !onHoverFraction) return;
        const idx = elements[0].index;
        onHoverFraction(Math.min(1, Math.max(0, points[idx].distance / totalDistance)));
      },
    },
  });
}

/** Nombre de points d'échantillonnage adapté à la longueur de la ligne (même heuristique dans
 * AltimetryToolComponent et RoutingToolComponent) - reste dans les bornes [2,1000] acceptées par
 * POST /geoportail/elevation-profile. */
export function elevationSampleCount(lengthMeters: number): number {
  return Math.max(20, Math.min(300, Math.round(lengthMeters / 50)));
}
