import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import VectorLayer from 'ol/layer/Vector';
import TileLayer from 'ol/layer/Tile';
import Heatmap from 'ol/layer/Heatmap';

import { MapLayerService } from './map-layer.service';
import { MapService } from './map.service';
import { LayerService } from '../../../core/services/layer.service';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { InstanceService } from '../../../core/services/instance.service';
import { Layer } from '../../../core/models/index';

describe('MapLayerService', () => {
  let service: MapLayerService;
  let mapServiceSpy: jasmine.SpyObj<MapService>;
  let layerServiceSpy: jasmine.SpyObj<LayerService>;
  let analyticsServiceSpy: jasmine.SpyObj<AnalyticsService>;
  let instanceService: InstanceService;

  const makeLayer = (overrides: Partial<Layer> = {}): Layer => ({
    id: 'layer-1',
    name: 'Hôpitaux',
    sourceType: 'WMS',
    url: 'http://qgis/ows',
    sourceUrl: 'http://qgis/ows',
    tableName: 'cameroon_hopitaux',
    sourceLayer: 'cameroon:cameroon_hopitaux',
    description: '',
    bbox: null,
    tags: [],
    instanceId: 'inst-1',
    subGroupId: 'sg-1',
    geometryType: 'point',
    metadata: null,
    ...overrides,
  });

  beforeEach(() => {
    mapServiceSpy = jasmine.createSpyObj('MapService', ['addLayer', 'removeLayer']);
    layerServiceSpy = jasmine.createSpyObj('LayerService', ['getFeatures']);
    layerServiceSpy.getFeatures.and.returnValue(of({ type: 'FeatureCollection', features: [] }));
    analyticsServiceSpy = jasmine.createSpyObj('AnalyticsService', ['trackEvent']);
    analyticsServiceSpy.trackEvent.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        MapLayerService,
        { provide: MapService, useValue: mapServiceSpy },
        { provide: LayerService, useValue: layerServiceSpy },
        { provide: AnalyticsService, useValue: analyticsServiceSpy },
        InstanceService,
      ],
    });

    service = TestBed.inject(MapLayerService);
    instanceService = TestBed.inject(InstanceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('addLayer', () => {
    it('should create a vector cluster layer (+ hidden heatmap) for a point layer under the feature cap', () => {
      const layer = makeLayer({ geometryType: 'point', metadata: { featureCount: 100 } as any });

      service.addLayer(layer);

      const active = service.getActiveLayers();
      expect(active.length).toBe(1);
      expect(active[0].olLayer).toBeInstanceOf(VectorLayer);
      expect(active[0].heatmapLayer).toBeInstanceOf(Heatmap);
      expect(active[0].viewMode).toBe('cluster');
      expect(mapServiceSpy.addLayer).toHaveBeenCalledTimes(2);
    });

    it('should create a plain WMS tile layer for a non-point layer', () => {
      const layer = makeLayer({ geometryType: 'polygon' });

      service.addLayer(layer);

      const active = service.getActiveLayers();
      expect(active[0].olLayer).toBeInstanceOf(TileLayer);
      expect(active[0].heatmapLayer).toBeUndefined();
      expect(mapServiceSpy.addLayer).toHaveBeenCalledTimes(1);
    });

    it('should fall back to WMS for a point layer over the client-side feature cap', () => {
      const layer = makeLayer({ geometryType: 'point', metadata: { featureCount: 999999 } as any });

      service.addLayer(layer);

      expect(service.getActiveLayers()[0].olLayer).toBeInstanceOf(TileLayer);
    });

    it('should not add the same layer twice', () => {
      const layer = makeLayer();
      service.addLayer(layer);
      service.addLayer(layer);

      expect(service.getActiveLayers().length).toBe(1);
    });

    it('should track a layer_activated analytics event when an instance is set', () => {
      instanceService.currentInstance$.next({ id: 'inst-1' } as any);

      service.addLayer(makeLayer());

      expect(analyticsServiceSpy.trackEvent).toHaveBeenCalledWith(
        jasmine.objectContaining({ instanceId: 'inst-1', eventType: 'layer_activated', layerId: 'layer-1' }),
      );
    });

    it('should not attempt to track analytics when no instance is set (best-effort, never blocking)', () => {
      instanceService.currentInstance$.next(null);

      service.addLayer(makeLayer());

      expect(analyticsServiceSpy.trackEvent).not.toHaveBeenCalled();
    });
  });

  describe('removeLayer', () => {
    it('should remove the layer from the map and active list, and track layer_deactivated', () => {
      instanceService.currentInstance$.next({ id: 'inst-1' } as any);
      const layer = makeLayer();
      service.addLayer(layer);
      mapServiceSpy.addLayer.calls.reset();
      analyticsServiceSpy.trackEvent.calls.reset();

      service.removeLayer('layer-1');

      expect(service.getActiveLayers().length).toBe(0);
      expect(mapServiceSpy.removeLayer).toHaveBeenCalledTimes(2); // cluster + heatmap
      expect(analyticsServiceSpy.trackEvent).toHaveBeenCalledWith(
        jasmine.objectContaining({ eventType: 'layer_deactivated', layerId: 'layer-1' }),
      );
    });

    it('should do nothing if the layer is not active', () => {
      service.removeLayer('missing-layer');
      expect(mapServiceSpy.removeLayer).not.toHaveBeenCalled();
    });
  });

  describe('removeAll', () => {
    it('should remove every active layer from the map', () => {
      service.addLayer(makeLayer({ id: 'layer-1', geometryType: 'point' }));
      service.addLayer(makeLayer({ id: 'layer-2', geometryType: 'polygon' }));

      service.removeAll();

      expect(service.getActiveLayers().length).toBe(0);
    });
  });

  describe('toggleVisibility / setVisibility', () => {
    it('should toggle visibility and flip the underlying OL layer', () => {
      const layer = makeLayer({ geometryType: 'polygon' });
      service.addLayer(layer);

      service.toggleVisibility('layer-1');

      const active = service.getActiveLayers()[0];
      expect(active.visible).toBeFalse();
      expect(active.olLayer.getVisible()).toBeFalse();
    });

    it('should set visibility explicitly', () => {
      service.addLayer(makeLayer({ geometryType: 'polygon' }));

      service.setVisibility('layer-1', false);

      expect(service.getActiveLayers()[0].visible).toBeFalse();
    });
  });

  describe('setViewMode', () => {
    it('should switch a point layer between cluster and heatmap visibility without recreating layers', () => {
      service.addLayer(makeLayer({ geometryType: 'point' }));

      service.setViewMode('layer-1', 'heatmap');

      const active = service.getActiveLayers()[0];
      expect(active.viewMode).toBe('heatmap');
      expect(active.olLayer.getVisible()).toBeFalse();
      expect(active.heatmapLayer!.getVisible()).toBeTrue();
    });
  });

  describe('setOpacity', () => {
    it('should apply opacity to both the main and heatmap layers', () => {
      service.addLayer(makeLayer({ geometryType: 'point' }));

      service.setOpacity('layer-1', 0.5);

      const active = service.getActiveLayers()[0];
      expect(active.opacity).toBe(0.5);
      expect(active.olLayer.getOpacity()).toBe(0.5);
      expect(active.heatmapLayer!.getOpacity()).toBe(0.5);
    });
  });

  describe('isLayerActive', () => {
    it('should report whether a layer is currently active', () => {
      expect(service.isLayerActive('layer-1')).toBeFalse();
      service.addLayer(makeLayer());
      expect(service.isLayerActive('layer-1')).toBeTrue();
    });
  });

  describe('reorder', () => {
    it('should reorder active layers and reassign zIndex accordingly', () => {
      service.addLayer(makeLayer({ id: 'layer-1', geometryType: 'polygon' }));
      service.addLayer(makeLayer({ id: 'layer-2', geometryType: 'polygon' }));
      service.addLayer(makeLayer({ id: 'layer-3', geometryType: 'polygon' }));

      service.reorder(0, 2);

      const ids = service.getActiveLayers().map(al => al.layer.id);
      expect(ids).toEqual(['layer-2', 'layer-3', 'layer-1']);
    });
  });
});
