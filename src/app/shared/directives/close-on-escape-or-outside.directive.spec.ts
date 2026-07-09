import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { CloseOnEscapeOrOutsideDirective } from './close-on-escape-or-outside.directive';

@Component({
  standalone: true,
  imports: [CloseOnEscapeOrOutsideDirective],
  template: `
    <div id="outside"></div>
    <div
      id="panel"
      appCloseOnEscapeOrOutside
      [appCloseOnEscapeOrOutsideDisabled]="disabled"
      (closeRequested)="onCloseRequested()"
    >
      <button id="inside">Inside Button</button>
    </div>
  `,
})
class HostComponent {
  disabled = false;
  closeCount = 0;
  onCloseRequested(): void {
    this.closeCount++;
  }
}

describe('CloseOnEscapeOrOutsideDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits closeRequested on Escape keydown', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.closeCount).toBe(1);
  });

  it('emits closeRequested when clicking outside the host element', () => {
    fixture.debugElement.query(By.css('#outside')).nativeElement.click();
    expect(host.closeCount).toBe(1);
  });

  it('does not emit when clicking inside the host element', () => {
    fixture.debugElement.query(By.css('#inside')).nativeElement.click();
    expect(host.closeCount).toBe(0);
  });

  it('does not emit on Escape or outside click when disabled', () => {
    host.disabled = true;
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.debugElement.query(By.css('#outside')).nativeElement.click();
    expect(host.closeCount).toBe(0);
  });
});
