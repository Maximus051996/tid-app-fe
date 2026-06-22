import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgxPaginationModule } from 'ngx-pagination';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { TaskService } from '../../../services/task/task.service';
import { DataService } from '../../../services/data/data.service';
import { AuthService } from '../../../services/auth/auth.service';
import { SentenceCasePipe } from '../../../pipes/sentence-case.pipe';
import { Task } from '../../../models/models';
import { ConfirmDialogService } from '../../confirm-dialog/confirm-dialog.service';
import {
  formatIst,
  fromIstWall,
  istIsoDate,
  istStartOfDay,
  toIstWall,
} from '../../../utils/ist-time';

interface DayCell {
  label: string;          // Mon, Tue ...
  dateLabel: string;      // 12
  monthLabel: string;     // Jun
  isToday: boolean;
  count: number;
  highCount: number;
  iso: string;            // YYYY-MM-DD
}

@Component({
  selector: 'app-tasklist',
  standalone: true,
  imports: [
    CommonModule,
    NgxPaginationModule,
    FormsModule,
    SentenceCasePipe,
  ],
  templateUrl: './tasklist.component.html',
  styleUrl: './tasklist.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasklistComponent implements OnInit, OnDestroy {
  items: Task[] = [];

  // Precomputed filtered list — recomputed on data or filter change.
  filteredItems: Task[] = [];

  // Priority KPIs (only count active, non-deleted)
  highCount = 0;
  mediumCount = 0;
  lowCount = 0;

  // Status KPIs
  wipCount = 0;       // partiallyCompleted
  finishedCount = 0;  // completed
  notCompletedCount = 0; // notStarted

  overdueCount = 0;

  searchText = '';
  statusFilter: 'all' | 'notStarted' | 'partiallyCompleted' | 'completed' | 'overdue' = 'all';
  currentPage = 1;
  itemsPerPage = 6;

  // Day-to-day activity strip (today + next 6 days)
  weekStrip: DayCell[] = [];
  selectedDayIso: string | null = null;

  // Activity panels
  todaysTasks: Task[] = [];
  overdueTasks: Task[] = [];
  upcomingTasks: Task[] = [];
  recentlyCompleted: Task[] = [];

  // Selected day's tasks — recomputed alongside the week strip.
  selectedDayTasks: Task[] = [];

  greeting = '';
  userName = '';
  todayLabel = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private taskService: TaskService,
    private dataService: DataService,
    private router: Router,
    private authService: AuthService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.userName = this.authService.getUserName() ?? '';
    this.greeting = this.greetingFor(new Date());
    this.todayLabel = formatIst(new Date(), {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    this.loadTasks();
  }

  // ---------- Data ----------

  loadTasks(): void {
    // TaskService is in-memory; resolve synchronously on the same tick.
    // Skipping the spinner avoids the brief modal flash on the dashboard.
    this.taskService
      .getallTasks()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.items = res;
          this.computeStats();
          this.buildWeekStrip();
          this.buildActivityPanels();
          this.rebuildFiltered();
          this.recomputeSelectedDay();

          // open-task count for the side nav badge
          const open = res.filter(
            (t) => !t.isDeleted && t.taskStatus !== 'completed'
          ).length;
          this.dataService.changeData(open);

          this.cdr.markForCheck();
        },
        error: (err: Error) => this.dataService.showerrorToaster(err.message),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- Derived data ----------

  private computeStats(): void {
    const live = this.items.filter((t) => !t.isDeleted);

    this.highCount = live.filter(
      (t) => t.priority === 'High' && t.taskStatus !== 'completed'
    ).length;
    this.mediumCount = live.filter(
      (t) => t.priority === 'Medium' && t.taskStatus !== 'completed'
    ).length;
    this.lowCount = live.filter(
      (t) => t.priority === 'Low' && t.taskStatus !== 'completed'
    ).length;

    this.wipCount = live.filter((t) => t.taskStatus === 'partiallyCompleted').length;
    this.finishedCount = live.filter((t) => t.taskStatus === 'completed').length;
    this.notCompletedCount = live.filter((t) => t.taskStatus === 'notStarted').length;

    const now = new Date();
    this.overdueCount = live.filter(
      (t) => t.taskStatus !== 'completed' && new Date(t.endDate) < now
    ).length;
  }

  private buildWeekStrip(): void {
    const todayWall = toIstWall(new Date());
    const live = this.items.filter((t) => !t.isDeleted);

    this.weekStrip = Array.from({ length: 7 }, (_, i) => {
      const d = fromIstWall(todayWall.year, todayWall.month, todayWall.day + i, 0, 0, 0, 0);
      const iso = istIsoDate(d);

      const dayTasks = live.filter((t) => istIsoDate(new Date(t.endDate)) === iso);

      return {
        label: formatIst(d, { weekday: 'short' }),
        dateLabel: String(toIstWall(d).day),
        monthLabel: formatIst(d, { month: 'short' }),
        isToday: i === 0,
        count: dayTasks.length,
        highCount: dayTasks.filter((t) => t.priority === 'High').length,
        iso,
      };
    });

    if (!this.selectedDayIso) {
      this.selectedDayIso = this.weekStrip[0].iso;
    }
  }

  private buildActivityPanels(): void {
    const now = new Date();
    const todayIso = this.toIsoDate(now);
    const live = this.items.filter((t) => !t.isDeleted);

    this.todaysTasks = live
      .filter(
        (t) =>
          t.taskStatus !== 'completed' &&
          this.toIsoDate(new Date(t.endDate)) === todayIso
      )
      .sort((a, b) => this.priorityWeight(b.priority) - this.priorityWeight(a.priority));

    this.overdueTasks = live
      .filter(
        (t) =>
          t.taskStatus !== 'completed' &&
          new Date(t.endDate) < this.startOfDay(now)
      )
      .sort((a, b) => +new Date(a.endDate) - +new Date(b.endDate));

    const thirtyDaysOut = new Date(now);
    thirtyDaysOut.setDate(now.getDate() + 30);
    this.upcomingTasks = live
      .filter((t) => {
        if (t.taskStatus === 'completed') return false;
        const end = new Date(t.endDate);
        return end >= this.startOfDay(now) && end <= thirtyDaysOut;
      })
      .sort((a, b) => +new Date(a.endDate) - +new Date(b.endDate))
      .slice(0, 5);

    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    this.recentlyCompleted = live
      .filter(
        (t) =>
          t.taskStatus === 'completed' &&
          new Date(t.updatedAt) >= weekAgo
      )
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
      .slice(0, 5);
  }

  // ---------- Filtering ----------

  onSearchChange(): void {
    this.rebuildFiltered();
    this.cdr.markForCheck();
  }

  setFilter(filter: typeof this.statusFilter): void {
    this.statusFilter = filter;
    this.currentPage = 1;
    this.rebuildFiltered();
    this.cdr.markForCheck();
  }

  private rebuildFiltered(): void {
    const q = this.searchText.trim().toLowerCase();
    const filter = this.statusFilter;
    const startToday = this.startOfDay(new Date());
    const out: Task[] = [];
    for (const t of this.items) {
      if (q && !t.subject.toLowerCase().includes(q)) continue;
      switch (filter) {
        case 'notStarted':
          if (t.taskStatus !== 'notStarted') continue;
          break;
        case 'partiallyCompleted':
          if (t.taskStatus !== 'partiallyCompleted') continue;
          break;
        case 'completed':
          if (t.taskStatus !== 'completed') continue;
          break;
        case 'overdue':
          if (t.taskStatus === 'completed' || new Date(t.endDate) >= startToday) continue;
          break;
      }
      out.push(t);
    }
    this.filteredItems = out;
  }

  // ---------- Navigation / actions ----------

  addItem(): void {
    this.router.navigate(['/add-task']);
  }

  view(id: string): void {
    this.router.navigate(['/view-task', id]);
  }

  edit(id: string): void {
    this.router.navigate(['/edit-task', id]);
  }

  async deleteItem(id: string): Promise<void> {
    const task = this.items.find((t) => t._id === id);
    const ok = await this.confirmDialog.ask({
      eyebrow: 'Delete task',
      title: task ? `Delete "${task.subject}"?` : 'Delete task?',
      message:
        'This task will be moved to the deleted state and removed from your active lists.',
      tone: 'danger',
      confirmLabel: 'Delete task',
      icon: 'fa-solid fa-trash',
    });
    if (!ok) return;
    this.taskService
      .deleteTask(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.message) this.loadTasks();
          this.dataService.showSuccessToasterMsg(res.message);
        },
        error: (err: Error) => this.dataService.showerrorToaster(err.message),
      });
  }

  selectDay(iso: string): void {
    this.selectedDayIso = iso;
    const cell = this.weekStrip.find((c) => c.iso === iso);
    if (cell?.isToday) {
      this.statusFilter = 'all';
      this.rebuildFiltered();
    }
    this.recomputeSelectedDay();
    this.cdr.markForCheck();
  }

  private recomputeSelectedDay(): void {
    if (!this.selectedDayIso) {
      this.selectedDayTasks = [];
      return;
    }
    const iso = this.selectedDayIso;
    const out: Task[] = [];
    for (const t of this.items) {
      if (t.isDeleted) continue;
      if (this.toIsoDate(new Date(t.endDate)) !== iso) continue;
      out.push(t);
    }
    out.sort((a, b) => this.priorityWeight(b.priority) - this.priorityWeight(a.priority));
    this.selectedDayTasks = out;
  }

  // ---------- UI helpers ----------

  isOverdue(task: Task): boolean {
    return (
      task.taskStatus !== 'completed' && new Date(task.endDate) < new Date()
    );
  }

  priorityClass(priority: string): string {
    switch (priority) {
      case 'High': return 'p-high';
      case 'Medium': return 'p-medium';
      default: return 'p-low';
    }
  }

  statusKey(task: Task): 'completed' | 'partiallyCompleted' | 'notStarted' | 'overdue' {
    if (task.taskStatus === 'completed') return 'completed';
    if (this.isOverdue(task)) return 'overdue';
    return task.taskStatus;
  }

  daysUntil(date: string): string {
    const target = this.startOfDay(new Date(date));
    const today = this.startOfDay(new Date());
    const diff = Math.round((+target - +today) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1) return `In ${diff} days`;
    return `${Math.abs(diff)} days ago`;
  }

  /** True when none of the three activity panels has anything to show. */
  hasActivity(): boolean {
    return (
      this.todaysTasks.length > 0 ||
      this.overdueTasks.length > 0 ||
      this.upcomingTasks.length > 0
    );
  }

  /** Header subtext for the "Coming up" panel — adapts to what was found. */
  upcomingSubtitle(): string {
    if (this.upcomingTasks.length === 0) return 'Nothing scheduled';
    return `Next ${this.upcomingTasks.length} of ${this.openCount()}`;
  }

  /** Total open (non-completed, non-deleted) tasks. */
  openCount(): number {
    return this.items.filter((t) => !t.isDeleted && t.taskStatus !== 'completed').length;
  }

  // ---------- Date utils ----------

  private startOfDay(d: Date): Date {
    return istStartOfDay(d);
  }

  private toIsoDate(d: Date): string {
    return istIsoDate(d);
  }

  private priorityWeight(p: string): number {
    return p === 'High' ? 3 : p === 'Medium' ? 2 : 1;
  }

  private greetingFor(d: Date): string {
    const h = toIstWall(d).hours;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }
}
