import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { GoalService } from '../../../services/goal/goal.service';
import { DataService } from '../../../services/data/data.service';
import { Goal, GoalCategory, GoalMilestone, GoalStatus } from '../../../models/models';
import { ConfirmDialogService } from '../../confirm-dialog/confirm-dialog.service';
import {
  AppSelectComponent,
  SelectOption,
} from '../../app-select/app-select.component';
import { DateTimePickerComponent } from '../../datetime-picker/datetime-picker.component';

interface CategoryMeta {
  icon: string;
  tone: string;
  label: string;
}

const CATEGORY_META: Record<GoalCategory, CategoryMeta> = {
  Health:   { icon: 'fa-solid fa-heart-pulse',     tone: 'pink',   label: 'Health'   },
  Learning: { icon: 'fa-solid fa-book-open-reader', tone: 'blue',   label: 'Learning' },
  Finance:  { icon: 'fa-solid fa-sack-dollar',     tone: 'green',  label: 'Finance'  },
  Career:   { icon: 'fa-solid fa-briefcase',       tone: 'violet', label: 'Career'   },
  Personal: { icon: 'fa-solid fa-seedling',        tone: 'orange', label: 'Personal' },
  Habit:    { icon: 'fa-solid fa-recycle',         tone: 'slate',  label: 'Habit'    },
};

const RING_RADIUS = 26;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Pre-computed per-goal view used directly in the template. Keeps every
 * derived value out of the change-detection hot path.
 */
export interface GoalView {
  goal: Goal;
  pct: number;
  daysLeft: number;
  isOverdue: boolean;
  isCompleted: boolean;
  isPaused: boolean;
  ringDash: string;
  milestonesDone: number;
  milestonesTotal: number;
  meta: CategoryMeta;
}

