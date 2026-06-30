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
  imports: [
    TranslateModule,
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

  private loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }

  async generatePdf(): Promise<void> {
    this.generating = true;

    try {
      const mapElement = this.mapService.getMap().getTargetElement() as HTMLElement;

      const domtoimage = await import('dom-to-image-more');
      const dataUrl = await domtoimage.toPng(mapElement, { quality: 0.95 });

      const { jsPDF } = await import('jspdf');

      const pdf = new jsPDF({
        orientation: this.orientation,
        unit: 'mm',
        format: this.paperSize,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // 1. Draw Branded Header Bar (GeOSM Primary Color #023f5f)
      pdf.setFillColor(2, 63, 95);
      pdf.rect(0, 0, pageWidth, 24, 'F');

      // GeOSM Title text
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(255, 255, 255);
      pdf.text('GeOSM', margin, 11);

      // GeOSM Subtitle text
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(0, 173, 167); // Accent color
      pdf.text('PLATEFORME CARTOGRAPHIQUE', margin, 16);

      // Attempt to load and render the GeOSM logo in the header
      try {
        const logoImg = await this.loadImg('assets/icones/logogeo.png');
        // Render logo at top-right
        pdf.addImage(logoImg, 'PNG', pageWidth - margin - 14, 5, 14, 14);
      } catch (e) {
        console.warn('[PrintTool] Failed to load GeOSM logo, using text branding fallback.', e);
      }

      let yPos = 32;

      // 2. User Title
      if (this.title) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(2, 63, 95);
        pdf.text(this.title, margin, yPos);
        yPos += 8;
      }

      // 3. User Description
      if (this.description) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139); // Slate-500
        const lines = pdf.splitTextToSize(this.description, pageWidth - margin * 2);
        pdf.text(lines, margin, yPos);
        yPos += lines.length * 4.5 + 4;
      }

      // 4. Map Image
      const mapWidth = pageWidth - margin * 2;
      const footerSpace = this.includeLegend ? 40 : 25;
      const mapHeight = pageHeight - yPos - footerSpace;
      
      pdf.addImage(dataUrl, 'PNG', margin, yPos, mapWidth, mapHeight);
      yPos += mapHeight + 6;

      // 5. Scale representation
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

      // 6. Footer Line & Attributions
      pdf.setDrawColor(226, 232, 240); // Slate-200
      pdf.setLineWidth(0.2);
      pdf.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);

      // Metadata on the left
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184); // Slate-400
      const center = this.mapService.getCenter();
      const zoom = this.mapService.getZoom();
      const now = new Date().toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      pdf.text(`Lat/Lon: ${center[1].toFixed(5)}, ${center[0].toFixed(5)} | Zoom: ${zoom.toFixed(0)} | Date: ${now}`, margin, pageHeight - 10);

      // Attributions on the right
      pdf.text('Données © OpenStreetMap contributors | Propulsé par GeOSM', pageWidth - margin, pageHeight - 10, { align: 'right' });

      // Save PDF
      const fileTitle = this.title ? this.title.toLowerCase().replace(/\s+/g, '-') : 'carte';
      pdf.save(`${fileTitle}-${Date.now()}.pdf`);
    } catch (err) {
      console.error('[PrintTool] PDF generation failed:', err);
    } finally {
      this.generating = false;
    }
  }
}
