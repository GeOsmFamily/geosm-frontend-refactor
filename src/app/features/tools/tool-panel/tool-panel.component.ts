import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DrawingToolComponent } from '../drawing/drawing-tool.component';
import { MeasureToolComponent } from '../measure/measure-tool.component';
import { RoutingToolComponent } from '../routing/routing-tool.component';
import { ExportToolComponent } from '../export/export-tool.component';
import { PrintToolComponent } from '../print/print-tool.component';
import { CommentToolComponent } from '../comment/comment-tool.component';
import { AltimetryToolComponent } from '../altimetry/altimetry-tool.component';
import { MapillaryToolComponent } from '../mapillary/mapillary-tool.component';
import { CompareToolComponent } from '../compare/compare-tool.component';
import { StatisticsToolComponent } from '../statistics/statistics-tool.component';
import { TranslateModule } from '@ngx-translate/core';

interface ToolItem {
  id: string;
  icon: string;
  label: string;
}

@Component({
  selector: 'app-tool-panel',
  standalone: true,
  imports: [TranslateModule, 
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    DrawingToolComponent,
    MeasureToolComponent,
    RoutingToolComponent,
    ExportToolComponent,
    PrintToolComponent,
    CommentToolComponent,
    AltimetryToolComponent,
    MapillaryToolComponent,
    CompareToolComponent,
    StatisticsToolComponent,
  ],
  templateUrl: './tool-panel.component.html',
  styleUrl: './tool-panel.component.scss',
})
export class ToolPanelComponent {
  activeTool: string | null = null;

  readonly tools: ToolItem[] = [
    { id: 'drawing', icon: 'draw', label: 'Dessin' },
    { id: 'measure', icon: 'straighten', label: 'Mesure' },
    { id: 'routing', icon: 'directions', label: 'Itinéraire' },
    { id: 'export', icon: 'download', label: 'Export' },
    { id: 'print', icon: 'print', label: 'Impression' },
    { id: 'comment', icon: 'comment', label: 'Commentaires' },
    { id: 'altimetry', icon: 'terrain', label: 'Altimétrie' },
    { id: 'mapillary', icon: 'streetview', label: 'Mapillary' },
    { id: 'compare', icon: 'compare', label: 'Comparer' },
    { id: 'statistics', icon: 'bar_chart', label: 'Statistiques' },
  ];

  toggleTool(toolId: string): void {
    this.activeTool = this.activeTool === toolId ? null : toolId;
  }

  getActiveToolLabel(): string {
    return this.tools.find(t => t.id === this.activeTool)?.label ?? '';
  }
}
