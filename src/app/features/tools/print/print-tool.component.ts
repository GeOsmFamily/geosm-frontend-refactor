import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';

import { MapService } from '../../map/services/map.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-print-tool',
  standalone: true,
  imports: [TranslateModule, 
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDividerModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './print-tool.component.html',
  styleUrl: './print-tool.component.scss',
})
export class PrintToolComponent {
  private readonly mapService = inject(MapService);

  title = '';
  description = '';
  paperSize: 'a4' | 'a3' = 'a4';
  orientation: 'portrait' | 'landscape' = 'landscape';
  includeLegend = true;
  generating = false;

  async generatePdf(): Promise<void> {
    this.generating = true;

    try {
      const mapElement = this.mapService.getMap().getTargetElement() as HTMLElement;

      const domtoimage = await import('dom-to-image-more');
      const dataUrl = await domtoimage.toPng(mapElement, { quality: 0.95 });

      const { jsPDF } = await import('jspdf');

      const isLandscape = this.orientation === 'landscape';
      const pdf = new jsPDF({
        orientation: this.orientation,
        unit: 'mm',
        format: this.paperSize,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      let yPos = margin;

      if (this.title) {
        pdf.setFontSize(18);
        pdf.text(this.title, pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;
      }

      if (this.description) {
        pdf.setFontSize(10);
        const lines = pdf.splitTextToSize(this.description, pageWidth - margin * 2);
        pdf.text(lines, margin, yPos);
        yPos += lines.length * 5 + 5;
      }

      const mapWidth = pageWidth - margin * 2;
      const mapHeight = pageHeight - yPos - (this.includeLegend ? 30 : 15);
      pdf.addImage(dataUrl, 'PNG', margin, yPos, mapWidth, mapHeight);
      yPos += mapHeight + 5;

      pdf.setFontSize(8);
      pdf.setTextColor(128);
      const center = this.mapService.getCenter();
      const zoom = this.mapService.getZoom();
      const now = new Date().toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      pdf.text(`Coordonnées: ${center[1].toFixed(5)}, ${center[0].toFixed(5)} | Zoom: ${zoom.toFixed(0)} | ${now}`, margin, yPos);

      pdf.save(`carte-${Date.now()}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      this.generating = false;
    }
  }
}
