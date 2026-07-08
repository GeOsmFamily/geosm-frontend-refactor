import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SearchService } from './search.service';
import { ApiService } from './api.service';

describe('SearchService', () => {
  let service: SearchService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get']);

    TestBed.configureTestingModule({
      providers: [SearchService, { provide: ApiService, useValue: apiSpy }],
    });

    service = TestBed.inject(SearchService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('globalSearch', () => {
    it('should call /search with query and limit', () => {
      apiSpy.get.and.returnValue(of([]));
      service.globalSearch('hopital', 5);
      expect(apiSpy.get).toHaveBeenCalledWith('/search', { q: 'hopital', limit: 5 });
    });
  });

  describe('searchLayers', () => {
    it('should call /search/layers with instance scoping', () => {
      apiSpy.get.and.returnValue(of({}));
      service.searchLayers('hop', 'inst-1', 10);
      expect(apiSpy.get).toHaveBeenCalledWith('/search/layers', {
        q: 'hop',
        instanceId: 'inst-1',
        limit: 10,
      });
    });
  });

  describe('searchFeatures', () => {
    it('should call /search/features scoped to a layer', () => {
      apiSpy.get.and.returnValue(of({}));
      service.searchFeatures('hop', 'layer-1');
      expect(apiSpy.get).toHaveBeenCalledWith('/search/features', {
        q: 'hop',
        layerId: 'layer-1',
        limit: undefined,
      });
    });
  });

  describe('getSuggestions', () => {
    it('should call /search/suggestions for the given instance', (done) => {
      const suggestions = [{ id: 'l1', name: 'Hôpitaux', description: null }];
      apiSpy.get.and.returnValue(of(suggestions));

      service.getSuggestions('inst-1', 5).subscribe((result) => {
        expect(result).toEqual(suggestions);
        expect(apiSpy.get).toHaveBeenCalledWith('/search/suggestions', {
          instanceId: 'inst-1',
          limit: 5,
        });
        done();
      });
    });
  });

  describe('getLayerRecommendations', () => {
    it('should call /search/layer-recommendations for co-activated layers', (done) => {
      const recommendations = [{ id: 'l2', name: 'Écoles', description: null, coUserCount: 3 }];
      apiSpy.get.and.returnValue(of(recommendations));

      service.getLayerRecommendations('layer-1', 'inst-1', 5).subscribe((result) => {
        expect(result).toEqual(recommendations);
        expect(apiSpy.get).toHaveBeenCalledWith('/search/layer-recommendations', {
          layerId: 'layer-1',
          instanceId: 'inst-1',
          limit: 5,
        });
        done();
      });
    });
  });
});
