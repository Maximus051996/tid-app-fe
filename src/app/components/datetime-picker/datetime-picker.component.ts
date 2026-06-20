import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  forwardRef,
  HostListener,
  Input,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

interface DayCell {
  date: Date;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  iso: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/**
 * World-class date+time picker that fully replaces native
 * `<input type="datetime-local">` and `<input type="date">`.
 *
 * Features:
 *  - Reactive Forms compatible (ControlValueAccessor)
 *  - Theme-aware via CSS variables
 *  - Keyboard accessible (Esc closes, click-outside closes)
 *  - Optional time picker (toggle with [includeTime])
 *  - Month/year navigation with keyboard-friendly arrows
 *  - Quick actions: Clear, Today, Done
 *  - Mobile-friendly: popover repositions and goes full-width on small screens
 */
@Component({
  selector: 'app-datetime-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateTimePickerComponent),
      multi: true,
    },
  ],
  template: `
    <div class="dtp" [class.is-open]="open" [class.has-value]="!!selectedDate" [class.is-disabled]="isDisabled">
      <button
        type="button"
        class="dtp-trigger"
        (click)="toggle()"
        [disabled]="isDisabled"
        [attr.aria-expanded]="open"
        aria-haspopup="dialog"
      >
        <i class="fa-regular" [ngClass]="includeTime ? 'fa-calendar-days' : 'fa-calendar'"></i>
        <span class="dtp-label" *ngIf="selectedDate; else placeholderTpl">{{ formattedValue() }}</span>
        <ng-template #placeholderTpl>
          <span class="dtp-placeholder">{{ placeholder }}</span>
        </ng-template>
        <button
          *ngIf="selectedDate && !isDisabled"
          type="button"
          class="dtp-clear-btn"
          (click)="clearAndClose($event)"
          aria-label="Clear date"
          tabindex="-1"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
        <i class="dtp-chevron fa-solid" [ngClass]="open ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
      </button>

      <!-- Mobile backdrop -->
      <div *ngIf="open" class="dtp-backdrop" (click)="close()"></div>

      <div class="dtp-popover" *ngIf="open" role="dialog" aria-label="Pick a date">
        <!-- Header: month nav + year selector -->
        <header class="dtp-head">
          <button class="dtp-nav" type="button" (click)="prevMonth()" aria-label="Previous month">
            <i class="fa-solid fa-chevron-left"></i>
          </button>

          <div class="dtp-title">
            <button
              type="button"
              class="dtp-month-pill"
              (click)="toggleMonthList()"
              [class.active]="showMonthList"
            >
              {{ MONTHS[cursor.getMonth()] }}
              <i class="fa-solid fa-caret-down"></i>
            </button>
            <button
              type="button"
              class="dtp-year-pill"
              (click)="toggleYearList()"
              [class.active]="showYearList"
            >
              {{ cursor.getFullYear() }}
              <i class="fa-solid fa-caret-down"></i>
            </button>
          </div>

          <button class="dtp-nav" type="button" (click)="nextMonth()" aria-label="Next month">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        </header>

        <!-- Month/year quick-pick lists -->
        <div *ngIf="showMonthList" class="dtp-list dtp-month-list">
          <button
            *ngFor="let m of MONTHS; let i = index"
            type="button"
            class="dtp-list-item"
            [class.active]="cursor.getMonth() === i"
            (click)="setMonth(i)"
          >{{ m.substring(0, 3) }}</button>
        </div>

        <div *ngIf="showYearList" class="dtp-list dtp-year-list">
          <button
            *ngFor="let y of yearRange()"
            type="button"
            class="dtp-list-item"
            [class.active]="cursor.getFullYear() === y"
            (click)="setYear(y)"
          >{{ y }}</button>
        </div>

        <!-- Calendar grid -->
        <div class="dtp-grid" *ngIf="!showMonthList && !showYearList">
          <div class="dtp-weekrow">
            <span *ngFor="let w of WEEKDAYS">{{ w }}</span>
          </div>
          <div class="dtp-days">
            <button
              *ngFor="let cell of monthCells"
              type="button"
              class="dtp-day"
              [class.out]="!cell.inMonth"
              [class.today]="cell.isToday"
              [class.selected]="cell.isSelected"
              (click)="selectDay(cell)"
            >{{ cell.day }}</button>
          </div>
        </div>

        <!-- Time picker -->
        <div class="dtp-time" *ngIf="includeTime && !showMonthList && !showYearList">
          <span class="dtp-time-label">
            <i class="fa-regular fa-clock"></i>
            Time
          </span>
          <div class="dtp-time-spinners">
            <div class="dtp-spinner" role="group" aria-label="Hours">
              <button type="button" class="dtp-spin-btn" (click)="bumpHours(1)" aria-label="Hours up">
                <i class="fa-solid fa-chevron-up"></i>
              </button>
              <input
                type="text"
                class="dtp-spin-input"
                [value]="pad(hours)"
                (input)="onHoursInput($event)"
                (blur)="commitHours()"
                inputmode="numeric"
                maxlength="2"
                aria-label="Hours"
              />
              <button type="button" class="dtp-spin-btn" (click)="bumpHours(-1)" aria-label="Hours down">
                <i class="fa-solid fa-chevron-down"></i>
              </button>
            </div>
            <span class="dtp-time-sep">:</span>
            <div class="dtp-spinner" role="group" aria-label="Minutes">
              <button type="button" class="dtp-spin-btn" (click)="bumpMinutes(5)" aria-label="Minutes up">
                <i class="fa-solid fa-chevron-up"></i>
              </button>
              <input
                type="text"
                class="dtp-spin-input"
                [value]="pad(minutes)"
                (input)="onMinutesInput($event)"
                (blur)="commitMinutes()"
                inputmode="numeric"
                maxlength="2"
                aria-label="Minutes"
              />
              <button type="button" class="dtp-spin-btn" (click)="bumpMinutes(-5)" aria-label="Minutes down">
                <i class="fa-solid fa-chevron-down"></i>
              </button>
            </div>
          </div>

          <div class="dtp-quick-times">
            <button type="button" *ngFor="let q of quickTimes" class="dtp-quick" (click)="setTime(q.h, q.m)">
              {{ q.label }}
            </button>
          </div>
        </div>

        <!-- Footer actions -->
        <footer class="dtp-foot">
          <button type="button" class="dtp-btn ghost" (click)="clear()">
            <i class="fa-regular fa-trash-can"></i>
            <span>Clear</span>
          </button>
          <button type="button" class="dtp-btn ghost" (click)="goToday()">
            <i class="fa-solid fa-bullseye"></i>
            <span>Today</span>
          </button>
          <button type="button" class="dtp-btn primary" (click)="commit()">
            <i class="fa-solid fa-check"></i>
            <span>Done</span>
          </button>
        </footer>
      </div>
    </div>
  `,
  styleUrl: './datetime-picker.component.scss',
})
export class DateTimePickerComponent implements ControlValueAccessor {
  @Input() includeTime = true;
  @Input() placeholder = 'Select date';
  @Input() disabled = false;

