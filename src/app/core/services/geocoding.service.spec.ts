import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { GeocodingService } from './geocoding.service';
import { ApiService } from './api.service';
import { GeocodingResult } from '../models/index';

describe('GeocodingService', () => {
  let service: GeocodingService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const mockResult: GeocodingResult = {
    placeId: '1',
    displayName: 'Douala, Littoral, Cameroun',
    lat: 4.05,
    lon: 9.7,
    boundingbox: [4.0, 4.1, 9.6, 9.8],
    type: 'city',
    importance: 0.8,
    address: { city: 'Douala', country: 'Cameroun' }
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get']);

    TestBed.configureTestingModule({
      providers: [
        GeocodingService,
        { provide: ApiService, useValue: apiSpy },
      ],
    });

    service = TestBed.inject(GeocodingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('search', () => {
    it('should query /geocode/search with query string and options', () => {
      const mockResultList = [mockResult];
      apiSpy.get.and.returnValue(of(mockResultList));

      service.search('Douala', { limit: 5 }).subscribe((res) => {
        expect(res).toEqual(mockResultList);
      });

      expect(apiSpy.get).toHaveBeenCalledWith('/geocode/search', { q: 'Douala', limit: 5 });
    });
  });

  describe('reverse', () => {
    it('should query /geocode/reverse with lat and lon', () => {
      apiSpy.get.and.returnValue(of(mockResult));

      service.reverse(4.05, 9.7).subscribe((res) => {
        expect(res).toEqual(mockResult);
      });

      expect(apiSpy.get).toHaveBeenCalledWith('/geocode/reverse', { lat: 4.05, lon: 9.7 });
    });
  });

  describe('lookup', () => {
    it('should query /geocode/lookup with joined osm ids', () => {
      const mockResultList = [mockResult];
      apiSpy.get.and.returnValue(of(mockResultList));

      service.lookup(['N123', 'W456']).subscribe((res) => {
        expect(res).toEqual(mockResultList);
      });

      expect(apiSpy.get).toHaveBeenCalledWith('/geocode/lookup', { osm_ids: 'N123,W456' });
    });
  });
});
