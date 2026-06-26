import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { SearchBarComponent } from './search-bar.component';
import { MapService } from '../../../map/services/map.service';
import { MapLayerService } from '../../../map/services/map-layer.service';

describe('SearchBarComponent', () => {
  let component: SearchBarComponent;
  let fixture: ComponentFixture<SearchBarComponent>;

  beforeEach(async () => {
    const mapSpy = jasmine.createSpyObj('MapService', ['addLayer', 'removeLayer', 'zoomTo'], {
      mousePosition$: of([0, 0]),
    });
    const mapLayerSpy = jasmine.createSpyObj('MapLayerService', ['addLayer']);

    await TestBed.configureTestingModule({
      imports: [
        SearchBarComponent,
        NoopAnimationsModule,
        HttpClientTestingModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: MapService, useValue: mapSpy },
        { provide: MapLayerService, useValue: mapLayerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with empty search query', () => {
    expect(component.searchQuery).toBe('');
  });

  it('should start with empty results', () => {
    expect(component.geocodingResults.length).toBe(0);
    expect(component.layerResults.length).toBe(0);
  });

  it('should clear search', () => {
    component.searchQuery = 'test';
    component.clearSearch();
    expect(component.searchQuery).toBe('');
    expect(component.results.length).toBe(0);
  });

  it('should render search input', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector('input[matInput]');
    expect(input).toBeTruthy();
  });
});
