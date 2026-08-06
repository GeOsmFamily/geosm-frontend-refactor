import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { InfoPanelComponent } from './info-panel.component';
import { FeedbackService } from '../../../../core/services/feedback.service';

describe('InfoPanelComponent', () => {
  let component: InfoPanelComponent;
  let fixture: ComponentFixture<InfoPanelComponent>;
  let feedbackServiceSpy: jasmine.SpyObj<FeedbackService>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    feedbackServiceSpy = jasmine.createSpyObj('FeedbackService', ['submit']);

    await TestBed.configureTestingModule({
      imports: [
        InfoPanelComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
        HttpClientTestingModule,
      ],
      providers: [{ provide: FeedbackService, useValue: feedbackServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(InfoPanelComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // ngOnInit charge assets/version.json - le flusher ici avec une valeur fixe évite que
    // chaque test doive s'en soucier individuellement (voir test dédié plus bas pour la
    // vérification du contenu affiché).
    httpMock.expectOne('assets/version.json').flush({
      major: 1,
      minor: 0,
      build: 42,
      codename: 'Atlas',
      month: 'AUG',
      year: 2026,
      full: 'GeOsm 1.0.42 - Atlas.AUG.2026',
    });
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch and expose the version info', () => {
    expect(component.version()?.full).toBe('GeOsm 1.0.42 - Atlas.AUG.2026');
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
