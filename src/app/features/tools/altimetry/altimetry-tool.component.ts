import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import Map from 'ol/Map.js';
import { toLonLat } from 'ol/proj.js';
import { MapService } from '../../map/services/map.service';
import { GeoportailService } from '../../../core/services/geoportail.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-altimetry-tool',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDividerModule, LoadingSpinnerComponent],
  templateUrl: './altimetry-tool.component.html',
  styleUrl: './altimetry-tool.component.scss',
})
export class AltimetryToolComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly geoportailService = inject(GeoportailService);
  private map!: Map;
  private clickListener: ((evt: any) => void) | null = null;

  picking = false;
  loading = false;
  altitude: number | null = null;
  coordinates: [number, number] | null = null;

  ngOnInit(): void {
    this.map = this.mapService.getMap();
  }

  ngOnDestroy(): void {
    this.stopPicking();
  }

  startPicking(): void {
    this.stopPicking();
    this.picking = true;
    this.clickListener = (evt: any) => {
      const lonLat = toLonLat(evt.coordinate) as [number, number];
      this.coordinates = lonLat;
      this.loading = true;
      this.geoportailService.getAltitude(lonLat[1], lonLat[0]).subscribe({
        next: (alt) => {
          this.altitude = alt;
          this.loading = false;
        },
        error: () => {
          this.altitude = null;
          this.loading = false;
        },
      });
      this.stopPicking();
    };
    this.map.on('singleclick', this.clickListener);
  }

  stopPicking(): void {
    if (this.clickListener) {
      this.map.un('singleclick', this.clickListener);
      this.clickListener = null;
    }
    this.picking = false;
  }

  clear(): void {
    this.altitude = null;
    this.coordinates = null;
    this.stopPicking();
  }
}
