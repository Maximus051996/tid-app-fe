import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
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
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  AssistantMessage,
  AssistantService,
  AssistantSettings,
  AssistantSuggestion,
  AssistantSummary,
} from '../../services/assistant/assistant.service';
import { DataService } from '../../services/data/data.service';
import { AuthService } from '../../services/auth/auth.service';
import { formatIst, istIsoDate } from '../../utils/ist-time';

type QuickPrompt = { label: string; icon: string; prompt: string };

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assistant.component.html',
  styleUrl: './assistant.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantComponent implements OnInit, AfterViewChecked, OnDestroy {
  open = false;
  showSettings = false;
  /** Confirm-clear banner state inside the feed. */
  confirmingClear = false;
  messages: AssistantMessage[] = [];
  unread = 0;
  thinking = false;
  summary: AssistantSummary = {
    due: 0, overdue: 0, highOpen: 0, inProgress: 0, completedToday: 0,
    goalsActive: 0, goalsAtRisk: 0, goalsClose: 0,
    invMaturing: 0, invLosingBig: 0,
    notes: 0,
    streakDays: 0,
  };
  lastCheck: number | null = null;
  settings: AssistantSettings = { autoScan: true, intervalMinutes: 30, dailyBriefing: true };

  draft = '';
  /** Track when feed needs auto-scroll so we don't scroll on every CD pass. */
  private shouldScroll = false;

  /** Unique id for SVG gradient/clip-path references. */
  private static instanceCounter = 0;
  readonly uid = 'a' + ++AssistantComponent.instanceCounter;

  readonly quickPrompts: QuickPrompt[] = [
    { label: 'Brief me', icon: 'fa-solid fa-sun', prompt: 'brief me' },
    { label: 'Due today', icon: 'fa-regular fa-calendar', prompt: "What's due today?" },
    { label: 'Overdue', icon: 'fa-solid fa-triangle-exclamation', prompt: 'Show overdue' },
    { label: 'Goals', icon: 'fa-solid fa-flag-checkered', prompt: 'How are my goals?' },
    { label: 'Portfolio', icon: 'fa-solid fa-chart-line', prompt: 'Portfolio update' },
    { label: 'Streak', icon: 'fa-solid fa-fire', prompt: 'streak' },
    { label: 'Scan now', icon: 'fa-solid fa-rotate', prompt: 'Scan now' },
  ];

  @ViewChild('feed') feedRef?: ElementRef<HTMLDivElement>;
  @ViewChild('input') inputRef?: ElementRef<HTMLInputElement>;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private assistant: AssistantService,
    private router: Router,
    private data: DataService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.assistant.boot();

    this.assistant.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((m) => {
        this.messages = m;
        this.shouldScroll = true;
        this.cdr.markForCheck();
      });

    this.assistant.unread$
      .pipe(takeUntil(this.destroy$))
      .subscribe((u) => { this.unread = u; this.cdr.markForCheck(); });

    this.assistant.summary$
      .pipe(takeUntil(this.destroy$))
      .subscribe((s) => { this.summary = s; this.cdr.markForCheck(); });

    this.assistant.lastCheck$
      .pipe(takeUntil(this.destroy$))
      .subscribe((t) => { this.lastCheck = t; this.cdr.markForCheck(); });

    this.assistant.thinking$
      .pipe(takeUntil(this.destroy$))
      .subscribe((b) => { this.thinking = b; this.cdr.markForCheck(); });

    this.assistant.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe((s) => { this.settings = s; this.cdr.markForCheck(); });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.open && this.feedRef) {
      const el = this.feedRef.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- Panel state ----------

  togglePanel(): void {
    this.open = !this.open;
    if (this.open) {
      this.assistant.markAllRead();
      this.shouldScroll = true;
      // Focus the composer for keyboard users
      requestAnimationFrame(() => this.inputRef?.nativeElement.focus());
    } else {
      this.showSettings = false;
    }
  }

  closePanel(): void {
    this.open = false;
    this.showSettings = false;
  }

  toggleSettings(): void {
    this.showSettings = !this.showSettings;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.closePanel();
  }

  // ---------- Actions ----------

  scanNow(): void {
    this.assistant.scanNow();
  }

  briefMe(): void {
    this.assistant.briefNow();
  }

  send(): void {
    const text = this.draft.trim();
    if (!text) return;
    this.assistant.pushUser(text);
    this.draft = '';
    // Quick-create commands first — `task: ...`, `note: ...`, `goal: ... target N`.
    if (this.assistant.tryQuickCreate(text)) return;
    this.respondTo(text);
  }

  ask(prompt: string): void {
    this.assistant.pushUser(prompt);
    if (this.assistant.tryQuickCreate(prompt)) return;
    this.respondTo(prompt);
  }

  private respondTo(text: string): void {
    const lower = text.toLowerCase().trim();

    // Greetings & small talk — keep it warm and human.
    if (/^(hi|hii|hello|hey|yo|hola|good (morning|afternoon|evening))\b/.test(lower)) {
      this.assistant.pushBot(this.greetingReply());
      return;
    }
    if (/^(how are you|how's it going|hows it going|what's up|sup)\b/.test(lower)) {
      this.assistant.pushBot(
        this.pick([
          `Doing great — quietly watching your tasks. How are you?`,
          `All systems quiet. Anything I can help you knock off your plate?`,
          `Good. Want me to brief you on what's pending?`,
        ])
      );
      return;
    }
    if (/^(thanks|thank you|thx|ty|cheers|appreciate it)\b/.test(lower)) {
      this.assistant.pushBot(
        this.pick([
          `Anytime. Holler when you need another nudge.`,
          `Of course. Keep going.`,
          `Happy to help. One foot in front of the other.`,
        ])
      );
      return;
    }
    if (/^(bye|goodbye|see you|gn|good night|cya)\b/.test(lower)) {
      this.assistant.pushBot(
        this.pick([
          `Take care. I'll keep an eye on your dashboard.`,
          `Catch you later. Rest well.`,
          `Bye. I'll be here when you get back.`,
        ])
      );
      return;
    }
    if (/(stressed|overwhelm|tired|busy|too much)/.test(lower)) {
      this.assistant.pushBot(
        `That's real — pick the smallest task and finish just that one. Momentum often beats motivation. Want me to suggest the easiest open task?`
      );
      return;
    }
    if (/(motivat|inspire|push me|let's go)/.test(lower)) {
      this.assistant.pushBot(
        this.pick([
          `Small actions compound. Open one task and start a five-minute timer.`,
          `Done is better than perfect. Pick the one you've been avoiding.`,
          `Future-you will thank present-you for this. Go.`,
        ])
      );
      return;
    }

    // Domain Q&A
    if (/\b(brief|briefing|summary|summarize|recap)\b/.test(lower)) {
      this.assistant.briefNow();
      return;
    }
    if (/\b(scan|check|refresh|update)\b/.test(lower)) {
      this.assistant.scanNow();
      return;
    }
    if (/\b(streak|consistent|chain)\b/.test(lower)) {
      const s = this.summary.streakDays;
      this.assistant.pushBot(
        s === 0
          ? `No streak yet. Complete one task today and the count begins.`
          : s === 1
          ? `Day one. Make tomorrow day two.`
          : `🔥 ${s}-day completion streak. Don't break the chain.`
      );
      return;
    }
    if (/\b(goal|goals)\b/.test(lower)) {
      this.assistant.pushBot(this.goalUpdate());
      return;
    }
    if (/\b(portfolio|investment|invest|stock|fd|bond|crypto)\b/.test(lower)) {
      this.assistant.pushBot(this.portfolioUpdate());
      return;
    }
    if (/\b(note|notes)\b/.test(lower)) {
      this.assistant.pushBot(
        this.summary.notes === 0
          ? `No notes yet. Try \`note: My first idea\` to capture one in a tap.`
          : `${this.summary.notes} note(s) saved. Open them from the Notes tab.`
      );
      return;
    }
    if (/\b(today|due)\b/.test(lower)) {
      this.assistant.pushBot(
        this.summary.due === 0
          ? `Nothing due today. Want me to look at what's coming up next?`
          : `${this.summary.due} task(s) due today. Tap any nudge above to act on them.`
      );
      return;
    }
    if (/overdue/.test(lower)) {
      this.assistant.pushBot(
        this.summary.overdue === 0
          ? `Nothing overdue — you're keeping up.`
          : `${this.summary.overdue} task(s) overdue. Tap any nudge above to act on them.`
      );
      return;
    }
    if (/\b(in progress|wip|working on)\b/.test(lower)) {
      this.assistant.pushBot(
        this.summary.inProgress === 0
          ? `Nothing in progress at the moment. Pick one to start.`
          : `${this.summary.inProgress} task(s) in progress. Want to push one to "Done"?`
      );
      return;
    }
    if (/calendar/.test(lower)) {
      this.assistant.pushBot(`Opening the calendar.`);
      this.router.navigate(['/calendar']);
      this.closePanel();
      return;
    }
    if (/\b(help|what can you do|how|commands?)\b/.test(lower)) {
      this.assistant.pushBot(this.helpMessage());
      return;
    }

    // Default fallback — friendly, with a hint of next step.
    this.assistant.pushBot(
      this.pick([
        `I didn't quite catch that. Try "brief me", "due today", or just type \`task: ...\` to add one.`,
        `Hmm, I'm not sure how to help with that. Want a quick briefing instead?`,
        `Tap a chip below or try "scan now" for a fresh status check.`,
      ])
    );
  }

  private greetingReply(): string {
    const greeting = this.timeGreeting();
    const name = this.firstName();
    const namePart = name ? `, ${name}` : '';
    return this.pick([
      `${greeting}${namePart}! Ready when you are. Want a quick briefing?`,
      `Hey${namePart}! What's first today?`,
      `${greeting}${namePart}. Need a status check or want to add something?`,
    ]);
  }

  private timeGreeting(): string {
    const h = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours();
    if (h < 5) return 'Working late';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Hey';
  }

  private firstName(): string {
    const raw = (this.auth.getUserName() || '').trim();
    if (!raw) return '';
    const first = raw.split(/\s+/)[0];
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }

  private pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private goalUpdate(): string {
    const s = this.summary;
    if (s.goalsActive === 0) {
      return `No active goals. Create one with \`goal: <title> target <number> [unit]\`.`;
    }
    const parts: string[] = [`${s.goalsActive} active goal(s).`];
    if (s.goalsAtRisk > 0) parts.push(`${s.goalsAtRisk} at risk.`);
    if (s.goalsClose > 0) parts.push(`${s.goalsClose} within reach.`);
    return parts.join(' ');
  }

  private portfolioUpdate(): string {
    const s = this.summary;
    const parts: string[] = [];
    if (s.invMaturing > 0)
      parts.push(`${s.invMaturing} investment(s) maturing within 30 days.`);
    if (s.invLosingBig > 0)
      parts.push(`${s.invLosingBig} position(s) down 10%+. Worth reviewing.`);
    if (parts.length === 0) parts.push(`Portfolio looks calm. Nothing urgent.`);
    return parts.join(' ');
  }

  private helpMessage(): string {
    return [
      `Here's what I can do:`,
      `• Brief me — daily summary across tasks, goals, portfolio`,
      `• Scan now — recheck immediately`,
      `• Show overdue / due today / in progress`,
      `• How are my goals? — goal progress recap`,
      `• Portfolio — maturing soon and big movers`,
      `• Streak — your completion streak`,
      ``,
      `Quick create from this composer:`,
      `• \`task: review portfolio !high @tomorrow\``,
      `• \`note: Title | body text\``,
      `• \`goal: Save for laptop target 80000 ₹\``,
    ].join('\n');
  }

  applySuggestion(s: AssistantSuggestion): void {
    if (!s.cta) return;
    if (s.cta.action === 'view-task' && s.entityId) {
      this.router.navigate(['/view-task', s.entityId]);
      this.closePanel();
      return;
    }
    if (s.cta.action === 'view-goal' && s.entityId) {
      this.router.navigate(['/goals']);
      this.closePanel();
      return;
    }
    if (s.cta.action === 'view-investment' && s.entityId) {
      this.router.navigate(['/view-investment', s.entityId]);
      this.closePanel();
      return;
    }
    if (s.cta.action === 'view-note' && s.entityId) {
      this.router.navigate(['/notes']);
      this.closePanel();
      return;
    }
    if (s.cta.action === 'open-route' && s.route) {
      this.router.navigate([s.route]);
      this.closePanel();
      return;
    }
    this.assistant
      .applyAction(s)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (result === 'view' && s.entityId) {
            // Default fall-through navigation depends on domain.
            const route =
              s.domain === 'goal'
                ? '/goals'
                : s.domain === 'investment'
                ? `/view-investment/${s.entityId}`
                : s.domain === 'note'
                ? '/notes'
                : `/view-task/${s.entityId}`;
            this.router.navigate([route]);
            this.closePanel();
          }
        },
        error: (err) => this.data.showerrorToaster(err?.message || 'Action failed'),
      });
  }

  goToTask(s: AssistantSuggestion, ev?: Event): void {
    if (ev) ev.stopPropagation();
    if (!s.entityId) {
      if (s.route) {
        this.router.navigate([s.route]);
        this.closePanel();
      }
      return;
    }
    if (s.domain === 'goal') {
      this.router.navigate(['/goals']);
    } else if (s.domain === 'investment') {
      this.router.navigate(['/view-investment', s.entityId]);
    } else if (s.domain === 'note') {
      this.router.navigate(['/notes']);
    } else {
      this.router.navigate(['/view-task', s.entityId]);
    }
    this.closePanel();
  }

  /** Snooze a suggestion until tomorrow. */
  snoozeSuggestion(s: AssistantSuggestion, ev: Event): void {
    ev.stopPropagation();
    this.assistant.snoozeSuggestion(s.id);
  }

  // ---------- Settings ----------

  toggleAutoScan(): void {
    this.assistant.updateSettings({ autoScan: !this.settings.autoScan });
  }

  toggleDailyBriefing(): void {
    this.assistant.updateSettings({ dailyBriefing: !this.settings.dailyBriefing });
  }

  setInterval(minutes: number): void {
    this.assistant.updateSettings({ intervalMinutes: minutes });
  }

  clearChat(): void {
    if (!this.messages.length) return;
    this.confirmingClear = true;
  }

  confirmClear(): void {
    this.assistant.clearConversation();
    this.confirmingClear = false;
  }

  cancelClear(): void {
    this.confirmingClear = false;
  }

  // ---------- Display helpers ----------

  hasPending(): boolean {
    return this.summary.overdue + this.summary.due > 0;
  }

  pendingCount(): number {
    return this.summary.overdue + this.summary.due;
  }

  lastCheckLabel(): string {
    if (!this.lastCheck) return 'Not checked yet';
    const diff = Math.floor((Date.now() - this.lastCheck) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
    return formatIst(new Date(this.lastCheck), {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  timeOf(ts: number): string {
    return formatIst(new Date(ts), {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  /** Group messages by IST date label for a friendlier feed. */
  shouldShowDateBreak(index: number): boolean {
    if (index === 0) return true;
    const prev = this.messages[index - 1];
    const cur = this.messages[index];
    return istIsoDate(new Date(prev.timestamp)) !== istIsoDate(new Date(cur.timestamp));
  }

  dayLabel(ts: number): string {
    const d = new Date(ts);
    const todayIso = istIsoDate(new Date());
    const yest = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dIso = istIsoDate(d);
    if (dIso === todayIso) return 'Today';
    if (dIso === istIsoDate(yest)) return 'Yesterday';
    return formatIst(d, { weekday: 'long', month: 'short', day: 'numeric' });
  }

  trackByMessage(_: number, m: AssistantMessage): string {
    return m.id;
  }

  trackBySuggestion(_: number, s: AssistantSuggestion): string {
    return s.id;
  }
}
