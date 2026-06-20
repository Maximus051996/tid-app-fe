import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Global loading state. Uses a counter so concurrent operations
 * (e.g. a CRUD call running while a route change is in flight)
 * don't fight each other — the loader only hides once everyone
 * who called `show()` has called `hide()`.
 */
@Injectable({ providedIn: 'root' })
export class LoaderService {
  private count = 0;
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  readonly loading$: Observable<boolean> = this.loadingSubject.asObservable();

  /** Optional message that surfaces under the spinner. */
  private readonly messageSubject = new BehaviorSubject<string>('');
  readonly message$: Observable<string> = this.messageSubject.asObservable();

  constructor(private zone: NgZone) {}

  show(message: string = ''): void {
    this.count++;
    if (this.count === 1) {
      this.zone.run(() => {
        if (message) this.messageSubject.next(message);
        this.loadingSubject.next(true);
      });
    } else if (message) {
      this.zone.run(() => this.messageSubject.next(message));
    }
  }

  hide(): void {
    if (this.count === 0) return;
    this.count--;
    if (this.count === 0) {
      this.zone.run(() => {
        this.loadingSubject.next(false);
        this.messageSubject.next('');
      });
    }
  }

  /** Force everything off — used on auth boundaries (logout) so we never get stuck. */
  forceHide(): void {
    this.count = 0;
    this.zone.run(() => {
      this.loadingSubject.next(false);
      this.messageSubject.next('');
    });
  }
}
