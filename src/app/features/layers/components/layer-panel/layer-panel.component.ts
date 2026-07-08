import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CatalogBrowserComponent } from '../catalog-browser/catalog-browser.component';
import { ActiveLayersComponent } from '../active-layers/active-layers.component';
import { BaseMapSwitcherComponent } from '../base-map-switcher/base-map-switcher.component';
import { TranslateModule } from '@ngx-translate/core';
import { MapLayerService } from '../../../map/services/map-layer.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-layer-panel',
  standalone: true,
  imports: [
    TranslateModule,
    MatIconModule,
    CatalogBrowserComponent,
    ActiveLayersComponent,
    BaseMapSwitcherComponent,
  ],
  templateUrl: './layer-panel.component.html',
  styleUrl: './layer-panel.component.scss',
})
export class LayerPanelComponent implements OnInit, OnDestroy {
  private readonly mapLayerService = inject(MapLayerService);
  private readonly destroy$ = new Subject<void>();

  activeTab = 0;
  activeLayerCount = 0;

  ngOnInit(): void {
    this.mapLayerService.activeLayers$.pipe(takeUntil(this.destroy$)).subscribe((layers) => {
      this.activeLayerCount = layers.length;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(index: number): void {
    this.activeTab = index;
  }
}
