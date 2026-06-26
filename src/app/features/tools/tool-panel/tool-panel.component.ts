import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DrawingToolComponent } from '../drawing/drawing-tool.component.js';
import { MeasureToolComponent } from '../measure/measure-tool.component.js';
import { RoutingToolComponent } from '../routing/routing-tool.component.js';
import { ExportToolComponent } from '../export/export-tool.component.js';
import { PrintToolComponent } from '../print/print-tool.component.js';
import { CommentToolComponent } from '../comment/comment-tool.component.js';
import { AltimetryToolComponent } from '../altimetry/altimetry-tool.component.js';

interface ToolItem {
  id: string;
  icon: string;
  label: string;
}

@Component({
  selector: 'app-tool-panel',
  standalone: true,
  imports: [
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
  ];

  toggleTool(toolId: string): void {
    this.activeTool = this.activeTool === toolId ? null : toolId;
  }
}
