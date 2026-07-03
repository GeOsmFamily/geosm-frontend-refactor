import { Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, timer } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';

import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { toLonLat } from 'ol/proj';
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';

import { MapService } from '../../map/services/map.service';
import { InstanceService } from '../../../core/services/instance.service';
import { LocationPlanService } from '../../../core/services/location-plan.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

const SCALE_OPTIONS = [1000, 2000, 5000, 10000, 25000, 50000];
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90000;

@Component({
  selector: 'app-plan-localisation-tool',
  standalone: true,
  imports: [
    TranslateModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonToggleModule,
    MatSnackBarModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './plan-localisation-tool.component.html',
  styleUrl: './plan-localisation-tool.component.scss',
})
export class PlanLocalisationToolComponent implements OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly instanceService = inject(InstanceService);
  private readonly locationPlanService = inject(LocationPlanService);
  private readonly snackBar = inject(MatSnackBar);

  title = '';
  description = '';
  landmark = '';
  scale: number | 'auto' = 'auto';
  paperSize: 'A4' | 'A3' = 'A4';
  orientation: 'PORTRAIT' | 'LANDSCAPE' = 'PORTRAIT';
  readonly scaleOptions = SCALE_OPTIONS;

  readonly picking = signal(false);
  readonly hasPoint = signal(false);
  readonly generating = signal(false);
  readonly pickedLonLat = signal<[number, number] | null>(null);

  private markerLayer!: VectorLayer<VectorSource>;
  private clickSub: Subscription | null = null;
  private pollSub: Subscription | null = null;

  private ensureMarkerLayer(): void {
    if (this.markerLayer) return;
    this.markerLayer = this.mapService.addVectorLayer(
      'plan-localisation-marker',
      [],
      new Style({
        image: new CircleStyle({
          radius: 9,
          fill: new Fill({ color: '#e74c3c' }),
          stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
        }),
      })
    );
  }

  togglePicking(): void {
    if (this.picking()) {
      this.stopPicking();
      return;
    }
    this.ensureMarkerLayer();
    this.picking.set(true);
    this.mapService.isPicking = true;
    this.clickSub = this.mapService.onClick$.subscribe((event) => {
      this.setPoint(event.coordinate);
      this.stopPicking();
    });
  }

  private stopPicking(): void {
    this.picking.set(false);
    this.mapService.isPicking = false;
    this.clickSub?.unsubscribe();
    this.clickSub = null;
  }

  private setPoint(coordinate3857: number[]): void {
    this.ensureMarkerLayer();
    const source = this.markerLayer.getSource()!;
    source.clear();
    source.addFeature(new Feature(new Point(coordinate3857)));
    this.hasPoint.set(true);
    this.pickedLonLat.set(toLonLat(coordinate3857) as [number, number]);
  }

  generatePdf(): void {
    const lonLat = this.pickedLonLat();
    const instance = this.instanceService.currentInstance$.value;
    if (!lonLat || !instance) return;

    this.generating.set(true);
    this.locationPlanService.create({
      instanceId: instance.id,
      title: this.title || 'Plan de localisation',
      description: this.description || undefined,
      landmark: this.landmark || undefined,
      lon: lonLat[0],
      lat: lonLat[1],
      scale: this.scale === 'auto' ? undefined : this.scale,
      paperSize: this.paperSize,
      orientation: this.orientation,
    }).subscribe({
      next: (plan) => this.pollUntilDone(plan.id),
      error: (err) => {
        console.error('[PlanLocalisation] Échec de la création du plan', err);
        this.generating.set(false);
        this.snackBar.open('Échec de la génération du PDF. Réessayez.', 'OK', { duration: 4000 });
      },
    });
  }

  private pollUntilDone(planId: string): void {
    const maxTicks = Math.ceil(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);
    let ticks = 0;

    this.pollSub?.unsubscribe();
    this.pollSub = timer(0, POLL_INTERVAL_MS).pipe(
      takeWhile(() => ticks++ < maxTicks),
      switchMap(() => this.locationPlanService.getById(planId)),
    ).subscribe({
      next: (plan) => {
        if (plan.status === 'COMPLETED') {
          this.pollSub?.unsubscribe();
          this.generating.set(false);
          this.triggerDownload(planId, plan.title);
        } else if (plan.status === 'FAILED') {
          this.pollSub?.unsubscribe();
          this.generating.set(false);
          this.snackBar.open(plan.errorMessage || 'Échec de la génération du PDF. Réessayez.', 'OK', { duration: 5000 });
        }
      },
      error: () => {
        this.generating.set(false);
        this.snackBar.open('Échec de la génération du PDF. Réessayez.', 'OK', { duration: 4000 });
      },
      complete: () => {
        // takeWhile a atteint le nombre max de tentatives sans COMPLETED/FAILED.
        if (this.generating()) {
          this.generating.set(false);
          this.snackBar.open('La génération prend plus de temps que prévu. Réessayez dans un instant.', 'OK', { duration: 5000 });
        }
      },
    });
  }

  private triggerDownload(planId: string, title: string): void {
    this.locationPlanService.download(planId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileTitle = title ? title.toLowerCase().replace(/\s+/g, '-') : 'plan-localisation';
        a.download = `${fileTitle}-${Date.now()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.snackBar.open('Le PDF est prêt mais le téléchargement a échoué. Réessayez.', 'OK', { duration: 4000 });
      },
    });
  }

  ngOnDestroy(): void {
    this.clickSub?.unsubscribe();
    this.pollSub?.unsubscribe();
    if (this.markerLayer) {
      this.mapService.removeLayer(this.markerLayer);
    }
  }
}
