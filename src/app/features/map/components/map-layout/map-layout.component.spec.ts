import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { MapLayoutComponent } from './map-layout.component';
import { AuthService } from '../../../../core/services/auth.service';
import { MapService } from '../../services/map.service';

describe('MapLayoutComponent', () => {
  let component: MapLayoutComponent;
  let fixture: ComponentFixture<MapLayoutComponent>;

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('AuthService', ['getProfile', 'logout'], {
      currentUser$: of(null),
    });
    authSpy.getProfile.and.returnValue(of(null));

    const mapSpy = jasmine.createSpyObj('MapService', ['getMap'], {
      mousePosition$: of([0, 0]),
    });
    mapSpy.getMap.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [
        MapLayoutComponent,
        NoopAnimationsModule,
        RouterTestingModule,
        HttpClientTestingModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: MapService, useValue: mapSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MapLayoutComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with left panel open', () => {
    expect(component.leftPanelOpen()).toBeTrue();
  });

  it('should start with right panel closed', () => {
    expect(component.rightPanelOpen()).toBeFalse();
  });

  it('should toggle left panel', () => {
    expect(component.leftPanelOpen()).toBeTrue();
    component.toggleLeftPanel();
    expect(component.leftPanelOpen()).toBeFalse();
    component.toggleLeftPanel();
    expect(component.leftPanelOpen()).toBeTrue();
  });

  it('should toggle right panel', () => {
    expect(component.rightPanelOpen()).toBeFalse();
    component.toggleRightPanel();
    expect(component.rightPanelOpen()).toBeTrue();
  });

  it('should switch language', () => {
    component.switchLanguage('en');
    expect(component.currentLang()).toBe('en');
  });
});
