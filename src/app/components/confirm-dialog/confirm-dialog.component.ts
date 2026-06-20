import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ConfirmDialogService,
  ConfirmInternal,
  ConfirmTone,
} from './confirm-dialog.service';

interface QueueItem {
  req: ConfirmInternal;
  closing: boolean;
  typed: string;
}

const TONE_DEFAULT_ICON: Record<ConfirmTone, string> = {
  danger: 'fa-solid fa-triangle-exclamation',
  warning: 'fa-solid fa-circle-exclamation',
  info: 'fa-solid fa-circle-info',
  success: 'fa-solid fa-circle-check',
};

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  current: QueueItem | null = null;
  private queue: QueueItem[] = [];
  private prevOverflow = '';
  private readonly destroy$ = new Subject<void>();

  @ViewChild('confirmBtn') confirmBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('cancelBtn') cancelBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('typeInput') typeInput?: ElementRef<HTMLInputElement>;

  constructor(
    private dialogs: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.dialogs.request$.pipe(takeUntil(this.destroy$)).subscribe((req) => {
      this.queue.push({ req, closing: false, typed: '' });
      if (!this.current) this.advance();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    document.body.style.overflow = this.prevOverflow;
  }

  iconFor(req: ConfirmInternal): string {
    return req.icon ?? TONE_DEFAULT_ICON[this.toneOf(req)];
  }

  toneOf(req: ConfirmInternal): ConfirmTone {
    return req.tone ?? 'info';
  }

  canConfirm(): boolean {
    if (!this.current) return false;
    const need = this.current.req.confirmInput;
    if (!need) return true;
    return this.current.typed.trim() === need;
  }

  onConfirm(): void {
    if (!this.canConfirm()) return;
    this.close(true);
  }

  onCancel(): void {
    this.close(false);
  }

  /** Click on backdrop dismisses (treated as cancel). */
  onBackdrop(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.close(false);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(ev: KeyboardEvent): void {
    if (!this.current || this.current.closing) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.close(false);
      return;
    }
    if (ev.key === 'Enter') {
      // Don't hijack Enter while typing in the type-to-confirm input
      // unless the typed value matches.
      const target = ev.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' &&
        this.current.req.confirmInput &&
        !this.canConfirm()
      ) {
        return;
      }
      ev.preventDefault();
      this.onConfirm();
    }
  }

  private close(ok: boolean): void {
    if (!this.current || this.current.closing) return;
    this.current.closing = true;
    const item = this.current;
    this.cdr.markForCheck();
    setTimeout(() => {
      item.req.resolve(ok);
      this.current = null;
      this.advance();
    }, 180);
  }

  private advance(): void {
    const next = this.queue.shift() ?? null;
    if (!next) {
      // Nothing to show — restore scroll.
      document.body.style.overflow = this.prevOverflow;
      this.prevOverflow = '';
      this.cdr.markForCheck();
      return;
    }
    if (!this.current) {
      this.prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    this.current = next;
    this.cdr.markForCheck();
    // Auto-focus the most relevant control.
    setTimeout(() => {
      if (next.req.confirmInput) {
        this.typeInput?.nativeElement.focus();
      } else if (this.toneOf(next.req) === 'danger') {
        // For destructive prompts, default focus on Cancel for safety.
        this.cancelBtn?.nativeElement.focus();
      } else {
        this.confirmBtn?.nativeElement.focus();
      }
    }, 30);
  }
}
