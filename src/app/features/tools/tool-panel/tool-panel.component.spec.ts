import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TranslateModule } from '@ngx-translate/core';

import { ToolPanelComponent } from './tool-panel.component';

describe('ToolPanelComponent', () => {
  let component: ToolPanelComponent;
  let fixture: ComponentFixture<ToolPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ToolPanelComponent,
        NoopAnimationsModule,
        HttpClientTestingModule,
        TranslateModule.forRoot(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ToolPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 10 tools defined', () => {
    expect(component.tools.length).toBe(10);
  });

  it('should start with no active tool', () => {
    expect(component.activeTool).toBeNull();
  });

  it('should toggle a tool on', () => {
    component.toggleTool('drawing');
    expect(component.activeTool).toBe('drawing');
  });

  it('should toggle a tool off when clicked again', () => {
    component.toggleTool('drawing');
    component.toggleTool('drawing');
    expect(component.activeTool).toBeNull();
  });

  it('should switch to different tool', () => {
    component.toggleTool('drawing');
    component.toggleTool('measure');
    expect(component.activeTool).toBe('measure');
  });

  it('should return correct active tool label', () => {
    component.toggleTool('drawing');
    expect(component.getActiveToolLabel()).toBe('Dessin');
  });

  it('should return empty string when no tool active', () => {
    expect(component.getActiveToolLabel()).toBe('');
  });

  it('should render tool grid', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('.tool-btn');
    expect(buttons.length).toBe(10);
  });
});
