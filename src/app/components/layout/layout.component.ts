import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../services/auth/auth.service';
import { NgxSpinnerModule } from 'ngx-spinner';
import { DataService } from '../../services/data/data.service';
import { AssistantComponent } from '../assistant/assistant.component';
import { Theme, ThemeService } from '../../services/theme/theme.service';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';
import { StorageService } from '../../services/storage/storage.service';
import {
  APP_AUTHOR,
  APP_COPYRIGHT,
  APP_NAME,
  APP_VERSION,
} from '../../app-info';

interface MenuItem {
  name: string;
  path: string;
  icon: string;
  badge?: 'tasks' | 'investments' | 'notes' | 'goals';
  /** Inline action icon shown on the right (collapsed: hidden). */
  action?: 'add-task';
  adminOnly?: boolean;
}

const COLLAPSED_KEY = 'tid.sidebar.collapsed';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    CommonModule,
    RouterLinkActive,
    NgxSpinnerModule,
    AssistantComponent,
    BrandLogoComponent,
  ],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent implements OnInit, OnDestroy {
  userName: string | null = null;
  role: string | null = null;
  taskCount = 0;
  investmentCount = 0;

  collapsed = false;
  mobileOpen = false;
  isMobile = false;

  noteCount = 0;
  goalCount = 0;

  readonly appName = APP_NAME;
  readonly appVersion = APP_VERSION;
  readonly appAuthor = APP_AUTHOR;
  readonly appCopyright = APP_COPYRIGHT;

  /** Treat as collapsed only when desktop sidebar is collapsed. */
  get isCollapsed(): boolean {
    return this.collapsed && !this.isMobile;
  }

  theme: Theme = 'dark';

  primaryMenu: MenuItem[] = [
    { name: 'Goals',  path: 'goals', icon: 'fa-solid fa-flag-checkered',  badge: 'goals' },
    { name: 'Tasks', path: 'taskinfo', icon: 'fa-solid fa-clipboard-check', badge: 'tasks' },
    { name: 'Notes',  path: 'notes', icon: 'fa-solid fa-note-sticky',     badge: 'notes' },
    {
      name: 'Calendar',
      path: 'calendar',
      icon: 'fa-solid fa-calendar-week',
      action: 'add-task',
    },
    {
      name: 'Investments',
      path: 'investmentinfo',
      icon: 'fa-solid fa-chart-line',
      badge: 'investments',
    },
    {
      name: 'Admin Console',
      path: 'admin',
      icon: 'fa-solid fa-user-shield',
      adminOnly: true,
    },
  ];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private dataService: DataService,
    private themeService: ThemeService,
    private storage: StorageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userName = this.authService.getUserName();
    this.role = this.authService.getRole();

    this.dataService.currentData
      .pipe(takeUntil(this.destroy$))
      .subscribe((c) => (this.taskCount = c));

    this.dataService.investmentCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe((c) => (this.investmentCount = c));

    this.themeService.theme$
      .pipe(takeUntil(this.destroy$))
      .subscribe((t) => (this.theme = t));

    this.refreshSecondaryCounts();
    // Recompute notes/goals counts whenever a navigation finishes —
    // cheap (in-memory list count) and keeps the badges accurate.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.refreshSecondaryCounts());

    this.detectViewport();
    this.collapsed = localStorage.getItem(COLLAPSED_KEY) === 'true';
  }

  private refreshSecondaryCounts(): void {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.noteCount = 0;
      this.goalCount = 0;
      return;
    }
    const isAdmin = this.authService.isAdmin();
    const notes = this.storage.getNotes().filter((n) => !n.isDeleted);
    const goals = this.storage.getGoals().filter((g) => !g.isDeleted);
    this.noteCount = (isAdmin
      ? notes
      : notes.filter((n) => n.ownerId === userId)
    ).length;
    this.goalCount = (isAdmin
      ? goals.filter((g) => g.status === 'active')
      : goals.filter(
          (g) => g.ownerId === userId && g.status === 'active'
        )
    ).length;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Always release scroll lock so we never leave it in a stuck state.
    document.body.style.overflow = '';
  }

  @HostListener('window:resize')
  onResize(): void {
    this.detectViewport();
  }

  private detectViewport(): void {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth <= 991.98;
    if (this.isMobile !== wasMobile && !this.isMobile) {
      this.mobileOpen = false;
      document.body.style.overflow = '';
    }
  }

  visibleMenu(): MenuItem[] {
    const isAdmin = this.authService.isAdmin();
    return this.primaryMenu.filter((m) => !m.adminOnly || isAdmin);
  }

  badgeFor(item: MenuItem): number | null {
    if (item.badge === 'tasks') return this.taskCount;
    if (item.badge === 'investments') return this.investmentCount;
    if (item.badge === 'notes') return this.noteCount;
    if (item.badge === 'goals') return this.goalCount;
    return null;
  }

  initials(): string {
    if (!this.userName) return '?';
    return this.userName.substring(0, 2).toUpperCase();
  }

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    localStorage.setItem(COLLAPSED_KEY, String(this.collapsed));
  }

  toggleMobile(): void {
    this.mobileOpen = !this.mobileOpen;
    this.applyBodyScrollLock();
  }

  closeMobile(): void {
    if (this.isMobile) {
      this.mobileOpen = false;
      this.applyBodyScrollLock();
    }
  }

  private applyBodyScrollLock(): void {
    document.body.style.overflow =
      this.isMobile && this.mobileOpen ? 'hidden' : '';
  }

  setTheme(t: Theme): void {
    this.themeService.set(t);
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  triggerAction(item: MenuItem, ev: Event): void {
    ev.stopPropagation();
    ev.preventDefault();
    if (item.action === 'add-task') {
      this.router.navigate(['/add-task']);
      this.closeMobile();
    }
  }

  logout(): void {
    this.authService.removeJwtToken();
    this.dataService.showSuccessToasterMsg('Logged out successfully');
  }
}
