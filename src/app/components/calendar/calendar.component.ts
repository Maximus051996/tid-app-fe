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
    const year = this.cursor.getFullYear();
    const month = this.cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Mon = 0

    const start = new Date(firstOfMonth);
    start.setDate(start.getDate() - startWeekday);

    const cells: CalendarCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const iso = this.toIso(d);

      cells.push({
        date: d,
        iso,
        inMonth: d.getMonth() === month,
        isToday: this.isSameDay(d, new Date()),
        events: this.eventsOn(iso),
      });
    }
    this.monthCells = cells;
  }

  private buildWeek(): void {
    const start = new Date(this.cursor);
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);
    start.setHours(0, 0, 0, 0);

    const cells: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = this.toIso(d);
      cells.push({
        date: d,
        iso,
        inMonth: true,
        isToday: this.isSameDay(d, new Date()),
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
    if (this.view === 'month') {
      this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() - 1, 1);
    } else if (this.view === 'week') {
      const d = new Date(this.cursor);
      d.setDate(d.getDate() - 7);
      this.cursor = d;
    } else {
      const d = new Date(this.cursor);
      d.setDate(d.getDate() - 1);
      this.cursor = d;
    }
    this.buildView();
  }

  next(): void {
    if (this.view === 'month') {
      this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + 1, 1);
    } else if (this.view === 'week') {
      const d = new Date(this.cursor);
      d.setDate(d.getDate() + 7);
      this.cursor = d;
    } else {
      const d = new Date(this.cursor);
      d.setDate(d.getDate() + 1);
      this.cursor = d;
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
    const iso = this.toIso(new Date(task.endDate));
    this.selectedDay = this.monthCells.find((c) => c.iso === iso) ||
      this.weekCells.find((c) => c.iso === iso) ||
      this.selectedDay;
  }

  closeDetail(): void {
    this.selectedTask = null;
  }

  addOnDay(cell: CalendarCell): void {
    const iso = cell.iso || this.toIso(cell.date);
    this.router.navigate(['/add-task'], { queryParams: { due: iso } });
  }

  toIsoCursor(): string {
    return this.toIso(this.cursor);
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
      .filter((t) => this.toIso(new Date(t.endDate)) === iso)
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
    const today = this.toIso(new Date());
    return this.eventsOn(today).length;
  }

  upcomingThisMonth(): Task[] {
    const start = new Date(this.cursor.getFullYear(), this.cursor.getMonth(), 1);
    const end = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + 1, 0);
    return this.tasks
      .filter((t) => {
        const d = new Date(t.endDate);
        return d >= start && d <= end && t.taskStatus !== 'completed';
      })
      .sort((a, b) => +new Date(a.endDate) - +new Date(b.endDate))
      .slice(0, 6);
  }

  monthLabel(): string {
    return this.cursor.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }

  weekLabel(): string {
    if (this.weekCells.length === 0) return '';
    const start = this.weekCells[0].date;
    const end = this.weekCells[6].date;
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
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

  private toIso(d: Date): string {
    const pad = (n: number) => (n < 10 ? '0' + n : n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
}
