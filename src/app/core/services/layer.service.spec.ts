import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { LayerService } from './layer.service';
import { ApiService } from './api.service';
import { Layer } from '../models/index';

describe('LayerService', () => {
  let service: LayerService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const mockLayer = { id: 'layer-1', name: 'Hôpitaux' } as unknown as Layer;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'getPaginated', 'post', 'patch', 'delete']);

    TestBed.configureTestingModule({
      providers: [
        // LayerService injecte aussi HttpClient directement (multipart pour les uploads de
        // fichiers/projets QGIS - ApiService ne gère que le JSON), pas seulement ApiService.
        provideHttpClient(),
        provideHttpClientTesting(),
        LayerService,
        { provide: ApiService, useValue: apiSpy },
      ],
    });

    service = TestBed.inject(LayerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('list', () => {
    it('should call the instance-scoped layers endpoint', () => {
      apiSpy.getPaginated.and.returnValue(
        of({ data: [mockLayer], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } }),
      );

      service.list('inst-1', { search: 'hop' });

      expect(apiSpy.getPaginated).toHaveBeenCalledWith('/instances/inst-1/layers', {
        search: 'hop',
      });
    });
  });

  describe('getById', () => {
    it('should call the single-layer endpoint', (done) => {
      apiSpy.get.and.returnValue(of(mockLayer));

      service.getById('inst-1', 'layer-1').subscribe((layer) => {
        expect(layer).toEqual(mockLayer);
        expect(apiSpy.get).toHaveBeenCalledWith('/instances/inst-1/layers/layer-1');
        done();
      });
    });
  });

  describe('create/update/delete', () => {
    it('should POST to create a layer', () => {
      apiSpy.post.and.returnValue(of(mockLayer));
      service.create('inst-1', { name: 'New' });
      expect(apiSpy.post).toHaveBeenCalledWith('/instances/inst-1/layers', { name: 'New' });
    });

    it('should PATCH to update a layer', () => {
      apiSpy.patch.and.returnValue(of(mockLayer));
      service.update('inst-1', 'layer-1', { name: 'Renamed' });
      expect(apiSpy.patch).toHaveBeenCalledWith('/instances/inst-1/layers/layer-1', {
        name: 'Renamed',
      });
    });

    it('should DELETE a layer', () => {
      apiSpy.delete.and.returnValue(of(undefined));
      service.delete('inst-1', 'layer-1');
      expect(apiSpy.delete).toHaveBeenCalledWith('/instances/inst-1/layers/layer-1');
    });
  });

  describe('resync', () => {
    it('should POST to the resync endpoint', () => {
      apiSpy.post.and.returnValue(of(mockLayer));
      service.resync('inst-1', 'layer-1');
      expect(apiSpy.post).toHaveBeenCalledWith('/instances/inst-1/layers/layer-1/resync', {});
    });
  });

  describe('getFeatures', () => {
    it('should call the top-level features endpoint (not instance-scoped)', (done) => {
      const fc = { type: 'FeatureCollection' as const, features: [] };
      apiSpy.get.and.returnValue(of(fc));

      service.getFeatures('layer-1', { bbox: '1,2,3,4' }).subscribe((result) => {
        expect(result).toEqual(fc);
        expect(apiSpy.get).toHaveBeenCalledWith('/layers/layer-1/features', { bbox: '1,2,3,4' });
        done();
      });
    });
  });
});
