import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';

import { MapLayoutComponent } from './map-layout.component';
import { AuthService } from '../../../../core/services/auth.service';
import { MapService } from '../../services/map.service';
import { ActivatedRoute } from '@angular/router';

describe('MapLayoutComponent', () => {
  let component: MapLayoutComponent;
  let fixture: ComponentFixture<MapLayoutComponent>;

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj(
      'AuthService',
      ['getProfile', 'logout', 'isAuthenticated'],
      {
        currentUser$: of(null),
      },
    );
    authSpy.getProfile.and.returnValue(of(null));
    // Le géoportail est consultable sans compte - le constructeur ne charge le profil que si
    // une session existe déjà (voir isAuthenticated()) ; false par défaut ici pour un visiteur
    // anonyme, cohérent avec currentUser$ = null.
    authSpy.isAuthenticated.and.returnValue(false);

    const mapSpy = jasmine.createSpyObj('MapService', ['getMap', 'zoomTo', 'fitExtent'], {
      mousePosition$: of([0, 0]),
      mapReady$: new BehaviorSubject(false),
    });
    mapSpy.getMap.and.returnValue(null);

    const routeSpy = {
      paramMap: of({ get: () => null }),
    };

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
        { provide: ActivatedRoute, useValue: routeSpy },
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

  it('should start with overlays closed', () => {
    expect(component.geosignetsOpen()).toBeFalse();
    expect(component.shareOpen()).toBeFalse();
    expect(component.toolsMenuOpen()).toBeFalse();
    expect(component.activeTool()).toBeNull();
  });

  it('should toggle left panel', () => {
    expect(component.leftPanelOpen()).toBeTrue();
    component.toggleLeftPanel();
    expect(component.leftPanelOpen()).toBeFalse();
    component.toggleLeftPanel();
    expect(component.leftPanelOpen()).toBeTrue();
  });

  it('should toggle geosignets overlay', () => {
    expect(component.geosignetsOpen()).toBeFalse();
    component.toggleGeosignets();
    expect(component.geosignetsOpen()).toBeTrue();
    component.closeGeosignets();
    expect(component.geosignetsOpen()).toBeFalse();
  });

  it('should toggle share overlay', () => {
    expect(component.shareOpen()).toBeFalse();
    component.toggleShare();
    expect(component.shareOpen()).toBeTrue();
    component.closeShare();
    expect(component.shareOpen()).toBeFalse();
  });

  it('should toggle tools menu and active tool overlay', () => {
    expect(component.toolsMenuOpen()).toBeFalse();
    component.toggleToolsMenu();
    expect(component.toolsMenuOpen()).toBeTrue();

    component.selectTool('drawing');
    expect(component.activeTool()).toBe('drawing');
    expect(component.toolsMenuOpen()).toBeFalse();

    component.closeActiveTool();
    expect(component.activeTool()).toBeNull();
  });

  it('should switch language', () => {
    component.switchLanguage('en');
    expect(component.currentLang()).toBe('en');
  });
});
