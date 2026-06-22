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
import {
  formatIst,
  fromIstWall,
  istIsoDate,
  istNow,
  toIstWall,
} from '../../utils/ist-time';

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
              {{ MONTHS[cursorMonth] }}
              <i class="fa-solid fa-caret-down"></i>
            </button>
            <button
              type="button"
              class="dtp-year-pill"
              (click)="toggleYearList()"
              [class.active]="showYearList"
            >
              {{ cursorYear }}
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
            [class.active]="cursorMonth === i"
            (click)="setMonth(i)"
          >{{ m.substring(0, 3) }}</button>
        </div>

        <div *ngIf="showYearList" class="dtp-list dtp-year-list">
          <button
            *ngFor="let y of yearRange()"
            type="button"
            class="dtp-list-item"
            [class.active]="cursorYear === y"
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

  /** The UTC instant currently selected (may be null). */
  selectedDate: Date | null = null;
  /**
   * `cursor` is the first day of the visible month, expressed as the IST
   * wall-clock moment at 00:00 IST. We keep it as a Date for ergonomic
   * arithmetic, but every read uses the IST helpers below.
   */
  cursor: Date = (() => {
    const n = istNow();
    return fromIstWall(n.year, n.month, n.day, 0, 0, 0, 0);
  })();
  hours = 9;
  minutes = 0;
  monthCells: DayCell[] = [];

  /** Cached IST view of `cursor` so the template can read year/month cheaply. */
  cursorYear = 0;
  cursorMonth = 0; // 0-11 to match Date semantics

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
    this.syncCursorIst();
    this.buildCalendar();
  }

  // ---------- ControlValueAccessor ----------

  writeValue(value: string | null | undefined): void {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        const w = toIstWall(d);
        this.selectedDate = d;
        this.cursor = fromIstWall(w.year, w.month, w.day, 0, 0, 0, 0);
        this.hours = w.hours;
        this.minutes = w.minutes;
      } else {
        this.selectedDate = null;
      }
    } else {
      this.selectedDate = null;
    }
    this.syncCursorIst();
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
      if (this.selectedDate) {
        const w = toIstWall(this.selectedDate);
        this.cursor = fromIstWall(w.year, w.month, w.day, 0, 0, 0, 0);
      }
      this.syncCursorIst();
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
    const w = toIstWall(this.cursor);
    const prevMonthIdx = w.month - 2; // toIstWall.month is 1-12
    const baseYear = w.year + Math.floor(prevMonthIdx / 12);
    const baseMonth = ((prevMonthIdx % 12) + 12) % 12;
    this.cursor = fromIstWall(baseYear, baseMonth + 1, 1, 0, 0, 0, 0);
    this.syncCursorIst();
    this.buildCalendar();
  }

  nextMonth(): void {
    const w = toIstWall(this.cursor);
    const nextMonthIdx = w.month; // 0-based after subtracting 1 then adding 1
    const baseYear = w.year + Math.floor(nextMonthIdx / 12);
    const baseMonth = nextMonthIdx % 12;
    this.cursor = fromIstWall(baseYear, baseMonth + 1, 1, 0, 0, 0, 0);
    this.syncCursorIst();
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
    const w = toIstWall(this.cursor);
    this.cursor = fromIstWall(w.year, monthIndex + 1, 1, 0, 0, 0, 0);
    this.showMonthList = false;
    this.syncCursorIst();
    this.buildCalendar();
  }

  setYear(year: number): void {
    const w = toIstWall(this.cursor);
    this.cursor = fromIstWall(year, w.month, 1, 0, 0, 0, 0);
    this.showYearList = false;
    this.syncCursorIst();
    this.buildCalendar();
  }

  yearRange(): number[] {
    const cur = this.cursorYear;
    const start = cur - 7;
    return Array.from({ length: 16 }, (_, i) => start + i);
  }

  goToday(): void {
    const n = istNow();
    this.cursor = fromIstWall(n.year, n.month, n.day, 0, 0, 0, 0);
    this.selectedDate = fromIstWall(n.year, n.month, n.day, n.hours, n.minutes, 0, 0);
    this.hours = n.hours;
    this.minutes = n.minutes;
    this.syncCursorIst();
    this.buildCalendar();
    this.commit();
  }

  // ---------- Selection ----------

  selectDay(cell: DayCell): void {
    // `cell.date` represents the IST midnight of the day clicked. Combine
    // it with the currently chosen hour/minute (also IST wall-clock) and
    // store the resulting UTC instant.
    const w = toIstWall(cell.date);
    this.selectedDate = fromIstWall(w.year, w.month, w.day, this.hours, this.minutes, 0, 0);
    this.cursor = fromIstWall(w.year, w.month, w.day, 0, 0, 0, 0);
    this.syncCursorIst();
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
      const w = toIstWall(this.selectedDate);
      this.selectedDate = fromIstWall(w.year, w.month, w.day, this.hours, this.minutes, 0, 0);
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
      return formatIst(this.selectedDate, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }
    return formatIst(this.selectedDate, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  pad(n: number): string {
    return n < 10 ? '0' + n : String(n);
  }

  // ---------- Calendar build ----------

  private syncCursorIst(): void {
    const w = toIstWall(this.cursor);
    this.cursorYear = w.year;
    this.cursorMonth = w.month - 1; // template uses 0-11
  }

  private buildCalendar(): void {
    const cw = toIstWall(this.cursor);
    const year = cw.year;
    const month = cw.month; // 1-12

    // First-of-month at IST midnight, as a UTC instant. Use IST weekday
    // (Sun=0..Sat=6) so the grid lines up regardless of device timezone.
    const firstOfMonth = fromIstWall(year, month, 1, 0, 0, 0, 0);
    const startWeekday = (this.istWeekday(firstOfMonth) + 6) % 7; // Mon=0

    const todayIso = istIsoDate(new Date());
    const selectedIso = this.selectedDate ? istIsoDate(this.selectedDate) : null;

    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const offset = i - startWeekday;
      const d = fromIstWall(year, month, 1 + offset, 0, 0, 0, 0);
      const dw = toIstWall(d);
      const iso = istIsoDate(d);
      cells.push({
        date: d,
        day: dw.day,
        inMonth: dw.month === month,
        isToday: iso === todayIso,
        isSelected: iso === selectedIso,
        iso,
      });
    }
    this.monthCells = cells;
    this.cdr.markForCheck();
  }

  /** IST weekday with 0=Sunday … 6=Saturday, mirroring `Date.getDay`. */
  private istWeekday(d: Date): number {
    const shifted = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return shifted.getUTCDay();
  }

  /**
   * Always emit a fully-qualified ISO 8601 UTC string (e.g.
   * `2026-06-22T15:00:00.000Z`) representing the exact IST instant the
   * user picked. For date-only mode we emit `YYYY-MM-DD` computed against
   * IST so the string matches the day shown in the picker.
   */
  private formatForOutput(d: Date): string {
    if (!this.includeTime) return istIsoDate(d);
    return d.toISOString();
  }
}
