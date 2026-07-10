import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
} from '@angular/core';

/**
 * Emits `closeRequested` when the user presses Escape or clicks/taps outside the host element.
 * Attach directly to a floating panel/drawer/dropdown root to give it the standard
 * dismiss behavior (Angular Material dialogs already do this natively).
 *
 * Set [appCloseOnEscapeOrOutsideDisabled]="true" to temporarily suspend it (e.g. while a
 * nested confirm dialog is open and should own Escape/outside-click instead).
 *
 * Set [appCloseOnEscapeOrOutsideExcludeSelector] to a CSS selector for regions that should
 * NOT count as "outside" even though they sit outside the host element - e.g. the OpenLayers
 * map viewport ('.ol-viewport') when the panel hosts a tool (draw/measure/routing/...) that
 * expects clicks ON the map itself as part of its own workflow. Without this, every such tool
 * panel self-destructed on the user's very first map click (picking a point, placing a
 * vertex...), which the outside-click handler misread as "dismiss this panel".
 *
 * Angular Material overlay-based components (mat-select, mat-menu, mat-autocomplete,
 * mat-datepicker...) are ALWAYS excluded, unconditionally - the CDK renders their panel into
 * a `.cdk-overlay-container` appended directly to <body>, outside the host element in the DOM
 * tree, even though visually/logically it belongs to whichever panel opened it. Without this,
 * picking any option from a <mat-select> living inside a directive-wrapped panel (e.g. the
 * routing tool's travel-profile dropdown) closed the whole panel instead of just the dropdown.
 */
@Directive({
  selector: '[appCloseOnEscapeOrOutside]',
  standalone: true,
})
export class CloseOnEscapeOrOutsideDirective {
  private readonly elRef = inject(ElementRef<HTMLElement>);

  @Input('appCloseOnEscapeOrOutsideDisabled') disabled = false;
  @Input('appCloseOnEscapeOrOutsideExcludeSelector') excludeSelector: string | null = null;

  @Output() closeRequested = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.disabled || this.hasOpenCdkOverlay()) {
      return;
    }
    this.closeRequested.emit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.disabled) {
      return;
    }
    const target = event.target as Node;
    if (this.elRef.nativeElement.contains(target)) {
      return;
    }
    if (
      target instanceof Element &&
      target.closest('.cdk-overlay-container, .cdk-overlay-backdrop')
    ) {
      return;
    }
    if (this.excludeSelector && target instanceof Element && target.closest(this.excludeSelector)) {
      return;
    }
    this.closeRequested.emit();
  }

  /** True while a mat-select/mat-menu/mat-autocomplete/... overlay panel is open. */
  private hasOpenCdkOverlay(): boolean {
    const container = document.querySelector('.cdk-overlay-container');
    return !!container && container.childElementCount > 0;
  }
}
