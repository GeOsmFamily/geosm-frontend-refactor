import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AnalyticsService } from './analytics.service';
import { ApiService } from './api.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['post']);

    TestBed.configureTestingModule({
      providers: [AnalyticsService, { provide: ApiService, useValue: apiSpy }],
    });

    service = TestBed.inject(AnalyticsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('trackEvent', () => {
    // Régression : ce service pointait auparavant vers /analytics/events (jamais existé
    // côté backend, échouait silencieusement en 404) - vérifie que la vraie route body-based
    // /analytics/track est utilisée.
    it('should POST to /analytics/track with the event payload', () => {
      apiSpy.post.and.returnValue(of(undefined));
      const dto = { instanceId: 'inst-1', eventType: 'layer_activated', layerId: 'layer-1' };

      service.trackEvent(dto).subscribe();

      expect(apiSpy.post).toHaveBeenCalledWith('/analytics/track', dto);
    });
  });

  describe('incrementView', () => {
    // Régression : pointait auparavant vers /analytics/views/:type/:id (jamais existé) -
    // vérifie que la vraie route body-based /analytics/view est utilisée.
    it('should POST to /analytics/view with type and id in the body', () => {
      apiSpy.post.and.returnValue(of(undefined));

      service.incrementView('layer', 'layer-1').subscribe();

      expect(apiSpy.post).toHaveBeenCalledWith('/analytics/view', { type: 'layer', id: 'layer-1' });
    });
  });
});
