import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { CatalogBrowserComponent } from '../catalog-browser/catalog-browser.component.js';
import { ActiveLayersComponent } from '../active-layers/active-layers.component.js';
import { BaseMapSwitcherComponent } from '../base-map-switcher/base-map-switcher.component.js';

@Component({
  selector: 'app-layer-panel',
  standalone: true,
  imports: [
    MatTabsModule,
    MatIconModule,
    CatalogBrowserComponent,
    ActiveLayersComponent,
    BaseMapSwitcherComponent,
  ],
  templateUrl: './layer-panel.component.html',
  styleUrl: './layer-panel.component.scss',
})
export class LayerPanelComponent {}
