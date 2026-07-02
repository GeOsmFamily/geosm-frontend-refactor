import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OverviewMap from 'ol/control/OverviewMap';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { toLonLat } from 'ol/proj';
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';

import { MapService } from '../../map/services/map.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { fitImageContain } from '../../../core/utils/pdf-image-fit.util';

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
    MatSnackBarModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './plan-localisation-tool.component.html',
  styleUrl: './plan-localisation-tool.component.scss',
})
export class PlanLocalisationToolComponent implements OnDestroy {
  @ViewChild('overviewContainer', { static: true }) overviewContainer!: ElementRef<HTMLDivElement>;

  private readonly mapService = inject(MapService);
  private readonly snackBar = inject(MatSnackBar);

  title = '';
  description = '';
  landmark = '';
  readonly picking = signal(false);
  readonly hasPoint = signal(false);
  readonly generating = signal(false);
  readonly pickedLonLat = signal<[number, number] | null>(null);

  private markerLayer!: VectorLayer<VectorSource>;
  private markerFeature: Feature<Point> | null = null;
  private overviewControl: OverviewMap | null = null;
  private clickSub: Subscription | null = null;

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
    this.markerFeature = new Feature(new Point(coordinate3857));
    source.addFeature(this.markerFeature);
    this.hasPoint.set(true);
    this.pickedLonLat.set(toLonLat(coordinate3857) as [number, number]);
    // Prépare le médaillon dès le choix du point (visible dans le panneau) plutôt
    // qu'à la génération du PDF : donne un retour visuel immédiat et laisse le
    // temps aux tuiles de charger avant la capture.
    this.setupOverviewMap();
  }

  private loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }

  private waitRenderComplete(map: import('ol/Map').default): Promise<void> {
    return new Promise((resolve) => {
      map.once('rendercomplete', () => resolve());
      map.renderSync();
    });
  }

  private setupOverviewMap(): OverviewMap {
    if (this.overviewControl) return this.overviewControl;
    const control = new OverviewMap({
      className: 'ol-overviewmap plan-localisation-overview',
      collapsed: false,
      collapsible: false,
      target: this.overviewContainer.nativeElement,
      layers: [new TileLayer({ source: new OSM() })],
    });
    this.mapService.getMap().addControl(control);
    this.overviewControl = control;
    return control;
  }

  /** Attend que le médaillon (carte interne du contrôle OverviewMap) ait fini de charger ses tuiles. */
  private waitOverviewRenderComplete(control: OverviewMap): Promise<void> {
    const overviewMap = control.getOverviewMap();
    if (!overviewMap) return Promise.resolve();
    return new Promise((resolve) => {
      overviewMap.once('rendercomplete', () => resolve());
      overviewMap.renderSync();
      // Garde-fou : si rendercomplete ne se déclenche jamais (tuiles bloquées...),
      // ne pas bloquer indéfiniment la génération du PDF.
      setTimeout(resolve, 2500);
    });
  }

  private toUtm(lonLat: [number, number]): string {
    // Conversion UTM simplifiée non disponible sans dépendance dédiée (proj4) -
    // on reste en degrés décimaux, suffisant pour la majorité des usages.
    return `${lonLat[1].toFixed(6)}, ${lonLat[0].toFixed(6)} (WGS84)`;
  }

  async generatePdf(): Promise<void> {
    const lonLat = this.pickedLonLat();
    if (!lonLat) return;

    this.generating.set(true);
    try {
      const map = this.mapService.getMap();
      const overview = this.setupOverviewMap();

      await Promise.all([
        this.waitRenderComplete(map),
        this.waitOverviewRenderComplete(overview),
      ]);

      const domtoimage = await import('dom-to-image-more');
      const mapElement = map.getTargetElement() as HTMLElement;
      const mainMapDataUrl = await domtoimage.toPng(mapElement, { quality: 0.95 });
      const overviewDataUrl = await domtoimage.toPng(this.overviewContainer.nativeElement, { quality: 0.95 });
      const mainMapImg = await this.loadImg(mainMapDataUrl);
      const overviewImg = await this.loadImg(overviewDataUrl);

      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // En-tête GeOSM (identique à l'outil Impression)
      pdf.setFillColor(2, 63, 95);
      pdf.rect(0, 0, pageWidth, 24, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(255, 255, 255);
      pdf.text('GeOSM', margin, 11);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(0, 173, 167);
      pdf.text('PLAN DE LOCALISATION', margin, 16);

      try {
        const logoImg = await this.loadImg('assets/icones/logogeo.png');
        pdf.addImage(logoImg, 'PNG', pageWidth - margin - 14, 5, 14, 14);
      } catch { /* logo optionnel */ }

      let yPos = 32;

      if (this.title) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(2, 63, 95);
        pdf.text(this.title, margin, yPos);
        yPos += 8;
      }
      if (this.description) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        const lines = pdf.splitTextToSize(this.description, pageWidth - margin * 2);
        pdf.text(lines, margin, yPos);
        yPos += lines.length * 4.5 + 4;
      }

      // Carte principale - ajustée en "contain" pour ne jamais déformer l'aspect
      // ratio réel de la capture (qui dépend de la taille de l'écran, pas du format A4).
      const mapWidth = pageWidth - margin * 2;
      const footerSpace = 55;
      const mapHeight = pageHeight - yPos - footerSpace;
      const mainFit = fitImageContain(mainMapImg.naturalWidth, mainMapImg.naturalHeight, mapWidth, mapHeight);
      pdf.setFillColor(241, 245, 249); // Slate-100, comble les bandes laissées par le "contain"
      pdf.rect(margin, yPos, mapWidth, mapHeight, 'F');
      pdf.addImage(mainMapDataUrl, 'PNG', margin + mainFit.offsetX, yPos + mainFit.offsetY, mainFit.width, mainFit.height);
      pdf.setDrawColor(2, 63, 95);
      pdf.setLineWidth(0.5);
      pdf.rect(margin, yPos, mapWidth, mapHeight);

      // Médaillon "plan de situation" en encart (coin inférieur droit de la carte)
      const insetSize = 32;
      const insetX = margin + mapWidth - insetSize - 3;
      const insetY = yPos + mapHeight - insetSize - 3;
      const insetFit = fitImageContain(overviewImg.naturalWidth, overviewImg.naturalHeight, insetSize, insetSize);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(insetX - 1, insetY - 1, insetSize + 2, insetSize + 2, 'F');
      pdf.addImage(overviewDataUrl, 'PNG', insetX + insetFit.offsetX, insetY + insetFit.offsetY, insetFit.width, insetFit.height);
      pdf.setDrawColor(2, 63, 95);
      pdf.setLineWidth(0.4);
      pdf.rect(insetX, insetY, insetSize, insetSize);
      pdf.setFontSize(6);
      pdf.setTextColor(2, 63, 95);
      pdf.text('Plan de situation', insetX, insetY - 1.5);

      // Flèche du nord (statique - pas de rotation de carte dans l'application)
      const arrowX = margin + 8;
      const arrowY = yPos + 12;
      pdf.setFillColor(2, 63, 95);
      pdf.triangle(arrowX, arrowY - 6, arrowX - 3, arrowY + 3, arrowX + 3, arrowY + 3, 'F');
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.text('N', arrowX - 1.3, arrowY + 8);

      yPos += mapHeight + 6;

      // Échelle graphique (même pattern que l'outil Impression)
      const scaleElement = document.querySelector('.ol-scale-line-inner') as HTMLElement;
      const scaleText = scaleElement ? scaleElement.textContent : '';
      if (scaleText) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(71, 85, 105);
        pdf.text(`Échelle : ${scaleText}`, margin, yPos);
        pdf.setDrawColor(71, 85, 105);
        pdf.setLineWidth(0.3);
        pdf.line(margin, yPos + 1.5, margin + 20, yPos + 1.5);
        pdf.line(margin, yPos + 0.8, margin, yPos + 2.2);
        pdf.line(margin + 20, yPos + 0.8, margin + 20, yPos + 2.2);
        yPos += 8;
      }

      // Tableau de coordonnées + repère
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(2, 63, 95);
      pdf.text('Coordonnées du point', margin, yPos);
      yPos += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(51, 65, 85);
      pdf.text(`Latitude / Longitude : ${this.toUtm(lonLat)}`, margin, yPos);
      yPos += 5;
      if (this.landmark) {
        pdf.text(`Point de repère : ${this.landmark}`, margin, yPos);
        yPos += 5;
      }

      // Pied de page
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.2);
      pdf.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      const now = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      pdf.text(`Date : ${now}`, margin, pageHeight - 10);
      pdf.text('Données © OpenStreetMap contributors | Propulsé par GeOSM', pageWidth - margin, pageHeight - 10, { align: 'right' });

      const fileTitle = this.title ? this.title.toLowerCase().replace(/\s+/g, '-') : 'plan-localisation';
      pdf.save(`${fileTitle}-${Date.now()}.pdf`);
    } catch (err) {
      console.error('[PlanLocalisation] PDF generation failed:', err);
      this.snackBar.open('Échec de la génération du PDF. Réessayez.', 'OK', { duration: 4000 });
    } finally {
      this.generating.set(false);
    }
  }

  ngOnDestroy(): void {
    this.clickSub?.unsubscribe();
    if (this.markerLayer) {
      this.mapService.removeLayer(this.markerLayer);
    }
    if (this.overviewControl) {
      this.mapService.getMap()?.removeControl(this.overviewControl);
    }
  }
}
