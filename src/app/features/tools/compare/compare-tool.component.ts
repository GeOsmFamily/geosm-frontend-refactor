import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';
import Map from 'ol/Map.js';
import { Subscription } from 'rxjs';
import { MapService } from '../../map/services/map.service';
import { MapLayerService, ActiveLayer } from '../../map/services/map-layer.service';
import type { Layer } from 'ol/layer';
import type RenderEvent from 'ol/render/Event';

@Component({
  selector: 'app-compare-tool',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule, MatDividerModule, TranslateModule],
  templateUrl: './compare-tool.component.html',
  styleUrl: './compare-tool.component.scss',
})
export class CompareToolComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly mapLayerService = inject(MapLayerService);
  private map!: Map;
  private subscription!: Subscription;

  activeLayers: ActiveLayer[] = [];
  leftLayerId: string | null = null;
  rightLayerId: string | null = null;
  comparing = false;
  swipePosition = 50;

  private leftLayer: Layer | null = null;
  private rightLayer: Layer | null = null;
  private leftPrerender: ((evt: RenderEvent) => void) | null = null;
  private leftPostrender: ((evt: RenderEvent) => void) | null = null;
  private rightPrerender: ((evt: RenderEvent) => void) | null = null;
  private rightPostrender: ((evt: RenderEvent) => void) | null = null;
  private swipeListener: ((evt: MouseEvent) => void) | null = null;
  private swipeEndListener: (() => void) | null = null;
  private dragging = false;

  ngOnInit(): void {
    this.map = this.mapService.getMap();
    this.subscription = this.mapLayerService.activeLayers$.subscribe(layers => {
      this.activeLayers = layers;
    });
  }

  ngOnDestroy(): void {
    this.resetCompare();
    this.subscription?.unsubscribe();
  }

  startCompare(): void {
    if (!this.leftLayerId || !this.rightLayerId) return;

    const leftActive = this.activeLayers.find(al => al.layer.id === this.leftLayerId);
    const rightActive = this.activeLayers.find(al => al.layer.id === this.rightLayerId);
    if (!leftActive?.olLayer || !rightActive?.olLayer) return;

    this.leftLayer = leftActive.olLayer;
    this.rightLayer = rightActive.olLayer;
    this.comparing = true;

    this.leftPrerender = (event: RenderEvent) => {
      const ctx = event.context as CanvasRenderingContext2D;
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      const clipX = width * (this.swipePosition / 100);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, clipX, height);
      ctx.clip();
    };
    this.leftPostrender = (event: RenderEvent) => {
      const ctx = event.context as CanvasRenderingContext2D;
      ctx.restore();
    };

    this.rightPrerender = (event: RenderEvent) => {
      const ctx = event.context as CanvasRenderingContext2D;
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      const clipX = width * (this.swipePosition / 100);
      ctx.save();
      ctx.beginPath();
      ctx.rect(clipX, 0, width - clipX, height);
      ctx.clip();
    };
    this.rightPostrender = (event: RenderEvent) => {
      const ctx = event.context as CanvasRenderingContext2D;
      ctx.restore();
    };

    this.leftLayer.on('prerender', this.leftPrerender as any);
    this.leftLayer.on('postrender', this.leftPostrender as any);
    this.rightLayer.on('prerender', this.rightPrerender as any);
    this.rightLayer.on('postrender', this.rightPostrender as any);
    this.map.render();
  }

  onSwipeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.swipePosition = Number(input.value);
    this.map.render();
  }

  startDrag(): void {
    this.dragging = true;
    const mapEl = this.map.getTargetElement() as HTMLElement;

    this.swipeListener = (evt: MouseEvent) => {
      if (!this.dragging) return;
      const rect = mapEl.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      this.swipePosition = Math.max(0, Math.min(100, (x / rect.width) * 100));
      this.map.render();
    };

    this.swipeEndListener = () => {
      this.dragging = false;
      document.removeEventListener('mousemove', this.swipeListener!);
      document.removeEventListener('mouseup', this.swipeEndListener!);
    };

    document.addEventListener('mousemove', this.swipeListener);
    document.addEventListener('mouseup', this.swipeEndListener);
  }

  resetCompare(): void {
    if (this.leftLayer && this.leftPrerender) {
      this.leftLayer.un('prerender', this.leftPrerender as any);
      this.leftLayer.un('postrender', this.leftPostrender as any);
    }
    if (this.rightLayer && this.rightPrerender) {
      this.rightLayer.un('prerender', this.rightPrerender as any);
      this.rightLayer.un('postrender', this.rightPostrender as any);
    }
    this.leftLayer = null;
    this.rightLayer = null;
    this.comparing = false;
    this.swipePosition = 50;
    if (this.map) {
      this.map.render();
    }
  }
}
