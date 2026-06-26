import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

import { MapService } from '../../services/map.service';

interface Geosignet {
  id: string;
  name: string;
  center: [number, number];
  zoom: number;
}

const STORAGE_KEY = 'geosm_geosignets';

@Component({
  selector: 'app-geosignets',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatInputModule, MatFormFieldModule, MatListModule, MatTooltipModule, TranslateModule,
  ],
  templateUrl: './geosignets.component.html',
  styleUrl: './geosignets.component.scss',
})
export class GeosignetsComponent implements OnInit {
  private readonly mapService = inject(MapService);

  readonly bookmarks = signal<Geosignet[]>([]);
  bookmarkName = '';

  ngOnInit(): void {
    this.loadBookmarks();
  }

  saveCurrentView(): void {
    if (!this.bookmarkName.trim()) return;

    const center = this.mapService.getCenter() as [number, number];
    const zoom = this.mapService.getZoom();

    const bookmark: Geosignet = {
      id: Date.now().toString(),
      name: this.bookmarkName.trim(),
      center,
      zoom,
    };

    this.bookmarks.update((bm) => [...bm, bookmark]);
    this.persistBookmarks();
    this.bookmarkName = '';
  }

  flyTo(bookmark: Geosignet): void {
    this.mapService.zoomTo(bookmark.center, bookmark.zoom);
  }

  delete(id: string): void {
    this.bookmarks.update((bm) => bm.filter((b) => b.id !== id));
    this.persistBookmarks();
  }

  private loadBookmarks(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.bookmarks.set(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
  }

  private persistBookmarks(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.bookmarks()));
  }
}
