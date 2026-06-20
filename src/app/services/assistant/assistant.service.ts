import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { BehaviorSubject, forkJoin, Observable, Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TaskService } from '../task/task.service';
import { GoalService } from '../goal/goal.service';
import { NoteService } from '../note/note.service';
import { InvestmentService } from '../investment/investment.service';
import { AuthService } from '../auth/auth.service';
import {
  Goal,
  Investment,
  Note,
  Task,
} from '../../models/models';

export type AssistantTone = 'info' | 'warning' | 'danger' | 'success';
export type AssistantDomain = 'task' | 'goal' | 'note' | 'investment';
export type AssistantAction =
  | 'view-task'
  | 'mark-progress'
  | 'mark-done'
  | 'view-goal'
  | 'bump-goal'
  | 'view-investment'
  | 'view-note'
  | 'open-route';

export interface AssistantSuggestion {
  id: string;
  domain: AssistantDomain | 'system';
  /** Refers to the entity id when applicable. */
  entityId?: string;
  /** Optional route to open when CTA is `open-route`. */
  route?: string;
  tone: AssistantTone;
  title: string;
  detail: string;
  icon: string;
  cta?: { label: string; action: AssistantAction };
}

export interface AssistantMessage {
  id: string;
  author: 'bot' | 'user';
  text: string;
  timestamp: number;
  suggestions?: AssistantSuggestion[];
}

export interface AssistantSummary {
  // Tasks
  due: number;
  overdue: number;
  highOpen: number;
  inProgress: number;
  completedToday: number;
  // Goals
  goalsActive: number;
  goalsAtRisk: number;
  goalsClose: number;
  // Investments
  invMaturing: number;
  invLosingBig: number;
  // Notes
  notes: number;
  // Productivity
  streakDays: number;
}

export interface AssistantSettings {
  /** Enable/disable the recurring background scan. */
  autoScan: boolean;
  /** Scan interval in minutes. */
  intervalMinutes: number;
  /** Enable the once-a-day briefing on first open of the day. */
  dailyBriefing: boolean;
}

const STORAGE_KEY = 'tid.assistant.messages';
const SETTINGS_KEY = 'tid.assistant.settings';
const SNOOZE_KEY = 'tid.assistant.snoozes';
const BRIEFING_KEY = 'tid.assistant.briefing';
const COMPLETIONS_KEY = 'tid.assistant.completionDays';

const MAX_MESSAGES = 60;
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;

const DEFAULT_SETTINGS: AssistantSettings = {
  autoScan: true,
  intervalMinutes: 30,
  dailyBriefing: true,
};

