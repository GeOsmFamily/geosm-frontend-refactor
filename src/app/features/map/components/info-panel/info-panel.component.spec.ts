import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { InfoPanelComponent } from './info-panel.component';
import { FeedbackService } from '../../../../core/services/feedback.service';

describe('InfoPanelComponent', () => {
  let component: InfoPanelComponent;
  let fixture: ComponentFixture<InfoPanelComponent>;
  let feedbackServiceSpy: jasmine.SpyObj<FeedbackService>;

  beforeEach(async () => {
    feedbackServiceSpy = jasmine.createSpyObj('FeedbackService', ['submit']);

    await TestBed.configureTestingModule({
      imports: [InfoPanelComponent, NoopAnimationsModule, TranslateModule.forRoot()],
      providers: [{ provide: FeedbackService, useValue: feedbackServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(InfoPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the developer credits', () => {
    expect(component.developerName).toBe('Boris Gautier TCHOUKOUAHA');
    expect(component.developerEmail).toBe('me@borisgauty.com');
  });

  it('should not submit an invalid feedback form (description too short)', () => {
    component.feedbackForm.patchValue({ description: 'short' });
    component.submitFeedback();
    expect(feedbackServiceSpy.submit).not.toHaveBeenCalled();
  });

  it('should submit valid feedback and reset the form on success', () => {
    feedbackServiceSpy.submit.and.returnValue(
      of({
        id: 'fb-1',
        type: 'BUG',
        description: 'Map does not load correctly',
        contactEmail: null,
        page: '/map',
        userId: null,
        createdAt: '2026-07-06T00:00:00.000Z',
        status: 'NEW',
        adminNotes: null,
        reviewedAt: null,
      }),
    );
    component.feedbackForm.patchValue({ type: 'BUG', description: 'Map does not load correctly' });

    component.submitFeedback();

    expect(feedbackServiceSpy.submit).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: 'BUG', description: 'Map does not load correctly' }),
    );
    expect(component.feedbackForm.get('description')?.value).toBe('');
    expect(component.submitting()).toBeFalse();
  });

  it('should stop the submitting state on error without throwing', () => {
    feedbackServiceSpy.submit.and.returnValue(throwError(() => new Error('network error')));
    component.feedbackForm.patchValue({ type: 'BUG', description: 'Map does not load correctly' });

    component.submitFeedback();

    expect(component.submitting()).toBeFalse();
  });

  it('should point the guide PDF link at the French file when in French', () => {
    expect(component.guidePdfUrl).toContain('geosm-guide-fr.pdf');
  });
});
