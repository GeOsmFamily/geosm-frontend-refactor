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
import { SpatialAnalysisToolComponent } from '../spatial-analysis/spatial-analysis-tool.component';
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
    SpatialAnalysisToolComponent,
  ],
  templateUrl: './tool-panel.component.html',
  styleUrl: './tool-panel.component.scss',
})
export class ToolPanelComponent {
  activeTool: string | null = null;

  readonly tools: ToolItem[] = [
    { id: 'drawing', icon: 'draw', label: 'tools.drawing' },
    { id: 'measure', icon: 'straighten', label: 'right_menu.tools.mesure.title' },
    { id: 'routing', icon: 'directions', label: 'right_menu.map_routing.title' },
    { id: 'export', icon: 'download', label: 'right_menu.download_data.title' },
    { id: 'print', icon: 'print', label: 'right_menu.tools.print.title' },
    { id: 'comment', icon: 'comment', label: 'right_menu.tools.comment.title' },
    { id: 'altimetry', icon: 'terrain', label: 'right_menu.tools.altimetry.title' },
    { id: 'mapillary', icon: 'streetview', label: 'naviguation_tools.mappilary' },
    { id: 'compare', icon: 'compare', label: 'compare_maps.compare' },
    { id: 'statistics', icon: 'bar_chart', label: 'tools.statistics' },
    { id: 'spatial-analysis', icon: 'blur_circular', label: 'tools.spatialAnalysis' },
  ];

  toggleTool(toolId: string): void {
    this.activeTool = this.activeTool === toolId ? null : toolId;
  }

  getActiveToolLabel(): string {
    return this.tools.find(t => t.id === this.activeTool)?.label ?? '';
  }
}
