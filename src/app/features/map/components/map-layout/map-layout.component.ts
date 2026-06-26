import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { MapViewComponent } from '../map-view/map-view.component';
import { LayerPanelComponent } from '../../../../features/layers/components/layer-panel/layer-panel.component';
import { ToolPanelComponent } from '../../../../features/tools/tool-panel/tool-panel.component';
import { SearchBarComponent } from '../../../../features/search/components/search-bar/search-bar.component';
import { transformExtent } from 'ol/proj';
import { MapService } from '../../services/map.service';
import { AuthService } from '../../../../core/services/auth.service';
import { InstanceService } from '../../../../core/services/instance.service';
import { ApiService } from '../../../../core/services/api.service';
import { Instance } from '../../../../core/models/index';
import { environment } from '../../../../../environments/environment';
import { FeatureInfoComponent } from '../feature-info/feature-info.component';
import { ContextMenuComponent } from '../context-menu/context-menu.component';
import { GeosignetsComponent } from '../geosignets/geosignets.component';
import { SocialShareComponent } from '../../../../features/sharing/social-share.component';
import { LegendComponent } from '../../../../features/layers/components/legend/legend.component';
import { MapToolbarComponent } from '../map-toolbar/map-toolbar.component';

@Component({
  selector: 'app-map-layout',
  standalone: true,
  imports: [
    CommonModule,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatDividerModule,
    TranslateModule,
    MapViewComponent,
    LayerPanelComponent,
    ToolPanelComponent,
    SearchBarComponent,
    FeatureInfoComponent,
    ContextMenuComponent,
    GeosignetsComponent,
    SocialShareComponent,
    LegendComponent,
    MapToolbarComponent,
  ],
  templateUrl: './map-layout.component.html',
  styleUrl: './map-layout.component.scss',
})
export class MapLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly mapService = inject(MapService);
  private readonly instanceService = inject(InstanceService);
  private readonly apiService = inject(ApiService);
  private readonly translate = inject(TranslateService);

  readonly leftPanelOpen = signal(true);
  readonly rightPanelOpen = signal(false);
  readonly searchQuery = signal('');
  readonly currentLang = signal(environment.defaultLanguage);
  readonly availableLanguages = environment.availableLanguages;
  readonly mousePosition = this.mapService.mousePosition$;
  readonly currentUser = this.authService.currentUser$;
  currentZoom = 6;

  constructor() {
    this.authService.getProfile().subscribe();
    this.mapService.mapReady$.subscribe((ready) => {
      if (ready) {
        const map = this.mapService.getMap();
        map.getView().on('change:resolution', () => {
          this.currentZoom = Math.round(map.getView().getZoom() || 6);
        });
        this.currentZoom = Math.round(map.getView().getZoom() || 6);
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('instanceSlug');
      if (slug) {
        this.loadInstance(slug);
      }
    });
  }

  private loadInstance(slug: string): void {
    this.apiService.get<Instance>(`/instances/slug/${slug}`).subscribe({
      next: (instance) => {
        this.instanceService.setCurrentInstance(instance);
        if (instance.bbox) {
          this.mapService.fitExtent(
            transformExtent(instance.bbox, 'EPSG:4326', 'EPSG:3857'),
            [50, 50, 50, 50]
          );
        } else {
          this.mapService.zoomTo([instance.centerLon, instance.centerLat], instance.defaultZoom);
        }
      },
      error: () => {},
    });
  }

  toggleLeftPanel(): void {
    this.leftPanelOpen.update((v) => !v);
    setTimeout(() => this.mapService.getMap()?.updateSize(), 300);
  }

  toggleRightPanel(): void {
    this.rightPanelOpen.update((v) => !v);
    setTimeout(() => this.mapService.getMap()?.updateSize(), 300);
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  switchLanguage(lang: string): void {
    this.currentLang.set(lang);
    this.translate.use(lang);
  }

  logout(): void {
    this.authService.logout();
  }

  navigateToProfile(): void {
    // Profile navigation placeholder
  }
}
