import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FeedbackService } from './feedback.service';
import { ApiService } from './api.service';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['post']);

    TestBed.configureTestingModule({
      providers: [FeedbackService, { provide: ApiService, useValue: apiSpy }],
    });

    service = TestBed.inject(FeedbackService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('submit', () => {
    it('should POST to /feedback with the submission payload', (done) => {
      const submission = {
        id: 'fb-1',
        type: 'BUG' as const,
        description: 'Map does not load',
        contactEmail: null,
        page: '/map',
        userId: null,
        createdAt: '2026-07-06T00:00:00.000Z',
        status: 'NEW' as const,
        adminNotes: null,
        reviewedAt: null,
      };
      apiSpy.post.and.returnValue(of(submission));

      service
        .submit({ type: 'BUG', description: 'Map does not load', page: '/map' })
        .subscribe((result) => {
          expect(result).toEqual(submission);
          expect(apiSpy.post).toHaveBeenCalledWith('/feedback', {
            type: 'BUG',
            description: 'Map does not load',
            page: '/map',
          });
          done();
        });
    });
  });
});