  open = false;
  showMonthList = false;
  showYearList = false;

  selectedDate: Date | null = null;
  cursor: Date = this.startOfDay(new Date());
  hours = 9;
  minutes = 0;
  monthCells: DayCell[] = [];

  isDisabled = false;

  readonly MONTHS = MONTHS;
  readonly WEEKDAYS = WEEKDAYS;

  readonly quickTimes = [
    { label: '09:00', h: 9, m: 0 },
    { label: '12:00', h: 12, m: 0 },
    { label: '15:00', h: 15, m: 0 },
    { label: '18:00', h: 18, m: 0 },
  ];

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private host: ElementRef<HTMLElement>, private cdr: ChangeDetectorRef) {
    this.buildCalendar();
  }

  // ---------- ControlValueAccessor ----------

  writeValue(value: string | null | undefined): void {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        this.selectedDate = d;
        this.cursor = this.startOfDay(d);
        this.hours = d.getHours();
        this.minutes = d.getMinutes();
      } else {
        this.selectedDate = null;
      }
    } else {
      this.selectedDate = null;
    }
    this.buildCalendar();
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

  // ---------- Open/close ----------

  toggle(): void {
    if (this.isDisabled) return;
    this.open = !this.open;
    if (this.open) {
      this.showMonthList = false;
      this.showYearList = false;
      if (this.selectedDate) this.cursor = this.startOfDay(this.selectedDate);
      this.buildCalendar();
    } else {
      this.onTouched();
    }
  }

  close(): void {
    this.open = false;
    this.showMonthList = false;
    this.showYearList = false;
    this.onTouched();
    this.cdr.markForCheck();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.open) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }

  // ---------- Navigation ----------

  prevMonth(): void {
    this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() - 1, 1);
    this.buildCalendar();
  }

  nextMonth(): void {
    this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + 1, 1);
    this.buildCalendar();
  }

  toggleMonthList(): void {
    this.showMonthList = !this.showMonthList;
    if (this.showMonthList) this.showYearList = false;
  }

  toggleYearList(): void {
    this.showYearList = !this.showYearList;
    if (this.showYearList) this.showMonthList = false;
  }

  setMonth(monthIndex: number): void {
    this.cursor = new Date(this.cursor.getFullYear(), monthIndex, 1);
    this.showMonthList = false;
    this.buildCalendar();
  }

  setYear(year: number): void {
    this.cursor = new Date(year, this.cursor.getMonth(), 1);
    this.showYearList = false;
    this.buildCalendar();
  }

  yearRange(): number[] {
    const cur = this.cursor.getFullYear();
    const start = cur - 7;
    return Array.from({ length: 16 }, (_, i) => start + i);
  }

  goToday(): void {
    const today = new Date();
    this.cursor = this.startOfDay(today);
    this.selectedDate = new Date(today);
    this.hours = today.getHours();
    this.minutes = today.getMinutes();
    this.buildCalendar();
    this.commit();
  }

  // ---------- Selection ----------

  selectDay(cell: DayCell): void {
    const next = new Date(cell.date);
    next.setHours(this.hours, this.minutes, 0, 0);
    this.selectedDate = next;
    this.cursor = this.startOfDay(cell.date);
    this.buildCalendar();
    if (!this.includeTime) {
      this.commit();
    }
  }

  // ---------- Time ----------

  bumpHours(delta: number): void {
    this.hours = (this.hours + delta + 24) % 24;
    this.applyTimeToSelection();
  }

  bumpMinutes(delta: number): void {
    let next = this.minutes + delta;
    if (next >= 60) {
      next -= 60;
      this.bumpHours(1);
    } else if (next < 0) {
      next += 60;
      this.bumpHours(-1);
    }
    this.minutes = next;
    this.applyTimeToSelection();
  }

  setTime(h: number, m: number): void {
    this.hours = h;
    this.minutes = m;
    this.applyTimeToSelection();
  }

  onHoursInput(ev: Event): void {
    const raw = (ev.target as HTMLInputElement).value.replace(/\D/g, '');
    const n = parseInt(raw, 10);
    if (!isNaN(n)) this.hours = Math.max(0, Math.min(23, n));
  }

  onMinutesInput(ev: Event): void {
    const raw = (ev.target as HTMLInputElement).value.replace(/\D/g, '');
    const n = parseInt(raw, 10);
    if (!isNaN(n)) this.minutes = Math.max(0, Math.min(59, n));
  }

  commitHours(): void {
    this.applyTimeToSelection();
  }

  commitMinutes(): void {
    this.applyTimeToSelection();
  }

  private applyTimeToSelection(): void {
    if (this.selectedDate) {
      this.selectedDate.setHours(this.hours, this.minutes, 0, 0);
      this.selectedDate = new Date(this.selectedDate);
    }
    this.cdr.markForCheck();
  }

  // ---------- Footer ----------

  clear(): void {
    this.selectedDate = null;
    this.onChange('');
    this.cdr.markForCheck();
  }

  clearAndClose(ev: Event): void {
    ev.stopPropagation();
    this.clear();
    this.close();
  }

  commit(): void {
    if (this.selectedDate) {
      this.onChange(this.formatForOutput(this.selectedDate));
    } else {
      this.onChange('');
    }
    this.close();
  }

  // ---------- Display ----------

  formattedValue(): string {
    if (!this.selectedDate) return '';
    if (this.includeTime) {
      return this.selectedDate.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }
    return this.selectedDate.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  pad(n: number): string {
    return n < 10 ? '0' + n : String(n);
  }

  // ---------- Calendar build ----------

  private buildCalendar(): void {
    const year = this.cursor.getFullYear();
    const month = this.cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Mon=0

    const start = new Date(firstOfMonth);
    start.setDate(start.getDate() - startWeekday);

    const today = new Date();
    const todayIso = this.toIso(today);
    const selectedIso = this.selectedDate ? this.toIso(this.selectedDate) : null;

    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const iso = this.toIso(d);
      cells.push({
        date: d,
        day: d.getDate(),
        inMonth: d.getMonth() === month,
        isToday: iso === todayIso,
        isSelected: iso === selectedIso,
        iso,
      });
    }
    this.monthCells = cells;
    this.cdr.markForCheck();
  }

  private startOfDay(d: Date): Date {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
  }

  private toIso(d: Date): string {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
  }

  /** Emit format depending on includeTime. */
  private formatForOutput(d: Date): string {
    const base = `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
    if (!this.includeTime) return base;
    return `${base}T${this.pad(d.getHours())}:${this.pad(d.getMinutes())}`;
  }
}
