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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { filter, take } from 'rxjs';

import { MapViewComponent } from '../map-view/map-view.component';
import { LayerPanelComponent } from '../../../../features/layers/components/layer-panel/layer-panel.component';
import { SearchBarComponent } from '../../../../features/search/components/search-bar/search-bar.component';
import { transformExtent } from 'ol/proj';
import { MapService } from '../../services/map.service';
import { AuthService } from '../../../../core/services/auth.service';
import { InstanceService } from '../../../../core/services/instance.service';
import { ApiService } from '../../../../core/services/api.service';
import { Instance, GeocodingResult, Role } from '../../../../core/models/index';
import { environment } from '../../../../../environments/environment';
import { FeatureInfoComponent } from '../feature-info/feature-info.component';
import { ContextMenuComponent } from '../context-menu/context-menu.component';
import { GeosignetsComponent } from '../geosignets/geosignets.component';
import { MyMapsComponent } from '../my-maps/my-maps.component';
import { AssistantChatComponent } from '../assistant-chat/assistant-chat.component';
import { LegendComponent } from '../../../../features/layers/components/legend/legend.component';

import { MapToolbarComponent } from '../map-toolbar/map-toolbar.component';
import { ToolActionService } from '../../../../core/services/tool-action.service';
import { BaseMapSwitcherComponent } from '../../../../features/layers/components/base-map-switcher/base-map-switcher.component';
import { SettingsComponent } from '../settings/settings.component';
import { InfoPanelComponent } from '../info-panel/info-panel.component';
import { GeocodingService } from '../../../../core/services/geocoding.service';
import { RoutingService } from '../../../../core/services/routing.service';


