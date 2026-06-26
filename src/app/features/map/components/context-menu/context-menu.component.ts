import { Component, inject, signal, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { toLonLat } from 'ol/proj';

import { MapService } from '../../services/map.service';

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatSnackBarModule, TranslateModule],
  templateUrl: './context-menu.component.html',
  styleUrl: './context-menu.component.scss',
})
export class ContextMenuComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly elRef = inject(ElementRef);

  readonly visible = signal(false);
  readonly menuX = signal(0);
  readonly menuY = signal(0);
  readonly coordinates = signal<[number, number]>([0, 0]);

  private subscription!: Subscription;

  ngOnInit(): void {
    this.subscription = this.mapService.mapReady$.subscribe((ready) => {
      if (ready) {
        this.setupContextMenu();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.visible.set(false);
  }

  private setupContextMenu(): void {
    const map = this.mapService.getMap();
    const viewport = map.getViewport();

    viewport.addEventListener('contextmenu', (e: Event) => {
      e.preventDefault();
      const mouseEvent = e as MouseEvent;
      const pixel = map.getEventPixel(mouseEvent);
      const coord = map.getCoordinateFromPixel(pixel);
      const lonLat = toLonLat(coord) as [number, number];

      this.coordinates.set(lonLat);
      this.menuX.set(mouseEvent.clientX);
      this.menuY.set(mouseEvent.clientY);
      this.visible.set(true);
    });
  }

  copyCoordinates(): void {
    const [lon, lat] = this.coordinates();
    const text = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    navigator.clipboard.writeText(text).then(() => {
      this.snackBar.open(
        this.translate.instant('contextMenu.coordsCopied'),
        'OK',
        { duration: 2000 }
      );
    });
    this.visible.set(false);
  }

  routeFrom(): void {
    // Placeholder: integrate with routing service
    this.visible.set(false);
  }

  routeTo(): void {
    // Placeholder: integrate with routing service
    this.visible.set(false);
  }

  queryInfo(): void {
    const coord = this.coordinates();
    this.mapService.onClick$.subscribe(); // trigger feature info via map click simulation
    this.visible.set(false);
  }

  addComment(): void {
    // Placeholder: integrate with comment tool
    this.visible.set(false);
  }
}
