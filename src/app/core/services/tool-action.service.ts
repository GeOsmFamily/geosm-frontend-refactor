import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ToolAction {
  tool: string;
  action: string;
  data?: any;
}

@Injectable({ providedIn: 'root' })
export class ToolActionService {
  private readonly actionSubject = new Subject<ToolAction>();
  readonly action$ = this.actionSubject.asObservable();

  emit(action: ToolAction): void {
    this.actionSubject.next(action);
  }
}