@Component({
  selector: 'app-goallist',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AppSelectComponent,
    DateTimePickerComponent,
  ],
  templateUrl: './goallist.component.html',
  styleUrl: './goallist.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoallistComponent implements OnInit, OnDestroy {
  /** Raw goals as returned by the service. */
  private goals: Goal[] = [];
  /** Pre-computed views — what the template renders. */
  views: GoalView[] = [];

  searchText = '';
  filterStatus: 'all' | GoalStatus = 'all';
  filterCategory: 'all' | GoalCategory = 'all';

  // Cached aggregates — recomputed only when goals change.
  totalCount = 0;
  activeCount = 0;
  completedCount = 0;
  avgProgress = 0;

  editorOpen = false;
  editing: Goal | null = null;
  draft = this.blankDraft();

  /** Free-text working buffer for adding milestones in the editor. */
  newMilestoneLabel = '';

  readonly categoryMeta = CATEGORY_META;
  readonly categoryOptions: SelectOption[] = (
    Object.keys(CATEGORY_META) as GoalCategory[]
  ).map((c) => ({ value: c, label: c, icon: CATEGORY_META[c].icon }));

  readonly statusOptions: SelectOption[] = [
    { value: 'all',       label: 'All goals',     icon: 'fa-solid fa-list' },
    { value: 'active',    label: 'In progress',   icon: 'fa-solid fa-spinner', tone: 'info' },
    { value: 'completed', label: 'Completed',     icon: 'fa-solid fa-check',   tone: 'accent' },
    { value: 'paused',    label: 'Paused',        icon: 'fa-solid fa-pause',   tone: 'muted' },
  ];

  readonly categoryFilterOptions: SelectOption[] = [
    { value: 'all', label: 'All categories', icon: 'fa-solid fa-tags' },
    ...this.categoryOptions,
  ];

  readonly editorStatusOptions: SelectOption[] = [
    { value: 'active',    label: 'In progress', icon: 'fa-solid fa-spinner' },
    { value: 'completed', label: 'Completed',   icon: 'fa-solid fa-check'   },
    { value: 'paused',    label: 'Paused',      icon: 'fa-solid fa-pause'   },
  ];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private goalService: GoalService,
    private dataService: DataService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- Data ----------

  load(): void {
    // GoalService is in-memory (defer + Promise.resolve), so this resolves
    // synchronously on the same microtask. No spinner flash is needed.
    this.goalService
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.goals = res;
          this.recomputeAll();
          this.cdr.markForCheck();
        },
        error: (err: Error) => this.dataService.showerrorToaster(err.message),
      });
  }

  // ---------- Filter input → recompute view ----------

  onSearchChange(): void {
    this.rebuildViews();
    this.cdr.markForCheck();
  }
  onStatusFilter(): void {
    this.rebuildViews();
    this.cdr.markForCheck();
  }
  onCategoryFilter(): void {
    this.rebuildViews();
    this.cdr.markForCheck();
  }

  // ---------- Derived calc — ONLY called on data/filter changes ----------

  private recomputeAll(): void {
    this.recomputeStats();
    this.rebuildViews();
  }

  private recomputeStats(): void {
    const total = this.goals.length;
    let active = 0;
    let completed = 0;
    let progressSum = 0;
    for (const g of this.goals) {
      if (g.status === 'active') active++;
      if (g.status === 'completed') completed++;
      progressSum += this.computePct(g);
    }
    this.totalCount = total;
    this.activeCount = active;
    this.completedCount = completed;
    this.avgProgress = total > 0 ? Math.round(progressSum / total) : 0;
  }

  private rebuildViews(): void {
    const q = this.searchText.trim().toLowerCase();
    const now = Date.now();
    const statusOrder: Record<GoalStatus, number> = {
      active: 0, paused: 1, completed: 2,
    };

    const filtered = this.goals.filter((g) => {
      const matchesText =
        !q ||
        g.title.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q);
      const matchesStatus =
        this.filterStatus === 'all' || g.status === this.filterStatus;
      const matchesCategory =
        this.filterCategory === 'all' || g.category === this.filterCategory;
      return matchesText && matchesStatus && matchesCategory;
    });

    filtered.sort((a, b) => {
      const diff = statusOrder[a.status] - statusOrder[b.status];
      if (diff !== 0) return diff;
      return +new Date(a.dueDate) - +new Date(b.dueDate);
    });

    this.views = filtered.map((g) => this.buildView(g, now));
  }

  private buildView(g: Goal, now: number): GoalView {
    const pct = this.computePct(g);
    const daysLeft = Math.ceil((+new Date(g.dueDate) - now) / MS_PER_DAY);
    const isCompleted = g.status === 'completed';
    const isPaused = g.status === 'paused';
    const isOverdue = g.status === 'active' && daysLeft < 0;
    let done = 0;
    for (const m of g.milestones) if (m.done) done++;
    return {
      goal: g,
      pct,
      daysLeft,
      isOverdue,
      isCompleted,
      isPaused,
      ringDash: `${(pct / 100) * RING_CIRC} ${RING_CIRC}`,
      milestonesDone: done,
      milestonesTotal: g.milestones.length,
      meta: CATEGORY_META[g.category],
    };
  }

  private computePct(g: Goal): number {
    if (!g.targetValue || g.targetValue <= 0) return 0;
    const raw = (g.currentValue / g.targetValue) * 100;
    return raw < 0 ? 0 : raw > 100 ? 100 : Math.round(raw);
  }

  // ---------- Editor ----------

  openCreate(): void {
    this.editing = null;
    this.draft = this.blankDraft();
    this.newMilestoneLabel = '';
    this.editorOpen = true;
    document.body.style.overflow = 'hidden';
  }

  openEdit(goal: Goal): void {
    this.editing = goal;
    this.draft = {
      title: goal.title,
      description: goal.description,
      category: goal.category,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      unit: goal.unit,
      startDate: goal.startDate,
      dueDate: goal.dueDate,
      status: goal.status,
      milestones: goal.milestones.map((m) => ({ ...m })),
    };
    this.newMilestoneLabel = '';
    this.editorOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeEditor(): void {
    this.editorOpen = false;
    document.body.style.overflow = '';
  }

  save(): void {
    if (!this.draft.title.trim()) {
      this.dataService.showerrorToaster('Goal title is required.');
      return;
    }
    if (!this.draft.targetValue || this.draft.targetValue <= 0) {
      this.dataService.showerrorToaster('Target must be a positive number.');
      return;
    }

    const payload: Partial<Goal> = {
      title: this.draft.title,
      description: this.draft.description,
      category: this.draft.category,
      targetValue: Number(this.draft.targetValue),
      currentValue: Math.max(0, Number(this.draft.currentValue ?? 0)),
      unit: this.draft.unit,
      startDate: this.draft.startDate,
      dueDate: this.draft.dueDate,
      status: this.draft.status,
      milestones: this.draft.milestones,
    };

    const op$ = this.editing
      ? this.goalService.edit(this.editing._id, payload)
      : this.goalService.add(payload);

    op$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.dataService.showSuccessToasterMsg(res.message);
        this.closeEditor();
        this.load();
      },
      error: (err: Error) => this.dataService.showerrorToaster(err.message),
    });
  }

  // ---------- Card actions ----------

  bumpProgress(view: GoalView, delta: number, ev: Event): void {
    ev.stopPropagation();
    const goal = view.goal;
    const next = Math.max(0, Math.min(goal.targetValue, goal.currentValue + delta));
    if (next === goal.currentValue) return;
    const newStatus: GoalStatus =
      next >= goal.targetValue
        ? 'completed'
        : goal.status === 'completed'
        ? 'active'
        : goal.status;
    this.goalService
      .edit(goal._id, { currentValue: next, status: newStatus })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: (err: Error) => this.dataService.showerrorToaster(err.message),
      });
  }

  toggleStatus(view: GoalView, ev: Event): void {
    ev.stopPropagation();
    const goal = view.goal;
    const next: GoalStatus =
      goal.status === 'active'
        ? 'paused'
        : goal.status === 'paused'
        ? 'active'
        : 'active';
    this.goalService
      .setStatus(goal._id, next)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: (err: Error) => this.dataService.showerrorToaster(err.message),
      });
  }

  toggleMilestone(view: GoalView, m: GoalMilestone, ev: Event): void {
    ev.stopPropagation();
    this.goalService
      .toggleMilestone(view.goal._id, m.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: (err: Error) => this.dataService.showerrorToaster(err.message),
      });
  }

  async remove(view: GoalView, ev: Event): Promise<void> {
    ev.stopPropagation();
    const ok = await this.confirmDialog.ask({
      eyebrow: 'Delete goal',
      title: `Delete "${view.goal.title}"?`,
      message:
        'This goal and all its milestones will be removed permanently. This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete goal',
      icon: 'fa-solid fa-trash',
    });
    if (!ok) return;
    this.goalService
      .delete(view.goal._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.dataService.showSuccessToasterMsg(res.message);
          this.load();
        },
        error: (err: Error) => this.dataService.showerrorToaster(err.message),
      });
  }

  // ---------- Editor milestone helpers ----------

  addMilestoneToDraft(): void {
    const label = this.newMilestoneLabel.trim();
    if (!label) return;
    this.draft.milestones.push({
      id: 'm-' + Date.now().toString(36),
      label,
      done: false,
    });
    this.newMilestoneLabel = '';
  }

  removeMilestoneFromDraft(i: number): void {
    this.draft.milestones.splice(i, 1);
  }

  toggleDraftMilestone(i: number): void {
    this.draft.milestones[i].done = !this.draft.milestones[i].done;
  }

  trackByView(_i: number, v: GoalView): string {
    return v.goal._id;
  }
  trackMilestone(_i: number, m: GoalMilestone): string {
    return m.id;
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.editorOpen) this.closeEditor();
  }

  private blankDraft() {
    const today = new Date();
    const due = new Date(today);
    due.setMonth(due.getMonth() + 3);
    return {
      title: '',
      description: '',
      category: 'Personal' as GoalCategory,
      targetValue: 100,
      currentValue: 0,
      unit: '',
      startDate: today.toISOString(),
      dueDate: due.toISOString(),
      status: 'active' as GoalStatus,
      milestones: [] as GoalMilestone[],
    };
  }
}
