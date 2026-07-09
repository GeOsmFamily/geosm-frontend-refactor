import { Directive, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';

/**
 * Emits `closeRequested` when the user presses Escape or clicks/taps outside the host element.
 * Attach directly to a floating panel/drawer/dropdown root to give it the standard
 * dismiss behavior (Angular Material dialogs already do this natively).
 *
 * Set [appCloseOnEscapeOrOutsideDisabled]="true" to temporarily suspend it (e.g. while a
 * nested confirm dialog is open and should own Escape/outside-click instead).
 */
@Directive({
  selector: '[appCloseOnEscapeOrOutside]',
  standalone: true,
})
export class CloseOnEscapeOrOutsideDirective {
  private readonly elRef = inject(ElementRef<HTMLElement>);

  @Input('appCloseOnEscapeOrOutsideDisabled') disabled = false;

  @Output() closeRequested = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.disabled) {
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
    if (!this.elRef.nativeElement.contains(target)) {
      this.closeRequested.emit();
    }
  }
}
