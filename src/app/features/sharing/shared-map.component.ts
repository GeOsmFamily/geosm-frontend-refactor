import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

import { MapViewComponent } from '../map/components/map-view/map-view.component';
import { MapService } from '../map/services/map.service';
import { ApiService } from '../../core/services/api.service';
import { ShareMap } from '../../core/models/index';

@Component({
  selector: 'app-shared-map',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatIconModule, MapViewComponent],
  templateUrl: './shared-map.component.html',
  styleUrl: './shared-map.component.scss',
})
export class SharedMapComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly apiService = inject(ApiService);
  private readonly mapService = inject(MapService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly shareInfo = signal<ShareMap | null>(null);

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code');
    if (!code) {
      this.error.set('Invalid share link.');
      this.loading.set(false);
      return;
    }

    this.apiService.get<ShareMap>(`/sharing/${code}`).subscribe({
      next: (share) => {
        this.shareInfo.set(share);
        this.loading.set(false);
        this.applyMapState(share);
      },
      error: () => {
        this.error.set('This shared map could not be found or has expired.');
        this.loading.set(false);
      },
    });
  }

  private applyMapState(share: ShareMap): void {
    const state = share.mapState;
    if (state['center'] && state['zoom']) {
      const center = state['center'] as [number, number];
      const zoom = state['zoom'] as number;
      setTimeout(() => {
        this.mapService.setCenter(center);
        this.mapService.setZoom(zoom);
      }, 500);
    }
  }
}
