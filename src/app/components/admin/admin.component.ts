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
import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../services/auth/auth.service';
import { DataService } from '../../services/data/data.service';
import { UserService } from '../../services/user/user.service';
import { TaskService } from '../../services/task/task.service';
import { InvestmentService } from '../../services/investment/investment.service';
import { NoteService } from '../../services/note/note.service';
import { GoalService } from '../../services/goal/goal.service';
import { Goal, Investment, Note, Task, User } from '../../models/models';
import { ConfirmDialogService } from '../confirm-dialog/confirm-dialog.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent implements OnInit, OnDestroy {
  users: Omit<User, 'userPassword'>[] = [];
  tasks: Task[] = [];
  investments: Investment[] = [];
  notes: Note[] = [];
  goals: Goal[] = [];

  totalInvested = 0;
  totalCurrent = 0;
  activeUsers = 0;

  searchUser = '';

  /** Reset-scope picker state. */
  resetPickerOpen = false;
  resetPickerView: 'choice' | 'pick-user' = 'choice';
  resetPickerSearch = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private auth: AuthService,
    private data: DataService,
    private userService: UserService,
    private taskService: TaskService,
    private investmentService: InvestmentService,
    private noteService: NoteService,
    private goalService: GoalService,
    private router: Router,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.destroy$.next();
    this.destroy$.complete();
  }

  refresh(): void {
    forkJoin({
      users: this.userService.getAllUsers(),
      tasks: this.taskService.getallTasks(),
      investments: this.investmentService.getAll(),
      notes: this.noteService.getAll(),
      goals: this.goalService.getAll(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.users = res.users;
          this.tasks = res.tasks;
          this.investments = res.investments;
          this.notes = res.notes;
          this.goals = res.goals;
          this.recomputeStats();
          this.cdr.markForCheck();
        },
        error: (err: Error) => this.data.showerrorToaster(err.message),
      });
  }

  private recomputeStats(): void {
    const live = this.investments.filter((i) => !i.isDeleted);
    this.totalInvested = live.reduce((s, i) => s + i.amount, 0);
    this.totalCurrent = live.reduce((s, i) => s + i.currentValue, 0);
    this.activeUsers = this.users.length;
  }

  get filteredUsers() {
    const q = this.searchUser.trim().toLowerCase();
    if (!q) return this.users;
    return this.users.filter(
      (u) =>
        u.userName.toLowerCase().includes(q) ||
        u.userEmail.toLowerCase().includes(q)
    );
  }

  taskCountFor(userId: string): number {
    return this.tasks.filter((t) => t.ownerId === userId && !t.isDeleted).length;
  }

  investmentCountFor(userId: string): number {
    return this.investments.filter((i) => i.ownerId === userId && !i.isDeleted).length;
  }

  invSumFor(userId: string): number {
    return this.investments
      .filter((i) => i.ownerId === userId && !i.isDeleted)
      .reduce((s, i) => s + i.currentValue, 0);
  }

  noteCountFor(userId: string): number {
    return this.notes.filter((n) => n.ownerId === userId).length;
  }

  goalCountFor(userId: string): number {
    return this.goals.filter((g) => g.ownerId === userId).length;
  }

  async removeUser(user: Omit<User, 'userPassword'>): Promise<void> {
    if (user.role === 'admin') {
      this.data.showerrorToaster('Admin accounts cannot be removed.');
      return;
    }
    const ok = await this.confirmDialog.ask({
      eyebrow: 'Remove user',
      title: `Remove "${user.userName}"?`,
      message: `This permanently removes the user account along with every task, investment, note, and goal they own. This cannot be undone.`,
      details: [
        `${this.taskCountFor(user.id)} task(s) will be deleted`,
        `${this.investmentCountFor(user.id)} investment(s) will be deleted`,
        `${this.noteCountFor(user.id)} note(s) will be deleted`,
        `${this.goalCountFor(user.id)} goal(s) will be deleted`,
        `Login credentials for ${user.userEmail} will be revoked`,
      ],
      tone: 'danger',
      confirmLabel: 'Remove user',
      icon: 'fa-solid fa-user-slash',
    });
    if (!ok) return;

    this.userService
      .removeUser(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.data.showSuccessToasterMsg(`User "${user.userName}" removed.`);
          this.refresh();
        },
        error: (err: Error) => this.data.showerrorToaster(err.message),
      });
  }

  promote(user: Omit<User, 'userPassword'>): void {
    const nextRole: 'admin' | 'user' = user.role === 'admin' ? 'user' : 'admin';
    this.userService
      .setRole(user.id, nextRole)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.data.showSuccessToasterMsg(`${user.userName} is now ${nextRole}`);
          this.refresh();
        },
        error: (err: Error) => this.data.showerrorToaster(err.message),
      });
  }

  // ---------- Reset-scope picker ----------

  async resetData(): Promise<void> {
    this.openResetPicker();
  }

  openResetPicker(): void {
    this.resetPickerOpen = true;
    this.resetPickerView = 'choice';
    this.resetPickerSearch = '';
    document.body.style.overflow = 'hidden';
  }

  closeResetPicker(): void {
    this.resetPickerOpen = false;
    this.resetPickerView = 'choice';
    this.resetPickerSearch = '';
    document.body.style.overflow = '';
  }

  get myStats() {
    const me = this.auth.getUserId();
    return me ? this.statsFor(me) : { tasks: 0, investments: 0, notes: 0, goals: 0 };
  }

  statsFor(userId: string) {
    return {
      tasks: this.tasks.filter((t) => t.ownerId === userId && !t.isDeleted).length,
      investments: this.investments.filter((i) => i.ownerId === userId && !i.isDeleted).length,
      notes: this.notes.filter((n) => n.ownerId === userId).length,
      goals: this.goals.filter((g) => g.ownerId === userId).length,
    };
  }

  totalDataFor(userId: string): number {
    const s = this.statsFor(userId);
    return s.tasks + s.investments + s.notes + s.goals;
  }

  get pickerUsers(): Omit<User, 'userPassword'>[] {
    const q = this.resetPickerSearch.trim().toLowerCase();
    if (!q) return this.users;
    return this.users.filter(
      (u) =>
        u.userName.toLowerCase().includes(q) ||
        u.userEmail.toLowerCase().includes(q)
    );
  }

  showUserPicker(): void {
    this.resetPickerView = 'pick-user';
    this.resetPickerSearch = '';
  }

  backToChoice(): void {
    this.resetPickerView = 'choice';
  }

  async resetEverything(): Promise<void> {
    this.closeResetPicker();
    this.data.showerrorToaster(
      'Server-side full reset requires direct DB access for safety. Use the per-user wipe instead.'
    );
  }

  async wipeDataFor(user: Omit<User, 'userPassword'>): Promise<void> {
    this.closeResetPicker();
    const stats = this.statsFor(user.id);
    const total = stats.tasks + stats.investments + stats.notes + stats.goals;
    if (total === 0) {
      this.data.showerrorToaster(
        `${user.userName} has no data to wipe — nothing to do.`
      );
      return;
    }
    const ok = await this.confirmDialog.ask({
      eyebrow: 'Wipe user data',
      title: `Wipe data for "${user.userName}"?`,
      message: `Removes everything ${user.userName} has created. The account stays so they can log back in and start fresh.`,
      details: [
        `${stats.tasks} task(s) will be deleted`,
        `${stats.investments} investment(s) will be deleted`,
        `${stats.notes} note(s) will be deleted`,
        `${stats.goals} goal(s) will be deleted`,
        `Login credentials for ${user.userEmail} will NOT be touched`,
      ],
      tone: 'danger',
      confirmLabel: 'Wipe user data',
      icon: 'fa-solid fa-broom',
    });
    if (!ok) return;

    this.userService
      .wipeUserData(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.data.showSuccessToasterMsg(
            `Cleared ${total} item(s) for "${user.userName}".`
          );
          this.refresh();
        },
        error: (err: Error) => this.data.showerrorToaster(err.message),
      });
  }

  async wipeMyData(): Promise<void> {
    const me = this.auth.getUserId();
    if (!me) {
      this.data.showerrorToaster('Not signed in.');
      return;
    }
    const meUser = this.users.find((u) => u.id === me);
    if (!meUser) {
      this.data.showerrorToaster('User not found.');
      return;
    }
    await this.wipeDataFor(meUser);
  }
}
