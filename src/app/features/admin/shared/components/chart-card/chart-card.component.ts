import {
  Component,
  ElementRef,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  afterNextRender,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { Chart, ChartType } from 'chart.js';

export interface ChartCardDataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string;
}

/**
 * Wrapper générique chart.js pour les graphes admin - même pattern (import dynamique
 * 'chart.js/auto', ViewChild canvas, destroy avant re-render) que l'outil Altimétrie
 * (features/tools/altimetry), seule utilisation existante de chart.js dans le projet.
 */
@Component({
  selector: 'app-chart-card',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './chart-card.component.html',
  styleUrl: './chart-card.component.scss',
})
export class ChartCardComponent implements OnChanges, OnDestroy {
  @Input() title = '';
  @Input() type: ChartType = 'line';
  @Input() labels: string[] = [];
  @Input() datasets: ChartCardDataset[] = [];
  @Input() loading = false;

  @ViewChild('chartCanvas') private chartCanvas?: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;

  constructor(private readonly injector: Injector) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['labels'] || changes['datasets'] || changes['type']) && !this.loading) {
      afterNextRender(() => void this.render(), { injector: this.injector });
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private async render(): Promise<void> {
    if (!this.chartCanvas || this.datasets.length === 0) return;
    const { Chart } = await import('chart.js/auto');

    this.chart?.destroy();

    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: this.type,
      data: {
        labels: this.labels,
        datasets: this.datasets.map((d) => ({
          label: d.label,
          data: d.data,
          borderColor: d.borderColor ?? '#00ada7',
          backgroundColor: d.backgroundColor ?? 'rgba(0, 173, 166, 0.15)',
          tension: 0.3,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: this.datasets.length > 1 } },
      },
    });
  }
}
