import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MapLayerService, ActiveLayer } from '../../../map/services/map-layer.service.js';
import { TruncatePipe } from '../../../../shared/pipes/truncate.pipe.js';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-active-layers',
  standalone: true,
  imports: [TranslateModule, 
    CommonModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatSliderModule,
    MatTooltipModule,
    DragDropModule,
    TruncatePipe,
  ],
  templateUrl: './active-layers.component.html',
  styleUrl: './active-layers.component.scss',
})
export class ActiveLayersComponent {
  private readonly mapLayerService = inject(MapLayerService);

  readonly activeLayers$ = this.mapLayerService.activeLayers$;

  toggleVisibility(layer: ActiveLayer): void {
    this.mapLayerService.toggleVisibility(layer.layer.id);
  }

  onOpacityChange(layer: ActiveLayer, event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.mapLayerService.setOpacity(layer.layer.id, value / 100);
  }

  removeLayer(layer: ActiveLayer): void {
    this.mapLayerService.removeLayer(layer.layer.id);
  }

  removeAll(): void {
    this.mapLayerService.removeAll();
  }

  onDrop(event: CdkDragDrop<ActiveLayer[]>): void {
    this.mapLayerService.reorder(event.previousIndex, event.currentIndex);
  }
}
