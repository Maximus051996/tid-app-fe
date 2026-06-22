import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TaskService } from '../../services/task/task.service';
import { AuthService } from '../../services/auth/auth.service';
import { DataService } from '../../services/data/data.service';
import { Task } from '../../models/models';
import { formatIst, istIsoDate, toIstWall } from '../../utils/ist-time';

interface CalendarCell {
  date: Date;
  iso: string;
  inMonth: boolean;
  isToday: boolean;
  events: Task[];
}

type ViewMode = 'month' | 'week' | 'day';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
})
export class CalendarComponent implements OnInit, OnDestroy {
  view: ViewMode = 'month';
  cursor: Date = new Date();
  weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  tasks: Task[] = [];
  monthCells: CalendarCell[] = [];
  weekCells: CalendarCell[] = [];

  /** Drill-down: selected day + selected task */
  selectedDay: CalendarCell | null = null;
  selectedTask: Task | null = null;

  searchText = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private taskService: TaskService,
    private auth: AuthService,
    private data: DataService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.auth.showSpinner();
    this.taskService
      .getallTasks()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.tasks = res.filter((t) => !t.isDeleted);
          this.buildView();
          const todayCell = this.monthCells.find((c) => c.isToday);
          if (todayCell && !this.selectedDay) {
            this.selectedDay = todayCell;
          }
          this.auth.hideSpinner();
        },
        error: (err: Error) => {
          this.data.showerrorToaster(err.message);
          this.auth.hideSpinner();
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- View building ----------

  buildView(): void {
    if (this.view === 'month') this.buildMonth();
    if (this.view === 'week') this.buildWeek();
  }

  private buildMonth(): void {
    const cw = toIstWall(this.cursor);
    const year = cw.year;
    const month = cw.month; // 1-12

    const firstOfMonth = this.fromIst(year, month, 1);
    const startWeekday = (this.istWeekday(firstOfMonth) + 6) % 7; // Mon = 0

    const cells: CalendarCell[] = [];
    for (let i = 0; i < 42; i++) {
      const offset = i - startWeekday;
      const d = this.fromIst(year, month, 1 + offset);
      const dw = toIstWall(d);
      const iso = istIsoDate(d);
      cells.push({
        date: d,
        iso,
        inMonth: dw.month === month,
        isToday: iso === istIsoDate(new Date()),
        events: this.eventsOn(iso),
      });
    }
    this.monthCells = cells;
  }

  private buildWeek(): void {
    const cw = toIstWall(this.cursor);
    const startOfDay = this.fromIst(cw.year, cw.month, cw.day);
    const offset = (this.istWeekday(startOfDay) + 6) % 7;

    const cells: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const d = this.fromIst(cw.year, cw.month, cw.day - offset + i);
      const iso = istIsoDate(d);
      cells.push({
        date: d,
        iso,
        inMonth: true,
        isToday: iso === istIsoDate(new Date()),
        events: this.eventsOn(iso),
      });
    }
    this.weekCells = cells;
  }

  // ---------- Actions ----------

  setView(v: ViewMode): void {
    this.view = v;
    this.buildView();
  }

  prev(): void {
    const cw = toIstWall(this.cursor);
    if (this.view === 'month') {
      this.cursor = this.fromIst(cw.year, cw.month - 1, 1);
    } else if (this.view === 'week') {
      this.cursor = this.fromIst(cw.year, cw.month, cw.day - 7);
    } else {
      this.cursor = this.fromIst(cw.year, cw.month, cw.day - 1);
    }
    this.buildView();
  }

  next(): void {
    const cw = toIstWall(this.cursor);
    if (this.view === 'month') {
      this.cursor = this.fromIst(cw.year, cw.month + 1, 1);
    } else if (this.view === 'week') {
      this.cursor = this.fromIst(cw.year, cw.month, cw.day + 7);
    } else {
      this.cursor = this.fromIst(cw.year, cw.month, cw.day + 1);
    }
    this.buildView();
  }

  goToday(): void {
    this.cursor = new Date();
    this.buildView();
    const todayCell = this.monthCells.find((c) => c.isToday);
    if (todayCell) this.selectDay(todayCell);
  }

  selectDay(cell: CalendarCell): void {
    this.selectedDay = cell;
    this.selectedTask = null;
  }

  selectTask(task: Task, ev?: Event): void {
    if (ev) ev.stopPropagation();
    this.selectedTask = task;
    const iso = istIsoDate(new Date(task.endDate));
    this.selectedDay = this.monthCells.find((c) => c.iso === iso) ||
      this.weekCells.find((c) => c.iso === iso) ||
      this.selectedDay;
  }

  closeDetail(): void {
    this.selectedTask = null;
  }

  addOnDay(cell: CalendarCell): void {
    const iso = cell.iso || istIsoDate(cell.date);
    this.router.navigate(['/add-task'], { queryParams: { due: iso } });
  }

  toIsoCursor(): string {
    return istIsoDate(this.cursor);
  }

  openTask(task: Task): void {
    this.router.navigate(['/view-task', task._id]);
  }

  editTask(task: Task): void {
    this.router.navigate(['/edit-task', task._id]);
  }

  // ---------- Helpers ----------

  private eventsOn(iso: string): Task[] {
    return this.tasks
      .filter((t) => istIsoDate(new Date(t.endDate)) === iso)
      .filter((t) =>
        !this.searchText ||
        t.subject.toLowerCase().includes(this.searchText.toLowerCase())
      )
      .sort(
        (a, b) =>
          this.priorityWeight(b.priority) - this.priorityWeight(a.priority)
      );
  }

  todayEventsCount(): number {
    return this.eventsOn(istIsoDate(new Date())).length;
  }

  upcomingThisMonth(): Task[] {
    const cw = toIstWall(this.cursor);
    const start = this.fromIst(cw.year, cw.month, 1);
    const end = this.fromIst(cw.year, cw.month + 1, 0, 23, 59, 59, 999);
    return this.tasks
      .filter((t) => {
        const d = new Date(t.endDate);
        return d >= start && d <= end && t.taskStatus !== 'completed';
      })
      .sort((a, b) => +new Date(a.endDate) - +new Date(b.endDate))
      .slice(0, 6);
  }

  monthLabel(): string {
    return formatIst(this.cursor, { month: 'long', year: 'numeric' });
  }

  weekLabel(): string {
    if (this.weekCells.length === 0) return '';
    const start = this.weekCells[0].date;
    const end = this.weekCells[6].date;
    return `${formatIst(start, { month: 'short', day: 'numeric' })} – ${formatIst(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  priorityClass(priority: string): string {
    return priority === 'High' ? 'p-high' : priority === 'Medium' ? 'p-medium' : 'p-low';
  }

  statusKey(task: Task): 'completed' | 'partiallyCompleted' | 'notStarted' | 'overdue' {
    if (task.taskStatus === 'completed') return 'completed';
    if (new Date(task.endDate) < new Date()) return 'overdue';
    return task.taskStatus;
  }

  isOverdue(task: Task): boolean {
    return task.taskStatus !== 'completed' && new Date(task.endDate) < new Date();
  }

  applySearch(): void {
    this.buildView();
  }

  private priorityWeight(p: string): number {
    return p === 'High' ? 3 : p === 'Medium' ? 2 : 1;
  }

  /** Wrap fromIstWall so this file can pass a 0-based or out-of-range
   *  month/day and rely on Date.UTC's normalization. */
  private fromIst(
    year: number,
    month: number,
    day: number,
    hours = 0,
    minutes = 0,
    seconds = 0,
    ms = 0
  ): Date {
    const utcMs = Date.UTC(year, month - 1, day, hours, minutes, seconds, ms);
    return new Date(utcMs - 5.5 * 60 * 60 * 1000);
  }

  private istWeekday(d: Date): number {
    const shifted = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return shifted.getUTCDay();
  }
}