/** ISO yyyy-mm-dd local */
function isoDay(d: Date): string {
  const pad = (n: number) => (n < 10 ? '0' + n : n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Domain logic for the AI Assistant.
 *
 * Now multi-domain aware: scans tasks, goals, notes, and investments and
 * produces actionable suggestions across all of them. Also supports a
 * once-a-day briefing, per-suggestion snooze (until next day), a productivity
 * streak counter, and quick-create commands typed in the composer
 * (`task: ...`, `note: ...`, `goal: ... target 100`).
 *
 * Lifecycle: provided in root, lives for the entire app session. `boot()`
 * is idempotent. `stop()` tears down all timers/subscriptions on logout.
 */
@Injectable({ providedIn: 'root' })
export class AssistantService implements OnDestroy {
  // --- Reactive state ---

  private messagesSubject = new BehaviorSubject<AssistantMessage[]>([]);
  readonly messages$: Observable<AssistantMessage[]> = this.messagesSubject.asObservable();

  private unreadSubject = new BehaviorSubject<number>(0);
  readonly unread$: Observable<number> = this.unreadSubject.asObservable();

  private summarySubject = new BehaviorSubject<AssistantSummary>(this.emptySummary());
  readonly summary$: Observable<AssistantSummary> = this.summarySubject.asObservable();

  private lastCheckSubject = new BehaviorSubject<number | null>(null);
  readonly lastCheck$: Observable<number | null> = this.lastCheckSubject.asObservable();

  private thinkingSubject = new BehaviorSubject<boolean>(false);
  readonly thinking$: Observable<boolean> = this.thinkingSubject.asObservable();

  private settingsSubject = new BehaviorSubject<AssistantSettings>(this.loadSettings());
  readonly settings$: Observable<AssistantSettings> = this.settingsSubject.asObservable();

  // --- Disposables ---

  private readonly destroy$ = new Subject<void>();
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  private activeSubs = new Set<Subscription>();
  private booted = false;
  private visibilityHandler: (() => void) | null = null;

  /** Suggestion ids the user has snoozed for the current day. */
  private snoozes = new Set<string>();

  constructor(
    private taskService: TaskService,
    private goalService: GoalService,
    private noteService: NoteService,
    private investmentService: InvestmentService,
    private auth: AuthService,
    private zone: NgZone
  ) {
    // Tear down on logout to avoid stale intervals/subs across sessions.
    this.auth.loggedOut$.pipe(takeUntil(this.destroy$)).subscribe(() => this.reset());
  }

  // ---------- Lifecycle ----------

  /** Start the background scan loop. Idempotent. */
  boot(): void {
    if (this.booted) return;
    this.booted = true;

    this.restore();
    this.loadSnoozes();

    // Greet only on the very first ever launch (no persisted history).
    if (this.messagesSubject.value.length === 0) {
      const name = this.firstName();
      this.pushBot(
        `${this.timeGreeting()}${name ? ', ' + name : ''}! I'm your task & investment co-pilot. I quietly watch your tasks, goals, and portfolio and gently nudge you when something needs attention. Try saying "brief me" or just chat — I'll keep up.`
      );
    }

    this.runScan(false);
    this.startPolling();
    this.attachVisibilityHandler();
  }

  /** Tear down everything. Call on logout. */
  stop(): void {
    this.clearPollHandle();
    this.clearAllTimers();
    this.cancelInflight();
    this.detachVisibilityHandler();
    this.booted = false;
  }

  /** Hard reset: clears chat history and stops timers. */
  reset(): void {
    this.stop();
    this.messagesSubject.next([]);
    this.unreadSubject.next(0);
    this.lastCheckSubject.next(null);
    this.summarySubject.next(this.emptySummary());
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SNOOZE_KEY);
      localStorage.removeItem(BRIEFING_KEY);
    } catch { /* ignore */ }
  }

  /**
   * Clear the conversation log without stopping the background scan.
   */
  clearConversation(): void {
    this.messagesSubject.next([]);
    this.unreadSubject.next(0);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    this.appendMessage({
      id: this.makeId(),
      author: 'bot',
      text: "Chat cleared. I'll keep watching for tasks, goals, and portfolio events in the background.",
      timestamp: Date.now(),
    });
  }

  ngOnDestroy(): void {
    this.stop();
    this.destroy$.next();
    this.destroy$.complete();
    this.messagesSubject.complete();
    this.unreadSubject.complete();
    this.summarySubject.complete();
    this.lastCheckSubject.complete();
    this.thinkingSubject.complete();
    this.settingsSubject.complete();
  }

  // ---------- Public actions ----------

  scanNow(): void {
    this.runScan(true);
  }

  /**
   * Force the daily briefing — always speaks even if already shown today.
   */
  briefNow(): void {
    this.runScan(true, /* forceBriefing */ true);
  }

  markAllRead(): void {
    if (this.unreadSubject.value !== 0) this.unreadSubject.next(0);
  }

  pushBot(text: string, suggestions?: AssistantSuggestion[]): void {
    this.appendMessage({
      id: this.makeId(),
      author: 'bot',
      text,
      timestamp: Date.now(),
      suggestions,
    });
    this.unreadSubject.next(this.unreadSubject.value + 1);
  }

  pushUser(text: string): void {
    this.appendMessage({
      id: this.makeId(),
      author: 'user',
      text,
      timestamp: Date.now(),
    });
  }

  /** Snooze a single suggestion until tomorrow (local day). */
  snoozeSuggestion(id: string): void {
    this.snoozes.add(id);
    this.persistSnoozes();
    this.runScan(false);
  }

  /**
   * Quick-create from the composer. Returns true if it matched a command,
   * false otherwise so the caller can do free-text Q&A handling.
   */
  tryQuickCreate(text: string): boolean {
    const m = text.match(/^\s*(task|note|goal)\s*[:\-]\s*(.+)$/i);
    if (!m) return false;
    const kind = m[1].toLowerCase() as 'task' | 'note' | 'goal';
    const body = m[2].trim();
    if (!body) return false;

    if (kind === 'task') {
      this.createTaskCmd(body);
      return true;
    }
    if (kind === 'note') {
      this.createNoteCmd(body);
      return true;
    }
    if (kind === 'goal') {
      this.createGoalCmd(body);
      return true;
    }
    return false;
  }

  /** Apply a quick action attached to a suggestion. Returns 'ok' | 'view'. */
  applyAction(suggestion: AssistantSuggestion): Observable<'ok' | 'view'> {
    return new Observable((observer) => {
      if (!suggestion.cta) {
        observer.next('view');
        observer.complete();
        return;
      }
      const action = suggestion.cta.action;

      if (
        action === 'view-task' ||
        action === 'view-goal' ||
        action === 'view-investment' ||
        action === 'view-note' ||
        action === 'open-route'
      ) {
        observer.next('view');
        observer.complete();
        return;
      }

      if (action === 'mark-progress' || action === 'mark-done') {
        const id = suggestion.entityId;
        if (!id) {
          observer.next('view');
          observer.complete();
          return;
        }
        const newStatus = action === 'mark-done' ? 'completed' : 'partiallyCompleted';
        const sub = this.taskService.editTask(id, { taskStatus: newStatus }).subscribe({
          next: () => {
            this.pushBot(
              action === 'mark-done'
                ? `"${suggestion.title}" marked as completed. One down!`
                : `Updated "${suggestion.title}" to In Progress.`
            );
            if (action === 'mark-done') this.recordCompletionToday();
            this.runScan(false);
            observer.next('ok');
            observer.complete();
          },
          error: (e) => observer.error(e),
        });
        this.activeSubs.add(sub);
        return () => {
          sub.unsubscribe();
          this.activeSubs.delete(sub);
        };
      }

      if (action === 'bump-goal' && suggestion.entityId) {
        const sub = this.goalService.getById(suggestion.entityId).subscribe({
          next: (goal) => {
            const next = Math.min(goal.targetValue, goal.currentValue + 1);
            const editSub = this.goalService
              .edit(goal._id, {
                currentValue: next,
                status: next >= goal.targetValue ? 'completed' : goal.status,
              })
              .subscribe({
                next: () => {
                  this.pushBot(
                    next >= goal.targetValue
                      ? `🎉 Goal "${goal.title}" is now complete. Big win.`
                      : `Bumped "${goal.title}" to ${next}/${goal.targetValue}.`
                  );
                  this.runScan(false);
                  observer.next('ok');
                  observer.complete();
                },
                error: (e) => observer.error(e),
              });
            this.activeSubs.add(editSub);
          },
          error: (e) => observer.error(e),
        });
        this.activeSubs.add(sub);
        return () => {
          sub.unsubscribe();
          this.activeSubs.delete(sub);
        };
      }

      observer.next('view');
      observer.complete();
      return;
    });
  }

  // ---------- Settings ----------

  updateSettings(patch: Partial<AssistantSettings>): void {
    const next: AssistantSettings = { ...this.settingsSubject.value, ...patch };
    next.intervalMinutes = Math.max(5, Math.min(120, next.intervalMinutes));
    this.settingsSubject.next(next);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    this.startPolling();
  }

  // ---------- Internals: polling ----------

  private startPolling(): void {
    this.clearPollHandle();
    const settings = this.settingsSubject.value;
    if (!settings.autoScan || !this.booted) return;

    const ms = settings.intervalMinutes * 60 * 1000;
    // Run interval outside Angular zone to avoid change detection on every tick.
    this.zone.runOutsideAngular(() => {
      this.pollHandle = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        this.zone.run(() => this.runScan(false));
      }, ms);
    });
  }

  private attachVisibilityHandler(): void {
    if (typeof document === 'undefined') return;
    this.visibilityHandler = () => {
      if (!document.hidden && this.booted) {
        const last = this.lastCheckSubject.value ?? 0;
        const intervalMs = this.settingsSubject.value.intervalMinutes * 60 * 1000;
        if (Date.now() - last > intervalMs) {
          this.runScan(false);
        }
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private detachVisibilityHandler(): void {
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private clearPollHandle(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private clearAllTimers(): void {
    this.pendingTimers.forEach(clearTimeout);
    this.pendingTimers.clear();
  }

  private cancelInflight(): void {
    this.activeSubs.forEach((s) => s.unsubscribe());
    this.activeSubs.clear();
  }

  /** Schedule a tracked timeout that's auto-cleared on stop(). */
  delay(fn: () => void, ms: number): void {
    const handle = setTimeout(() => {
      this.pendingTimers.delete(handle);
      fn();
    }, ms);
    this.pendingTimers.add(handle);
  }

  // ---------- Internals: scan ----------

  private runScan(announce: boolean, forceBriefing = false): void {
    this.thinkingSubject.next(true);
    const sub = forkJoin({
      tasks: this.taskService.getallTasks(),
      goals: this.goalService.getAll(),
      notes: this.noteService.getAll(),
      investments: this.investmentService.getAll(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ tasks, goals, notes, investments }) => {
          // Refresh per-day snoozes (auto-clear at midnight).
          this.maybeRolloverSnoozes();
          const summary = this.summarize(tasks, goals, notes, investments);
          this.summarySubject.next(summary);
          this.lastCheckSubject.next(Date.now());

          const suggestions = this.buildSuggestions(tasks, goals, investments);
          const live = tasks.filter((t) => !t.isDeleted);
          const today = isoDay(new Date());

          // Daily briefing — once a day on first scan if enabled (or on demand).
          const settings = this.settingsSubject.value;
          const lastBrief = this.loadLastBrief();
          const shouldBrief =
            forceBriefing ||
            (settings.dailyBriefing && lastBrief !== today && (announce || this.messagesSubject.value.length > 0));

          if (shouldBrief) {
            this.pushBot(
              this.craftBriefing(summary, suggestions),
              suggestions.length > 0 ? suggestions : undefined
            );
            this.persistLastBrief(today);
            this.thinkingSubject.next(false);
            return;
          }

          // Stay silent unless there's genuinely something worth surfacing.
          const hasActionableSignal =
            suggestions.length > 0 ||
            summary.overdue > 0 ||
            summary.due > 0 ||
            summary.highOpen > 0 ||
            summary.goalsAtRisk > 0 ||
            summary.invMaturing > 0;

          // Manual scans (announce=true) always reply so the user gets feedback.
          // Background polls only speak when there's a real nudge.
          const shouldSpeak = announce || hasActionableSignal;

          if (shouldSpeak) {
            const text = this.craftMessage(
              summary,
              suggestions.length,
              announce,
              live.length,
              investments.length
            );
            this.pushBot(text, suggestions.length > 0 ? suggestions : undefined);
          }
          this.thinkingSubject.next(false);
        },
        error: () => {
          this.thinkingSubject.next(false);
        },
      });
    this.activeSubs.add(sub);
  }

  private summarize(
    tasks: Task[],
    goals: Goal[],
    notes: Note[],
    investments: Investment[]
  ): AssistantSummary {
    const liveTasks = tasks.filter((t) => !t.isDeleted);
    const now = new Date();
    const todayIso = isoDay(now);
    const startToday = this.startOfDay(now);
    const liveGoals = goals.filter((g) => !g.isDeleted);
    const liveInvestments = investments.filter((i) => !i.isDeleted);

    const due = liveTasks.filter(
      (t) => t.taskStatus !== 'completed' && isoDay(new Date(t.endDate)) === todayIso
    ).length;
    const overdue = liveTasks.filter(
      (t) => t.taskStatus !== 'completed' && new Date(t.endDate) < startToday
    ).length;
    const highOpen = liveTasks.filter(
      (t) => t.priority === 'High' && t.taskStatus !== 'completed'
    ).length;
    const inProgress = liveTasks.filter((t) => t.taskStatus === 'partiallyCompleted').length;
    const completedToday = liveTasks.filter(
      (t) =>
        t.taskStatus === 'completed' &&
        isoDay(new Date(t.updatedAt)) === todayIso
    ).length;

    // Goals
    const goalsActive = liveGoals.filter((g) => g.status === 'active').length;
    const goalsAtRisk = liveGoals.filter((g) => this.isGoalAtRisk(g)).length;
    const goalsClose = liveGoals.filter((g) => this.isGoalClose(g)).length;

    // Investments
    const invMaturing = liveInvestments.filter((i) => this.isMaturingSoon(i)).length;
    const invLosingBig = liveInvestments.filter((i) => this.gainPct(i) <= -10).length;

    return {
      due, overdue, highOpen, inProgress, completedToday,
      goalsActive, goalsAtRisk, goalsClose,
      invMaturing, invLosingBig,
      notes: notes.length,
      streakDays: this.computeStreak(),
    };
  }

  private buildSuggestions(
    tasks: Task[],
    goals: Goal[],
    investments: Investment[]
  ): AssistantSuggestion[] {
    const liveTasks = tasks.filter((t) => !t.isDeleted);
    const liveGoals = goals.filter((g) => !g.isDeleted);
    const liveInvestments = investments.filter((i) => !i.isDeleted);
    const now = new Date();
    const todayIso = isoDay(now);
    const startToday = this.startOfDay(now);
    const out: AssistantSuggestion[] = [];

    // 1. Overdue tasks (most pressing) — up to 3
    const overdue = liveTasks
      .filter((t) => t.taskStatus !== 'completed' && new Date(t.endDate) < startToday)
      .sort((a, b) => +new Date(a.endDate) - +new Date(b.endDate))
      .slice(0, 3);
    overdue.forEach((t) =>
      this.maybeAdd(out, {
        id: `ov-${t._id}`,
        domain: 'task',
        entityId: t._id,
        tone: 'danger',
        icon: 'fa-triangle-exclamation',
        title: t.subject,
        detail: `Overdue since ${new Date(t.endDate).toLocaleDateString()}`,
        cta: { label: 'Mark in progress', action: 'mark-progress' },
      })
    );

    // 2. Tasks due today — up to 3
    const dueToday = liveTasks
      .filter(
        (t) =>
          t.taskStatus !== 'completed' &&
          isoDay(new Date(t.endDate)) === todayIso
      )
      .slice(0, 3);
    dueToday.forEach((t) =>
      this.maybeAdd(out, {
        id: `due-${t._id}`,
        domain: 'task',
        entityId: t._id,
        tone: 'warning',
        icon: 'fa-bell',
        title: t.subject,
        detail: "Due today — let's wrap this up.",
        cta: { label: 'Mark done', action: 'mark-done' },
      })
    );

    // 3. High-priority open tasks not already surfaced — up to 2
    const surfacedTaskIds = new Set([...overdue, ...dueToday].map((t) => t._id));
    const highPriority = liveTasks
      .filter(
        (t) =>
          t.priority === 'High' &&
          t.taskStatus !== 'completed' &&
          !surfacedTaskIds.has(t._id)
      )
      .sort((a, b) => +new Date(a.endDate) - +new Date(b.endDate))
      .slice(0, 2);
    highPriority.forEach((t) =>
      this.maybeAdd(out, {
        id: `hi-${t._id}`,
        domain: 'task',
        entityId: t._id,
        tone: 'danger',
        icon: 'fa-fire',
        title: t.subject,
        detail: 'High priority — needs attention.',
        cta: { label: 'View task', action: 'view-task' },
      })
    );

    // 4. Stalled WIP — up to 2
    const stalled = liveTasks
      .filter((t) => t.taskStatus === 'partiallyCompleted')
      .filter((t) => +now - +new Date(t.updatedAt) > 3 * 24 * 60 * 60 * 1000)
      .slice(0, 2);
    stalled.forEach((t) =>
      this.maybeAdd(out, {
        id: `stall-${t._id}`,
        domain: 'task',
        entityId: t._id,
        tone: 'info',
        icon: 'fa-spinner',
        title: t.subject,
        detail: 'In progress for 3+ days. Need a push?',
        cta: { label: 'View task', action: 'view-task' },
      })
    );

    // 5. Goals at risk (deadline approaching, progress short) — up to 2
    const goalsAtRisk = liveGoals
      .filter((g) => g.status === 'active' && this.isGoalAtRisk(g))
      .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate))
      .slice(0, 2);
    goalsAtRisk.forEach((g) => {
      const days = this.daysUntil(g.dueDate);
      const pct = this.goalPct(g);
      this.maybeAdd(out, {
        id: `gr-${g._id}`,
        domain: 'goal',
        entityId: g._id,
        tone: 'danger',
        icon: 'fa-flag',
        title: g.title,
        detail: `${pct}% done · ${days >= 0 ? days + ' day(s) left' : Math.abs(days) + ' day(s) overdue'}`,
        cta: { label: 'Bump +1', action: 'bump-goal' },
      });
    });

    // 6. Goals close to finishing — up to 2
    const goalsClose = liveGoals
      .filter((g) => g.status === 'active' && this.isGoalClose(g))
      .sort((a, b) => this.goalPct(b) - this.goalPct(a))
      .slice(0, 2);
    goalsClose.forEach((g) =>
      this.maybeAdd(out, {
        id: `gc-${g._id}`,
        domain: 'goal',
        entityId: g._id,
        tone: 'success',
        icon: 'fa-flag-checkered',
        title: g.title,
        detail: `${this.goalPct(g)}% complete — almost there!`,
        cta: { label: 'Bump +1', action: 'bump-goal' },
      })
    );

    // 7. Investments maturing soon — up to 2
    const maturing = liveInvestments
      .filter((i) => this.isMaturingSoon(i))
      .sort((a, b) => +new Date(a.maturityDate || 0) - +new Date(b.maturityDate || 0))
      .slice(0, 2);
    maturing.forEach((i) => {
      const days = this.daysUntil(i.maturityDate as string);
      this.maybeAdd(out, {
        id: `imat-${i._id}`,
        domain: 'investment',
        entityId: i._id,
        tone: 'warning',
        icon: 'fa-coins',
        title: i.name,
        detail: `Matures in ${days} day(s). Plan reinvestment.`,
        cta: { label: 'View', action: 'view-investment' },
      });
    });

    // 8. Investments with steep paper losses (>= 10%) — up to 2
    const losing = liveInvestments
      .filter((i) => this.gainPct(i) <= -10)
      .sort((a, b) => this.gainPct(a) - this.gainPct(b))
      .slice(0, 2);
    losing.forEach((i) => {
      const pct = this.gainPct(i).toFixed(1);
      this.maybeAdd(out, {
        id: `iloss-${i._id}`,
        domain: 'investment',
        entityId: i._id,
        tone: 'danger',
        icon: 'fa-chart-line',
        title: i.name,
        detail: `Down ${pct}% — review the position.`,
        cta: { label: 'View', action: 'view-investment' },
      });
    });

    return out;
  }

  // ---------- Domain helpers ----------

  private goalPct(g: Goal): number {
    if (!g.targetValue || g.targetValue <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)));
  }

  private daysUntil(iso: string): number {
    const ms = +new Date(iso) - Date.now();
    return Math.ceil(ms / (24 * 60 * 60 * 1000));
  }

  /** A goal is "at risk" if the time spent is far ahead of progress. */
  private isGoalAtRisk(g: Goal): boolean {
    if (g.status !== 'active') return false;
    const start = +new Date(g.startDate);
    const due = +new Date(g.dueDate);
    if (due <= start) return false;
    const elapsedPct = ((Date.now() - start) / (due - start)) * 100;
    const progressPct = this.goalPct(g);
    // Behind by more than 25 percentage points, or already overdue with progress < 100%.
    return elapsedPct - progressPct > 25 || (Date.now() > due && progressPct < 100);
  }

  /** "Close" — at least 80% done, less than a month to deadline. */
  private isGoalClose(g: Goal): boolean {
    if (g.status !== 'active') return false;
    const pct = this.goalPct(g);
    return pct >= 80 && pct < 100;
  }

  private isMaturingSoon(i: Investment): boolean {
    if (!i.maturityDate || i.status !== 'Active') return false;
    const days = this.daysUntil(i.maturityDate);
    return days >= 0 && days <= 30;
  }

  private gainPct(i: Investment): number {
    if (!i.amount) return 0;
    return ((i.currentValue - i.amount) / i.amount) * 100;
  }

  // ---------- Streak ----------

  private recordCompletionToday(): void {
    const today = isoDay(new Date());
    const list = this.loadCompletionDays();
    if (!list.includes(today)) {
      list.push(today);
      try {
        localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(list.slice(-90)));
      } catch { /* ignore */ }
    }
  }

  private computeStreak(): number {
    const days = new Set(this.loadCompletionDays());
    let streak = 0;
    const cur = new Date();
    while (days.has(isoDay(cur))) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }
    return streak;
  }

  private loadCompletionDays(): string[] {
    try {
      const raw = localStorage.getItem(COMPLETIONS_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  // ---------- Quick-create commands ----------

  private createTaskCmd(text: string): void {
    // Optional inline modifiers: "!high", "!medium", "!low"; "@today", "@tomorrow", "@YYYY-MM-DD"
    let priority: Task['priority'] = 'Medium';
    let endDate: Date | null = null;

    text = text.replace(/!\s*(high|medium|low)\b/i, (_, p) => {
      priority = (p[0].toUpperCase() + p.slice(1).toLowerCase()) as Task['priority'];
      return '';
    }).trim();

    text = text.replace(/@\s*(today|tomorrow|\d{4}-\d{2}-\d{2})/i, (_, when) => {
      const today = new Date();
      today.setHours(17, 0, 0, 0);
      if (when.toLowerCase() === 'today') endDate = today;
      else if (when.toLowerCase() === 'tomorrow') {
        const t = new Date(today);
        t.setDate(today.getDate() + 1);
        endDate = t;
      } else {
        const d = new Date(when + 'T17:00:00');
        if (!isNaN(d.getTime())) endDate = d;
      }
      return '';
    }).trim();

    const subject = text.replace(/\s{2,}/g, ' ').trim();
    if (!subject) {
      this.pushBot('I need a task subject after `task:`. Example: `task: review portfolio !high @tomorrow`');
      return;
    }

    const now = new Date();
    const sub = this.taskService
      .addtask({
        subject,
        description: '',
        priority,
        startDate: now.toISOString(),
        endDate: (endDate ?? now).toISOString(),
        taskStatus: 'notStarted',
        subtasks: [],
        isRemainder: true,
      })
      .subscribe({
        next: (res) => {
          this.pushBot(
            `Created task "${subject}"${
              priority !== 'Medium' ? ` (${priority} priority)` : ''
            }${endDate ? ` due ${endDate.toLocaleDateString()}` : ''}.`,
            [
              {
                id: `qc-task-${res.task._id}`,
                domain: 'task',
                entityId: res.task._id,
                tone: 'info',
                icon: 'fa-clipboard-check',
                title: subject,
                detail: 'New task created.',
                cta: { label: 'View task', action: 'view-task' },
              },
            ]
          );
          this.runScan(false);
        },
        error: (e: Error) => this.pushBot(`Couldn't create the task: ${e.message}`),
      });
    this.activeSubs.add(sub);
  }

  private createNoteCmd(text: string): void {
    // Format: "<title> | <body>" or just "<title>" or just "<body>"
    let title = '';
    let body = text.trim();
    if (body.includes('|')) {
      const [t, ...rest] = body.split('|');
      title = t.trim();
      body = rest.join('|').trim();
    } else if (body.length > 60) {
      // Use first sentence-ish as title.
      title = '';
    }

    const sub = this.noteService
      .add({ title, body, color: 'yellow', tags: [], pinned: false })
      .subscribe({
        next: (res) => {
          this.pushBot(`Saved a note${title ? `: "${title}"` : ''}.`, [
            {
              id: `qc-note-${res.note._id}`,
              domain: 'note',
              entityId: res.note._id,
              tone: 'success',
              icon: 'fa-note-sticky',
              title: title || 'Untitled note',
              detail: this.truncate(body, 80),
              cta: { label: 'Open notes', action: 'open-route' },
              route: '/notes',
            },
          ]);
        },
        error: (e: Error) => this.pushBot(`Couldn't save the note: ${e.message}`),
      });
    this.activeSubs.add(sub);
  }

  private createGoalCmd(text: string): void {
    // Format: "<title> target <number> [<unit>]"
    const m = text.match(/^(.+?)\s+target\s+(\d+(?:\.\d+)?)\s*(\S+)?\s*$/i);
    if (!m) {
      this.pushBot(
        `Use this format to create a goal: \`goal: <title> target <number> [unit]\`\nExample: \`goal: Save for laptop target 80000 ₹\``
      );
      return;
    }
    const title = m[1].trim();
    const target = Number(m[2]);
    const unit = (m[3] ?? '').trim();
    const start = new Date();
    const due = new Date();
    due.setMonth(due.getMonth() + 3);
    const sub = this.goalService
      .add({
        title,
        description: '',
        category: 'Personal',
        targetValue: target,
        currentValue: 0,
        unit,
        startDate: start.toISOString(),
        dueDate: due.toISOString(),
        status: 'active',
        milestones: [],
      })
      .subscribe({
        next: (res) => {
          this.pushBot(`Goal created: "${title}" — target ${unit}${target}.`, [
            {
              id: `qc-goal-${res.goal._id}`,
              domain: 'goal',
              entityId: res.goal._id,
              tone: 'success',
              icon: 'fa-flag-checkered',
              title,
              detail: `Target ${unit}${target} · due in 3 months`,
              cta: { label: 'View goal', action: 'view-goal' },
            },
          ]);
          this.runScan(false);
        },
        error: (e: Error) => this.pushBot(`Couldn't create the goal: ${e.message}`),
      });
    this.activeSubs.add(sub);
  }

  // ---------- Crafting ----------

  private craftBriefing(
    s: AssistantSummary,
    suggestions: AssistantSuggestion[]
  ): string {
    const greeting = this.timeGreeting();
    const name = this.firstName();
    const parts: string[] = [];
    parts.push(`☀ ${greeting}${name ? ', ' + name : ''} — here's your briefing.`);
    if (s.streakDays > 1) {
      parts.push(`🔥 ${s.streakDays}-day completion streak — keep it going.`);
    }
    if (s.overdue > 0) {
      parts.push(
        `${s.overdue} overdue ${this.plural('task', s.overdue)} need attention first.`
      );
    }
    if (s.due > 0) {
      parts.push(`${s.due} due today.`);
    }
    if (s.goalsAtRisk > 0) {
      parts.push(
        `${s.goalsAtRisk} ${this.plural('goal', s.goalsAtRisk)} at risk of slipping.`
      );
    }
    if (s.goalsClose > 0) {
      parts.push(
        `${s.goalsClose} ${this.plural('goal', s.goalsClose)} within reach — push to finish.`
      );
    }
    if (s.invMaturing > 0) {
      parts.push(
        `${s.invMaturing} ${this.plural('investment', s.invMaturing)} maturing in the next 30 days.`
      );
    }
    if (s.invLosingBig > 0) {
      parts.push(
        `${s.invLosingBig} ${this.plural('position', s.invLosingBig)} down >10%. Worth reviewing.`
      );
    }
    if (parts.length === 1) {
      parts.push(`Nothing pressing on the radar — clean slate to plan your day.`);
    }
    return parts.join(' ');
  }

  private craftMessage(
    summary: AssistantSummary,
    suggestionCount: number,
    announce: boolean,
    liveTaskCount: number,
    investmentCount = 0
  ): string {
    const greeting = this.timeGreeting();
    const name = this.firstName();

    if (summary.overdue > 0) {
      const lead = announce
        ? `${greeting}${name ? ', ' + name : ''}.`
        : `Heads up${name ? ', ' + name : ''}.`;
      return `${lead} ${summary.overdue} overdue ${this.plural('task', summary.overdue)}${
        summary.due > 0 ? ` and ${summary.due} due today` : ''
      } — let's clear them.`;
    }
    if (summary.due > 0) {
      return announce
        ? `${greeting}. ${summary.due} ${this.plural('task', summary.due)} on today's plate. Pick the smallest one and start there.`
        : `${summary.due} ${this.plural('task', summary.due)} due today. Pick one and finish it.`;
    }
    if (summary.goalsAtRisk > 0) {
      return announce
        ? `${greeting}. ${summary.goalsAtRisk} ${this.plural('goal', summary.goalsAtRisk)} drifting off pace. A small nudge today keeps momentum.`
        : `${summary.goalsAtRisk} ${this.plural('goal', summary.goalsAtRisk)} at risk — they need a nudge to stay on track.`;
    }
    if (summary.invMaturing > 0) {
      return `${summary.invMaturing} ${this.plural('investment', summary.invMaturing)} maturing within 30 days. Worth planning the reinvestment now.`;
    }
    if (summary.highOpen > 0) {
      return `${summary.highOpen} high-priority ${this.plural('task', summary.highOpen)} open. Worth a look.`;
    }
    if (summary.inProgress > 0) {
      return `${summary.inProgress} ${this.plural('task', summary.inProgress)} in progress. Want to wrap one up?`;
    }

    // Manual scan with no actionable signal — be encouraging and informative.
    if (announce) {
      const lines: string[] = [];
      if (liveTaskCount === 0 && summary.goalsActive === 0 && investmentCount === 0) {
        lines.push(
          `${greeting}${name ? ', ' + name : ''}. Nothing on your board yet — fresh slate.`
        );
        lines.push(
          `Want me to set up your first task or goal? Try \`task: review portfolio @tomorrow\` or \`goal: read 12 books target 12\`.`
        );
        return lines.join(' ');
      }
      if (summary.completedToday > 0) {
        const streak = summary.streakDays >= 2 ? ` 🔥 ${summary.streakDays}-day streak.` : '';
        return `${greeting}${name ? ', ' + name : ''}. Nice work — ${summary.completedToday} ${this.plural('task', summary.completedToday)} completed today.${streak} Want me to suggest the next one?`;
      }
      // Caught-up: include context about goals + portfolio if any.
      const ctx: string[] = [];
      if (summary.goalsActive > 0) {
        ctx.push(`${summary.goalsActive} active ${this.plural('goal', summary.goalsActive)}`);
      }
      if (investmentCount > 0) {
        ctx.push(`${investmentCount} ${this.plural('position', investmentCount)} in your portfolio`);
      }
      const tail = ctx.length ? ` Tracking ${ctx.join(' and ')}.` : '';
      return `${greeting}${name ? ', ' + name : ''}. Nothing pending right now — you're all caught up.${tail}`;
    }
    return `Here's what I noticed.`;
  }

  // ---------- Human-friendly helpers ----------

  /** Time-of-day greeting based on local clock. */
  private timeGreeting(): string {
    const h = new Date().getHours();
    if (h < 5) return 'Working late';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Hey';
  }

  /** First word of the user name, capitalized. */
  private firstName(): string {
    const raw = (this.auth.getUserName() || '').trim();
    if (!raw) return '';
    const first = raw.split(/\s+/)[0];
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }

  /** Pick a random message for variety. */
  private pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Snooze persistence ----------

  private maybeAdd(out: AssistantSuggestion[], s: AssistantSuggestion): void {
    if (this.snoozes.has(s.id)) return;
    out.push(s);
  }

  private loadSnoozes(): void {
    try {
      const raw = localStorage.getItem(SNOOZE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { day: string; ids: string[] };
      if (data.day === isoDay(new Date())) {
        this.snoozes = new Set(data.ids);
      } else {
        this.snoozes = new Set();
        localStorage.removeItem(SNOOZE_KEY);
      }
    } catch {
      this.snoozes = new Set();
    }
  }

  private maybeRolloverSnoozes(): void {
    // Reset snoozes when a new local day starts.
    const today = isoDay(new Date());
    try {
      const raw = localStorage.getItem(SNOOZE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { day: string };
        if (data.day !== today) {
          this.snoozes.clear();
          localStorage.removeItem(SNOOZE_KEY);
        }
      }
    } catch { /* ignore */ }
  }

  private persistSnoozes(): void {
    try {
      const data = { day: isoDay(new Date()), ids: Array.from(this.snoozes) };
      localStorage.setItem(SNOOZE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
  }

  // ---------- Briefing memory ----------

  private loadLastBrief(): string | null {
    try {
      return localStorage.getItem(BRIEFING_KEY);
    } catch {
      return null;
    }
  }
  private persistLastBrief(day: string): void {
    try {
      localStorage.setItem(BRIEFING_KEY, day);
    } catch { /* ignore */ }
  }

  // ---------- Storage ----------

  private appendMessage(msg: AssistantMessage): void {
    const next = [...this.messagesSubject.value, msg].slice(-MAX_MESSAGES);
    this.messagesSubject.next(next);
    this.persist();
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as AssistantMessage[];
      const recent = data.filter((m) => Date.now() - m.timestamp < MESSAGE_TTL_MS);
      if (recent.length) this.messagesSubject.next(recent);
    } catch {
      /* ignore */
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messagesSubject.value));
    } catch {
      /* ignore */
    }
  }

  private loadSettings(): AssistantSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<AssistantSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  // ---------- Utilities ----------

  private emptySummary(): AssistantSummary {
    return {
      due: 0, overdue: 0, highOpen: 0, inProgress: 0, completedToday: 0,
      goalsActive: 0, goalsAtRisk: 0, goalsClose: 0,
      invMaturing: 0, invLosingBig: 0,
      notes: 0,
      streakDays: 0,
    };
  }

  private makeId(): string {
    return 'm-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000).toString(36);
  }

  private startOfDay(d: Date): Date {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
  }

  private plural(word: string, n: number): string {
    return n === 1 ? word : word + 's';
  }

  private truncate(s: string, n: number): string {
    if (!s) return '';
    return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
  }
}
