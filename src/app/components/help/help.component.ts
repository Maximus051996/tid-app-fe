import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  APP_AUTHOR,
  APP_COPYRIGHT,
  APP_NAME,
  APP_RELEASE_DATE,
  APP_RELEASE_NAME,
  APP_VERSION,
  DOC_PATHS,
} from '../../app-info';
import { AuthService } from '../../services/auth/auth.service';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';

interface HelpStep {
  icon: string;
  title: string;
  detail: string;
  tone: 'accent' | 'info' | 'warning' | 'violet' | 'pink';
}

interface HelpModule {
  icon: string;
  title: string;
  detail: string;
  steps: string[];
  tone: 'accent' | 'info' | 'warning' | 'violet' | 'pink' | 'danger';
  adminOnly?: boolean;
}

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, RouterLink, BrandLogoComponent],
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpComponent {
  readonly appName = APP_NAME;
  readonly version = APP_VERSION;
  readonly releaseName = APP_RELEASE_NAME;
  readonly releaseDate = APP_RELEASE_DATE;
  readonly author = APP_AUTHOR;
  readonly copyright = APP_COPYRIGHT;
  readonly userGuide = DOC_PATHS.userGuide;
  readonly releaseNotes = DOC_PATHS.releaseNotes;
  readonly isAdmin: boolean;

  constructor(private auth: AuthService) {
    this.isAdmin = this.auth.isAdmin();
  }

  /** Modules visible to the current user — admin-only entries are hidden for normal users. */
  get visibleModules(): HelpModule[] {
    return this.modules.filter((m) => !m.adminOnly || this.isAdmin);
  }

  readonly quickSteps: HelpStep[] = [
    {
      icon: 'fa-solid fa-right-to-bracket',
      title: '1 · Sign in',
      detail: 'Use your username (or email) and password. New here? Click "Create account" on the login screen.',
      tone: 'info',
    },
    {
      icon: 'fa-solid fa-flag-checkered',
      title: '2 · Set a goal',
      detail: 'Open Goals → New goal. Pick a category, set target + unit, optionally add milestones. Bump progress with +/- on the card.',
      tone: 'accent',
    },
    {
      icon: 'fa-solid fa-clipboard-check',
      title: '3 · Capture tasks',
      detail: 'Tasks → Add Task. Set priority and due date. Or just chat with the AI Co-pilot: `task: review portfolio !high @tomorrow`.',
      tone: 'warning',
    },
    {
      icon: 'fa-solid fa-note-sticky',
      title: '4 · Note ideas',
      detail: 'Notes → New note. Pick a color, add tags, pin the important ones to the top.',
      tone: 'pink',
    },
    {
      icon: 'fa-solid fa-robot',
      title: '5 · Use the AI Co-pilot',
      detail: 'Open the orb in the bottom-right. Tap the sun icon for a daily briefing. Type quick-create commands. Snooze suggestions you can\'t act on right now.',
      tone: 'violet',
    },
  ];

  readonly modules: HelpModule[] = [
    {
      icon: 'fa-solid fa-flag-checkered',
      title: 'Goals',
      detail: 'Outcome tracking with progress rings and milestones.',
      steps: [
        'Create a goal with a target, unit, and due date.',
        'Bump progress with the + button on the card.',
        'Toggle milestones as you complete them.',
        'Pause goals you need to set aside; resume when ready.',
      ],
      tone: 'accent',
    },
    {
      icon: 'fa-solid fa-clipboard-check',
      title: 'Tasks',
      detail: 'Day-to-day to-do list with priorities and reminders.',
      steps: [
        'Add a task with subject, priority, and end date.',
        'Use subtasks for multi-step work.',
        'Filter by status using the segmented control.',
        'Click a day in the strip to focus on that day\'s tasks.',
      ],
      tone: 'warning',
    },
    {
      icon: 'fa-solid fa-note-sticky',
      title: 'Notes',
      detail: 'Sticky-note board for thoughts, lists, and reminders.',
      steps: [
        'Create a note with title, body, and color.',
        'Add comma-separated tags for findability.',
        'Pin the ones that matter most so they stay on top.',
        'Search by title, body, or tag in the toolbar.',
      ],
      tone: 'pink',
    },
    {
      icon: 'fa-solid fa-calendar-week',
      title: 'Calendar',
      detail: 'Month view with everything plotted by date.',
      steps: [
        'Click any day to open the side panel.',
        'Click a chip to drill into the task.',
        'Use the + on the toolbar to add a task pre-filled to that day.',
      ],
      tone: 'info',
    },
    {
      icon: 'fa-solid fa-chart-line',
      title: 'Investments',
      detail: 'Portfolio tracking with allocation and performance charts.',
      steps: [
        'Add positions with type, amount, current value, and risk.',
        'Set a maturity date for FDs and bonds — the AI will remind you 30 days out.',
        'KPIs at the top show totals, gain/loss, and percent return.',
      ],
      tone: 'violet',
    },
    {
      icon: 'fa-solid fa-user-shield',
      title: 'Admin tools',
      detail: 'Available only on admin accounts.',
      steps: [
        'User directory — promote, demote, or remove accounts.',
        'Reset data picker — wipe a single user\'s data, or reset everything.',
        '"Reset everything" requires typing RESET to confirm.',
      ],
      tone: 'danger',
      adminOnly: true,
    },
  ];

  readonly tips = [
    {
      icon: 'fa-solid fa-bolt',
      title: 'Quick-create from the AI',
      lines: [
        'task: review portfolio !high @tomorrow',
        'note: Title | body text',
        'goal: Save for laptop target 80000 ₹',
      ],
    },
    {
      icon: 'fa-solid fa-keyboard',
      title: 'Keyboard shortcuts',
      lines: [
        'Esc — close any modal or the AI panel',
        'Enter — confirm in dialogs and submit chat messages',
      ],
    },
    {
      icon: 'fa-solid fa-shield-halved',
      title: 'Your data',
      lines: [
        'Stored locally on this device only.',
        'Encrypted at rest with AES-256-GCM.',
        'Tokens use PASETO v3.local; passwords use PBKDF2.',
      ],
    },
  ];

  /** Open the doc in a new tab — the user can print to PDF from there. */
  open(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
