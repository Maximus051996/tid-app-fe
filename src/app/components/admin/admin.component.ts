import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgxSpinnerModule } from 'ngx-spinner';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../services/auth/auth.service';
import { DataService } from '../../services/data/data.service';
import { StorageService } from '../../services/storage/storage.service';
import { UserService } from '../../services/user/user.service';
import { Investment, Task, User } from '../../models/models';
import { ConfirmDialogService } from '../confirm-dialog/confirm-dialog.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxSpinnerModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit, OnDestroy {
  users: Omit<User, 'userPassword'>[] = [];
  tasks: Task[] = [];
  investments: Investment[] = [];

  totalInvested = 0;
  totalCurrent = 0;
  activeUsers = 0;

  searchUser = '';

  /** Reset-scope picker state. */
  resetPickerOpen = false;
  /** Two-step picker: 'choice' shows the two big cards, 'pick-user' shows the user list. */
  resetPickerView: 'choice' | 'pick-user' = 'choice';
  resetPickerSearch = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private auth: AuthService,
    private data: DataService,
    private storage: StorageService,
    private userService: UserService,
    private router: Router,
    private confirmDialog: ConfirmDialogService
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
    this.userService
      .getAllUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe((users) => (this.users = users));
    this.tasks = this.storage.getTasks();
    this.investments = this.storage.getInvestments();
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
    return this.investments.filter((i) => i.ownerId === userId && !i.isDeleted)
      .length;
  }

  invSumFor(userId: string): number {
    return this.investments
      .filter((i) => i.ownerId === userId && !i.isDeleted)
      .reduce((s, i) => s + i.currentValue, 0);
  }

  noteCountFor(userId: string): number {
    return this.storage
      .getNotes()
      .filter((n) => n.ownerId === userId && !n.isDeleted).length;
  }

  goalCountFor(userId: string): number {
    return this.storage
      .getGoals()
      .filter((g) => g.ownerId === userId && !g.isDeleted).length;
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

    const allUsers = this.storage.getUsers().filter((u) => u.id !== user.id);
    this.storage.saveUsers(allUsers);

    // Cascade: delete every record this user owned across all collections.
    this.storage.wipeUserData(user.id);

    this.data.showSuccessToasterMsg(`User "${user.userName}" removed.`);
    this.refresh();
  }

  promote(user: Omit<User, 'userPassword'>): void {
    const all = this.storage.getUsers();
    const idx = all.findIndex((u) => u.id === user.id);
    if (idx < 0) return;
    all[idx].role = all[idx].role === 'admin' ? 'user' : 'admin';
    this.storage.saveUsers(all);
    this.data.showSuccessToasterMsg(
      `${user.userName} is now ${all[idx].role}`
    );
    this.refresh();
  }

  async resetData(): Promise<void> {
    this.openResetPicker();
  }

  // ---------- Reset-scope picker ----------

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

  /** Stats for the *current* admin's own data — kept for templates that still
   *  reference `myStats`. Per-user stats use `statsFor(userId)` below. */
  get myStats(): { tasks: number; investments: number; notes: number; goals: number } {
    const me = this.auth.getUserId();
    return me
      ? this.statsFor(me)
      : { tasks: 0, investments: 0, notes: 0, goals: 0 };
  }

  /** Per-user content totals — drives the user-picker rows. */
  statsFor(userId: string): { tasks: number; investments: number; notes: number; goals: number } {
    return {
      tasks: this.storage
        .getTasks()
        .filter((t) => t.ownerId === userId && !t.isDeleted).length,
      investments: this.storage
        .getInvestments()
        .filter((i) => i.ownerId === userId && !i.isDeleted).length,
      notes: this.storage
        .getNotes()
        .filter((n) => n.ownerId === userId && !n.isDeleted).length,
      goals: this.storage
        .getGoals()
        .filter((g) => g.ownerId === userId && !g.isDeleted).length,
    };
  }

  totalDataFor(userId: string): number {
    const s = this.statsFor(userId);
    return s.tasks + s.investments + s.notes + s.goals;
  }

  /** Filtered list shown in the picker's user-pick view. */
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
    const ok = await this.confirmDialog.ask({
      eyebrow: 'Danger zone',
      title: 'Reset every user and dataset?',
      message:
        'This wipes every user, task, investment, note, and goal in this browser and restores the original seed state. There is no undo.',
      details: [
        'All users except the default admin and demo accounts will be removed',
        'Every task, investment, note, and goal will be deleted',
        'Your current session will be ended',
      ],
      tone: 'danger',
      confirmInput: 'RESET',
      confirmLabel: 'Reset everything',
      icon: 'fa-solid fa-arrows-rotate',
    });
    if (!ok) return;
    await this.storage.resetAll();
    this.data.showSuccessToasterMsg('All data reset to defaults. Please log in again.');
    this.auth.removeJwtToken();
  }

  /** Wipe data for the user the admin chose in the picker. Account stays intact. */
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
    this.storage.wipeUserData(user.id);
    this.data.showSuccessToasterMsg(
      `Cleared ${total} item(s) for "${user.userName}".`
    );
    this.refresh();
  }

  /** Legacy single-user wipe kept for back-compat with templates that may
   *  still call it. Wipes the currently signed-in admin's own data. */
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
