import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Fill, Stroke, Style } from 'ol/style';
import { MapService } from '../../services/map.service';
import { TranslateModule } from '@ngx-translate/core';

export interface DescriptiveSheetData {
  properties: Record<string, any>;
  geometry: any;
  layerName?: string;
}

@Component({
  selector: 'app-descriptive-sheet',
  standalone: true,
  imports: [TranslateModule, CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTabsModule, MatTableModule, MatDividerModule],
  templateUrl: './descriptive-sheet.component.html',
  styleUrl: './descriptive-sheet.component.scss',
})
export class DescriptiveSheetComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly dialogRef = inject(MatDialogRef<DescriptiveSheetComponent>);
  readonly data: DescriptiveSheetData = inject(MAT_DIALOG_DATA);

  private map!: Map;
  private highlightLayer!: VectorLayer<VectorSource>;
  private highlightSource = new VectorSource();

  properties: { key: string; value: any }[] = [];
  wikipediaUrl: string | null = null;
  wikidataUrl: string | null = null;
  osmUrl: string | null = null;

  ngOnInit(): void {
    this.map = this.mapService.getMap();

    // Extract properties
    const excluded = ['geometry', 'bbox'];
    this.properties = Object.entries(this.data.properties || {})
      .filter(([k]) => !excluded.includes(k) && this.data.properties[k] != null)
      .map(([key, value]) => ({ key, value }));

    // Extract links
    const props = this.data.properties || {};
    if (props['wikipedia']) {
      const parts = (props['wikipedia'] as string).split(':');
      this.wikipediaUrl = parts.length === 2
        ? `https://${parts[0]}.wikipedia.org/wiki/${parts[1]}`
        : `https://en.wikipedia.org/wiki/${props['wikipedia']}`;
    }
    if (props['wikidata']) {
      this.wikidataUrl = `https://www.wikidata.org/wiki/${props['wikidata']}`;
    }
    if (props['osm_id']) {
      this.osmUrl = `https://www.openstreetmap.org/${props['osm_type'] || 'node'}/${props['osm_id']}`;
    }

    // Highlight geometry on map
    this.highlightLayer = new VectorLayer({
      source: this.highlightSource,
      style: new Style({
        fill: new Fill({ color: 'rgba(244, 67, 54, 0.2)' }),
        stroke: new Stroke({ color: '#f44336', width: 3 }),
      }),
    });
    this.map.addLayer(this.highlightLayer);

    if (this.data.geometry) {
      try {
        const format = new GeoJSON();
        const feature = format.readFeature(
          { type: 'Feature', geometry: this.data.geometry, properties: {} },
          { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' }
        ) as any;
        this.highlightSource.addFeature(feature);
        const extent = feature.getGeometry()!.getExtent();
        this.map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500, maxZoom: 18 });
      } catch {
        // Ignore invalid geometry
      }
    }
  }

  ngOnDestroy(): void {
    if (this.highlightLayer) {
      this.map.removeLayer(this.highlightLayer);
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  openExternal(url: string): void {
    window.open(url, '_blank');
  }
}