import { DrawingToolComponent } from '../../../../features/tools/drawing/drawing-tool.component';
import { MeasureToolComponent } from '../../../../features/tools/measure/measure-tool.component';
import { RoutingToolComponent } from '../../../../features/tools/routing/routing-tool.component';
import { ExportToolComponent } from '../../../../features/tools/export/export-tool.component';
import { PrintToolComponent } from '../../../../features/tools/print/print-tool.component';
import { CommentToolComponent } from '../../../../features/tools/comment/comment-tool.component';
import { AltimetryToolComponent } from '../../../../features/tools/altimetry/altimetry-tool.component';
import { MapillaryToolComponent } from '../../../../features/tools/mapillary/mapillary-tool.component';
import { CompareToolComponent } from '../../../../features/tools/compare/compare-tool.component';
import { StatisticsToolComponent } from '../../../../features/tools/statistics/statistics-tool.component';
import { PlanLocalisationToolComponent } from '../../../../features/tools/plan-localisation/plan-localisation-tool.component';
import { SpatialAnalysisToolComponent } from '../../../../features/tools/spatial-analysis/spatial-analysis-tool.component';
import { NearestSearchToolComponent } from '../../../../features/tools/nearest-search/nearest-search-tool.component';
import { AnalyticsService } from '../../../../core/services/analytics.service';

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
    MatSnackBarModule,
    TranslateModule,
    MapViewComponent,
    LayerPanelComponent,
    SearchBarComponent,
    FeatureInfoComponent,
    ContextMenuComponent,
    GeosignetsComponent,
    MyMapsComponent,
    AssistantChatComponent,
    LegendComponent,

    MapToolbarComponent,
    DrawingToolComponent,
    MeasureToolComponent,
    RoutingToolComponent,
    ExportToolComponent,
    PrintToolComponent,
    CommentToolComponent,
    AltimetryToolComponent,
    MapillaryToolComponent,
    CompareToolComponent,
    StatisticsToolComponent,
    PlanLocalisationToolComponent,
    SpatialAnalysisToolComponent,
    NearestSearchToolComponent,
    BaseMapSwitcherComponent,
    SettingsComponent,
    InfoPanelComponent,
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
  private readonly toolAction = inject(ToolActionService);
  private readonly geocodingService = inject(GeocodingService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly routingService = inject(RoutingService);
  private readonly analyticsService = inject(AnalyticsService);

  readonly locationInfoLoading = signal(false);
  readonly shareModalOpen = signal(false);
  readonly shareUrlText = signal('');

  readonly leftPanelOpen = signal(true);
  readonly geosignetsOpen = signal(false);
  readonly myMapsOpen = signal(false);
  readonly assistantOpen = signal(false);
  readonly shareOpen = signal(false);
  readonly toolsMenuOpen = signal(false);
  readonly baseMapsOpen = signal(false);
  readonly settingsOpen = signal(false);
  readonly infoOpen = signal(false);
  readonly locationInfoOpen = signal(false);
  readonly locationInfo = signal<GeocodingResult | null>(null);
  readonly activeTool = signal<string | null>(null);

  readonly searchQuery = signal('');
  readonly currentLang = signal(environment.defaultLanguage);
  readonly availableLanguages = environment.availableLanguages;
  readonly mousePosition = this.mapService.mousePosition$;
  readonly currentUser = this.authService.currentUser$;
  currentZoom = 6;


  readonly tools = [
    { id: 'drawing', icon: 'draw', label: 'tools.drawing' },
    { id: 'measure', icon: 'straighten', label: 'right_menu.tools.mesure.title' },
    { id: 'routing', icon: 'directions', label: 'right_menu.map_routing.title' },
    { id: 'export', icon: 'download', label: 'right_menu.download_data.title' },
    { id: 'print', icon: 'print', label: 'right_menu.tools.print.title' },
    { id: 'comment', icon: 'comment', label: 'right_menu.tools.comment.title' },
    { id: 'altimetry', icon: 'terrain', label: 'right_menu.tools.altimetry.title' },
    { id: 'mapillary', icon: 'streetview', label: 'naviguation_tools.mappilary' },
    { id: 'compare', icon: 'compare', label: 'compare_maps.compare' },
    { id: 'statistics', icon: 'bar_chart', label: 'tools.statistics' },
    { id: 'plan-localisation', icon: 'my_location', label: 'tools.planLocalisation' },
    { id: 'spatial-analysis', icon: 'blur_circular', label: 'tools.spatialAnalysis' },
    { id: 'nearest-search', icon: 'social_distance', label: 'tools.nearestSearch' },
  ];

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
      } else {
        this.loadDefaultInstance();
      }
    });

    this.route.queryParams.subscribe((queryParams) => {
      const lat = queryParams['lat'];
      const lon = queryParams['lon'];
      const zoom = queryParams['z'] || queryParams['zoom'];
      if (lat && lon) {
        this.mapService.mapReady$
          .pipe(
            filter((ready) => ready === true),
            take(1)
          )
          .subscribe(() => {
            setTimeout(() => {
              const numLat = Number.parseFloat(lat);
              const numLon = Number.parseFloat(lon);
              const numZoom = zoom ? Number.parseInt(zoom, 10) : 15;
              this.mapService.zoomTo([numLon, numLat], numZoom);
              this.queryReverseGeocoding(numLat, numLon);
            }, 500);
          });
      }
      // Retour du flux de liaison du compte OpenStreetMap (voir GET /auth/osm/callback côté
      // backend, qui redirige vers /map?openSettings=1&osmLinked=1 après avoir lié le compte).
      if (queryParams['openSettings']) {
        this.settingsOpen.set(true);
        if (queryParams['osmLinked']) {
          this.snackBar.open(this.translate.instant('auth.osmLinkedSuccess') || 'Compte OpenStreetMap lié avec succès', 'OK', { duration: 3000 });
        } else if (queryParams['osmError']) {
          this.snackBar.open(this.translate.instant('auth.osmLinkError') || 'Erreur lors de la liaison du compte OpenStreetMap', 'OK', { duration: 4000 });
        }
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });

    this.toolAction.action$.subscribe((action) => {
      if (action.tool === 'location-info') {
        if (action.action === 'show') {
          const coords = action.data as { lat: number; lon: number };
          this.queryReverseGeocoding(coords.lat, coords.lon);
        }
      } else if (action.tool) {
        if (action.tool === 'routing') {
          const lonLat = action.data as [number, number];
          if (action.action === 'setStart') {
            this.routingService.startCoord = lonLat;
          } else if (action.action === 'setEnd') {
            this.routingService.endCoord = lonLat;
          }
        }
        this.activeTool.set(action.tool);
        this.geosignetsOpen.set(false);
        this.myMapsOpen.set(false);
        this.assistantOpen.set(false);
        this.shareOpen.set(false);
        this.toolsMenuOpen.set(false);
        this.baseMapsOpen.set(false);
        this.settingsOpen.set(false);
        this.infoOpen.set(false);
        this.locationInfoOpen.set(false);
      }
    });
  }

  private queryReverseGeocoding(lat: number, lon: number): void {
    this.locationInfoLoading.set(true);
    this.locationInfo.set(null);
    this.locationInfoOpen.set(true);
    this.activeTool.set(null);
    this.geosignetsOpen.set(false);
    this.myMapsOpen.set(false);
    this.assistantOpen.set(false);
    this.shareOpen.set(false);
    this.toolsMenuOpen.set(false);
    this.baseMapsOpen.set(false);
    this.settingsOpen.set(false);

    this.geocodingService.reverse(lat, lon).subscribe({
      next: (res: any) => {
        this.locationInfo.set({
          ...res,
          displayName: res.displayName || res.display_name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
          lat,
          lon
        });
        this.locationInfoLoading.set(false);
      },
      error: () => {
        this.locationInfo.set({
          displayName: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
          lat,
          lon
        } as any);
        this.locationInfoLoading.set(false);
      }
    });
  }


  private loadDefaultInstance(): void {
    this.instanceService.list({ limit: 10, isActive: true }).subscribe({
      next: (res) => {
        const instances = res.data || [];
        if (instances.length > 0) {
          this.router.navigate(['/map', instances[0].slug]);
        } else {
          this.router.navigate(['/map', 'cameroon']);
        }
      },
      error: () => {
        this.router.navigate(['/map', 'cameroon']);
      }
    });
  }

  private loadInstance(slug: string): void {
    this.apiService.get<Instance>(`/instances/slug/${slug}`).subscribe({
      next: (instance) => {
        this.instanceService.setCurrentInstance(instance);
        // La carte OpenLayers n'est créée que dans MapViewComponent.ngAfterViewInit(),
        // qui s'exécute APRÈS ce ngOnInit parent. Comme cet appel HTTP local peut
        // répondre avant que la carte existe, on attend mapReady$ (même pattern que
        // le flux lat/lon ci-dessus) pour éviter un recentrage silencieusement perdu.
        this.mapService.mapReady$
          .pipe(
            filter((ready) => ready === true),
            take(1)
          )
          .subscribe(() => {
            if (instance?.bbox && instance?.bbox?.length === 4) {
              this.mapService.fitExtent(
                transformExtent(instance.bbox, 'EPSG:4326', 'EPSG:3857'),
                [50, 50, 50, 50]
              );
            } else {
              this.mapService.zoomTo([instance.centerLon, instance.centerLat], instance.defaultZoom);
            }
          });
      },
      error: () => {},
    });
  }

  toggleLeftPanel(): void {
    this.leftPanelOpen.update((v) => !v);
    setTimeout(() => this.mapService.getMap()?.updateSize(), 300);
  }

  toggleGeosignets(): void {
    const open = !this.geosignetsOpen();
    this.geosignetsOpen.set(open);
    if (open) {
      this.myMapsOpen.set(false);
      this.assistantOpen.set(false);
      this.shareOpen.set(false);
      this.toolsMenuOpen.set(false);
      this.baseMapsOpen.set(false);
      this.settingsOpen.set(false);
      this.infoOpen.set(false);
      this.locationInfoOpen.set(false);
      this.activeTool.set(null);
    }
  }

  closeGeosignets(): void {
    this.geosignetsOpen.set(false);
  }

  toggleMyMaps(): void {
    const open = !this.myMapsOpen();
    this.myMapsOpen.set(open);
    if (open) {
      this.geosignetsOpen.set(false);
      this.assistantOpen.set(false);
      this.shareOpen.set(false);
      this.toolsMenuOpen.set(false);
      this.baseMapsOpen.set(false);
      this.settingsOpen.set(false);
      this.infoOpen.set(false);
      this.locationInfoOpen.set(false);
      this.activeTool.set(null);
    }
  }

  closeMyMaps(): void {
    this.myMapsOpen.set(false);
  }

  toggleAssistant(): void {
    const open = !this.assistantOpen();
    this.assistantOpen.set(open);
    if (open) {
      this.geosignetsOpen.set(false);
      this.myMapsOpen.set(false);
      this.shareOpen.set(false);
      this.toolsMenuOpen.set(false);
      this.baseMapsOpen.set(false);
      this.settingsOpen.set(false);
      this.infoOpen.set(false);
      this.locationInfoOpen.set(false);
      this.activeTool.set(null);
    }
  }

  closeAssistant(): void {
    this.assistantOpen.set(false);
  }

  toggleShare(): void {
    const open = !this.shareOpen();
    this.shareOpen.set(open);
    if (open) {
      this.geosignetsOpen.set(false);
      this.myMapsOpen.set(false);
      this.assistantOpen.set(false);
      this.toolsMenuOpen.set(false);
      this.baseMapsOpen.set(false);
      this.settingsOpen.set(false);
      this.infoOpen.set(false);
      this.locationInfoOpen.set(false);
      this.activeTool.set(null);
    }
  }

  closeShare(): void {
    this.shareOpen.set(false);
  }

  toggleToolsMenu(): void {
    const open = !this.toolsMenuOpen();
    this.toolsMenuOpen.set(open);
    if (open) {
      this.geosignetsOpen.set(false);
      this.myMapsOpen.set(false);
      this.assistantOpen.set(false);
      this.shareOpen.set(false);
      this.baseMapsOpen.set(false);
      this.settingsOpen.set(false);
      this.infoOpen.set(false);
      this.locationInfoOpen.set(false);
      this.activeTool.set(null);
    }
  }

  closeToolsMenu(): void {
    this.toolsMenuOpen.set(false);
  }

  toggleBaseMaps(): void {
    const open = !this.baseMapsOpen();
    this.baseMapsOpen.set(open);
    if (open) {
      this.geosignetsOpen.set(false);
      this.myMapsOpen.set(false);
      this.assistantOpen.set(false);
      this.shareOpen.set(false);
      this.toolsMenuOpen.set(false);
      this.settingsOpen.set(false);
      this.infoOpen.set(false);
      this.locationInfoOpen.set(false);
      this.activeTool.set(null);
    }
  }

  closeBaseMaps(): void {
    this.baseMapsOpen.set(false);
  }

  toggleSettings(): void {
    const open = !this.settingsOpen();
    this.settingsOpen.set(open);
    if (open) {
      this.geosignetsOpen.set(false);
      this.myMapsOpen.set(false);
      this.assistantOpen.set(false);
      this.shareOpen.set(false);
      this.toolsMenuOpen.set(false);
      this.baseMapsOpen.set(false);
      this.infoOpen.set(false);
      this.locationInfoOpen.set(false);
      this.activeTool.set(null);
    }
  }

  closeSettings(): void {
    this.settingsOpen.set(false);
  }

  toggleInfo(): void {
    const open = !this.infoOpen();
    this.infoOpen.set(open);
    if (open) {
      this.geosignetsOpen.set(false);
      this.myMapsOpen.set(false);
      this.assistantOpen.set(false);
      this.shareOpen.set(false);
      this.toolsMenuOpen.set(false);
      this.baseMapsOpen.set(false);
      this.settingsOpen.set(false);
      this.locationInfoOpen.set(false);
      this.activeTool.set(null);
    }
  }

  closeInfo(): void {
    this.infoOpen.set(false);
  }

  closeLocationInfo(): void {
    this.locationInfoOpen.set(false);
  }

  setRouteStartFromInfo(): void {
    const info = this.locationInfo();
    if (!info) return;
    this.toolAction.emit({
      tool: 'routing',
      action: 'setStart',
      data: [info.lon, info.lat]
    });
    this.closeLocationInfo();
  }

  setRouteEndFromInfo(): void {
    const info = this.locationInfo();
    if (!info) return;
    this.toolAction.emit({
      tool: 'routing',
      action: 'setEnd',
      data: [info.lon, info.lat]
    });
    this.closeLocationInfo();
  }

  shareLocation(): void {
    const info = this.locationInfo();
    if (!info) return;

    const map = this.mapService.getMap();
    const zoom = Math.round(map?.getView()?.getZoom() || 15);
    const baseUrl = globalThis.location.origin + globalThis.location.pathname;
    const shareUrl = `${baseUrl}?lat=${info.lat}&lon=${info.lon}&z=${zoom}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
      this.shareUrlText.set(shareUrl);
      this.shareModalOpen.set(true);
    });
  }

  closeShareModal(): void {
    this.shareModalOpen.set(false);
  }

  // Déclenché par app-geosignets (shareRequested) - le lien a déjà été copié dans le
  // presse-papiers côté enfant, ici on affiche juste la modale de confirmation.
  openShareModal(url: string): void {
    this.shareUrlText.set(url);
    this.shareModalOpen.set(true);
  }

  copyShareLinkFromInput(url: string): void {
    navigator.clipboard.writeText(url).then(() => {
      this.snackBar.open(
        'Lien de partage copié dans le presse-papiers !',
        'OK',
        { duration: 2000 }
      );
    });
  }

  toggleCompareTool(): void {
    if (this.activeTool() === 'compare') {
      this.closeActiveTool();
    } else {
      this.selectTool('compare');
    }
  }

  selectTool(toolId: string): void {
    this.activeTool.set(toolId);
    this.toolsMenuOpen.set(false);
    this.geosignetsOpen.set(false);
    this.myMapsOpen.set(false);
    this.assistantOpen.set(false);
    this.shareOpen.set(false);
    this.baseMapsOpen.set(false);
    this.settingsOpen.set(false);
    this.infoOpen.set(false);
    this.locationInfoOpen.set(false);
    this.trackToolOpened(toolId);
  }

  private trackToolOpened(toolId: string): void {
    const instanceId = this.instanceService.currentInstance$.value?.id;
    if (!instanceId) return;
    this.analyticsService.trackEvent({ instanceId, eventType: 'tool_opened', metadata: { toolId } }).subscribe({ error: () => {} });
  }

  closeActiveTool(): void {
    this.activeTool.set(null);
  }

  getActiveToolLabel(): string {
    const t = this.tools.find((x) => x.id === this.activeTool());
    return t ? t.label : '';
  }

  getActiveToolIcon(): string {
    const t = this.tools.find((x) => x.id === this.activeTool());
    return t ? t.icon : 'handyman';
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  switchLanguage(lang: string): void {
    this.currentLang.set(lang);
    this.translate.use(lang);
    const slug = this.route.snapshot?.paramMap?.get('instanceSlug') || 'cameroon';
    this.loadInstance(slug);
  }

  logout(): void {
    this.authService.logout();
  }

  navigateToProfile(): void {
    this.toggleSettings();
  }

  get isAdmin(): boolean {
    const role = this.currentUser.value?.role;
    return role === Role.SUPER_ADMIN || role === Role.ADMIN_INSTANCE;
  }

  navigateToAdmin(): void {
    this.router.navigate(['/admin']);
  }
}

