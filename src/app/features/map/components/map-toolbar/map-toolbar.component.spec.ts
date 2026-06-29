import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, of } from 'rxjs';
import { MapToolbarComponent } from './map-toolbar.component';
import { MapService } from '../../services/map.service';
import { InstanceService } from '../../../../core/services/instance.service';

describe('MapToolbarComponent', () => {
  let component: MapToolbarComponent;
  let fixture: ComponentFixture<MapToolbarComponent>;
  let mapSpy: jasmine.SpyObj<any>;
  let viewSpy: jasmine.SpyObj<any>;
  let dialogSpy: jasmine.SpyObj<MatDialog>;
  let mapServiceSpy: jasmine.SpyObj<MapService>;
  let mapReadySubject: BehaviorSubject<boolean>;
  let instanceServiceMock: any;

  beforeEach(async () => {
    mapReadySubject = new BehaviorSubject<boolean>(false);
    viewSpy = jasmine.createSpyObj('View', ['getCenter', 'getZoom', 'animate', 'fit']);
    viewSpy.getCenter.and.returnValue([12.35, 7.37]);
    viewSpy.getZoom.and.returnValue(6);

    mapSpy = jasmine.createSpyObj('Map', ['getView', 'on', 'un']);
    mapSpy.getView.and.returnValue(viewSpy);

    mapServiceSpy = jasmine.createSpyObj('MapService', ['getMap'], {
      mapReady$: mapReadySubject.asObservable()
    });
    mapServiceSpy.getMap.and.returnValue(mapSpy);

    dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);

    instanceServiceMock = {
      currentInstance$: new BehaviorSubject<any>({
        id: 'cameroon',
        slug: 'cameroon',
        bbox: [8.4, 1.6, 16.2, 13.1],
        centerLat: 7.37,
        centerLon: 12.35,
        defaultZoom: 6,
      }),
    };

    await TestBed.configureTestingModule({
      imports: [
        MapToolbarComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: MapService, useValue: mapServiceSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: InstanceService, useValue: instanceServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MapToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not initialize map properties before map is ready', () => {
    expect(mapServiceSpy.getMap).not.toHaveBeenCalled();
  });

  it('should initialize map when mapReady emits true', () => {
    mapReadySubject.next(true);
    fixture.detectChanges();

    expect(mapServiceSpy.getMap).toHaveBeenCalled();
    expect(mapSpy.on).toHaveBeenCalledWith('moveend', jasmine.any(Function));
  });

  it('should zoom in', () => {
    mapReadySubject.next(true);
    fixture.detectChanges();

    component.zoomIn();
    expect(viewSpy.animate).toHaveBeenCalledWith({ zoom: 7, duration: 200 });
  });

  it('should zoom out', () => {
    mapReadySubject.next(true);
    fixture.detectChanges();

    component.zoomOut();
    expect(viewSpy.animate).toHaveBeenCalledWith({ zoom: 5, duration: 200 });
  });

  it('should toggle compare mode', (done) => {
    component.compareMode.subscribe((compare) => {
      expect(compare).toBeTrue();
      done();
    });

    component.toggleCompare();
  });
});
