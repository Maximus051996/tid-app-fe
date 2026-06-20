import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  forwardRef,
  HostListener,
  Input,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: string;
  label: string;
  /** Optional Font Awesome icon class. */
  icon?: string;
  /** Optional accent color identifier ('accent' | 'danger' | 'warning' | 'info' | 'muted'). */
  tone?: 'accent' | 'danger' | 'warning' | 'info' | 'muted';
  /** Optional secondary description shown below the label. */
  description?: string;
  disabled?: boolean;
}

/**
 * World-class custom select. Fully replaces native `<select>` so the
 * dropdown menu can be themed and animated to match the rest of the app.
 *
 * - Reactive Forms compatible (ControlValueAccessor)
 * - Click-outside / Escape to close
 * - Keyboard friendly: Enter/Space toggles, Arrow keys move highlight, Enter selects
 * - Optional icons, tones, and descriptions per option
 */
@Component({
  selector: 'app-select',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppSelectComponent),
      multi: true,
    },
  ],
  template: `
    <div
      class="app-select"
      [class.is-open]="open"
      [class.is-disabled]="isDisabled"
      [class.has-value]="!!current"
    >
      <button
        type="button"
        class="as-trigger"
        (click)="toggle()"
        (keydown)="onTriggerKeydown($event)"
        [disabled]="isDisabled"
        [attr.aria-expanded]="open"
        aria-haspopup="listbox"
      >
        <span class="as-leading" *ngIf="current?.icon || leadingIcon">
          <i [class]="current?.icon || leadingIcon"></i>
        </span>
        <span class="as-label" *ngIf="current as cur; else placeholderTpl" [ngClass]="'tone-' + (cur.tone || 'default')">
          {{ cur.label }}
        </span>
        <ng-template #placeholderTpl>
          <span class="as-placeholder">{{ placeholder }}</span>
        </ng-template>
        <i class="as-chevron fa-solid" [ngClass]="open ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
      </button>

      <div *ngIf="open" class="as-menu" role="listbox">
        <button
          *ngFor="let opt of options; let i = index"
          type="button"
          role="option"
          class="as-option"
          [class.active]="opt.value === current?.value"
          [class.highlighted]="i === highlightedIndex"
          [class.disabled]="opt.disabled"
          [attr.aria-selected]="opt.value === current?.value"
          (click)="select(opt)"
          (mouseenter)="highlightedIndex = i"
        >
          <span class="as-opt-icon" *ngIf="opt.icon">
            <i [class]="opt.icon"></i>
          </span>
          <span class="as-opt-body">
            <span class="as-opt-label" [ngClass]="'tone-' + (opt.tone || 'default')">{{ opt.label }}</span>
            <span class="as-opt-desc" *ngIf="opt.description">{{ opt.description }}</span>
          </span>
          <i *ngIf="opt.value === current?.value" class="as-opt-check fa-solid fa-check"></i>
        </button>

        <div *ngIf="!options.length" class="as-empty">No options</div>
      </div>
    </div>
  `,
  styleUrl: './app-select.component.scss',
})
export class AppSelectComponent implements ControlValueAccessor {
  @Input() options: SelectOption[] = [];
  @Input() placeholder = 'Select…';
  @Input() leadingIcon: string | null = null;

  open = false;
  isDisabled = false;
  current: SelectOption | null = null;
  highlightedIndex = -1;

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(
    private host: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef
  ) {}

  // ---------- ControlValueAccessor ----------

  writeValue(value: string | null | undefined): void {
    this.current = this.options.find((o) => o.value === value) ?? null;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.isDisabled = disabled;
    this.cdr.markForCheck();
  }

  // ---------- Open / select ----------

  toggle(): void {
    if (this.isDisabled) return;
    this.open = !this.open;
    if (this.open) {
      this.highlightedIndex = this.options.findIndex(
        (o) => o.value === this.current?.value
      );
    } else {
      this.onTouched();
    }
    this.cdr.markForCheck();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.onTouched();
    this.cdr.markForCheck();
  }

  select(opt: SelectOption): void {
    if (opt.disabled) return;
    this.current = opt;
    this.onChange(opt.value);
    this.close();
  }

  // ---------- Keyboard ----------

  onTriggerKeydown(ev: KeyboardEvent): void {
    if (this.isDisabled) return;

    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      if (this.open && this.highlightedIndex >= 0) {
        this.select(this.options[this.highlightedIndex]);
      } else {
        this.toggle();
      }
      return;
    }

    if (ev.key === 'Escape') {
      this.close();
      return;
    }

    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (!this.open) {
        this.toggle();
        return;
      }
      const dir = ev.key === 'ArrowDown' ? 1 : -1;
      const len = this.options.length;
      if (!len) return;
      let idx = this.highlightedIndex;
      for (let i = 0; i < len; i++) {
        idx = (idx + dir + len) % len;
        if (!this.options[idx].disabled) break;
      }
      this.highlightedIndex = idx;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.open) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  onDocEscape(): void {
    this.close();
  }
}
