import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import Map from 'ol/Map.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { Fill, Stroke, Style, Icon, Text } from 'ol/style.js';
import { MapBrowserEvent } from 'ol';

import { MapService } from '../../map/services/map.service.js';

interface MapComment {
  id: number;
  text: string;
  lon: number;
  lat: number;
  feature: Feature;
}

@Component({
  selector: 'app-comment-tool',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatDividerModule,
    MatListModule,
  ],
  templateUrl: './comment-tool.component.html',
  styleUrl: './comment-tool.component.scss',
})
export class CommentToolComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);

  private map!: Map;
  private vectorSource = new VectorSource();
  private vectorLayer!: VectorLayer<VectorSource>;
  private clickListener: ((evt: any) => void) | null = null;
  private counter = 0;

  comments: MapComment[] = [];
  commentText = '';
  isPlacing = false;
  pendingCoord: [number, number] | null = null;

  ngOnInit(): void {
    this.map = this.mapService.getMap();
    this.vectorLayer = new VectorLayer({
      source: this.vectorSource,
      style: (feature) => {
        const label = (feature.get('label') as string) || '';
        return new Style({
          image: new Icon({
            anchor: [0.5, 1],
            src: 'data:image/svg+xml,' + encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="%23e53935" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'
            ),
            scale: 1.5,
          }),
          text: label
            ? new Text({
                text: label.length > 20 ? label.substring(0, 20) + '...' : label,
                font: '12px sans-serif',
                fill: new Fill({ color: '#333' }),
                stroke: new Stroke({ color: '#fff', width: 3 }),
                offsetY: 12,
              })
            : undefined,
        });
      },
    });
    this.map.addLayer(this.vectorLayer);
  }

  ngOnDestroy(): void {
    this.stopPlacing();
    if (this.vectorLayer) {
      this.map.removeLayer(this.vectorLayer);
    }
  }

  startPlacing(): void {
    this.stopPlacing();
    this.isPlacing = true;

    this.clickListener = (evt: any) => {
      const lonLat = toLonLat(evt.coordinate) as [number, number];
      this.pendingCoord = lonLat;
      this.isPlacing = false;
      if (this.clickListener) {
        this.map.un('singleclick', this.clickListener);
        this.clickListener = null;
      }
    };

    this.map.on('singleclick', this.clickListener);
  }

  stopPlacing(): void {
    if (this.clickListener) {
      this.map.un('singleclick', this.clickListener);
      this.clickListener = null;
    }
    this.isPlacing = false;
  }

  addComment(): void {
    if (!this.pendingCoord || !this.commentText.trim()) return;

    this.counter++;
    const [lon, lat] = this.pendingCoord;

    const feature = new Feature(new Point(fromLonLat(this.pendingCoord)));
    feature.set('label', this.commentText.trim());
    feature.setId(`comment-${this.counter}`);
    this.vectorSource.addFeature(feature);

    this.comments.push({
      id: this.counter,
      text: this.commentText.trim(),
      lon,
      lat,
      feature,
    });

    this.commentText = '';
    this.pendingCoord = null;
  }

  navigateTo(comment: MapComment): void {
    this.mapService.zoomTo([comment.lon, comment.lat], 16);
  }

  deleteComment(comment: MapComment): void {
    this.vectorSource.removeFeature(comment.feature);
    this.comments = this.comments.filter(c => c.id !== comment.id);
  }
}
