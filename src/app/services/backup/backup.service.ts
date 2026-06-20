import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import {
  Goal,
  Investment,
  Note,
  Task,
  User,
} from '../../models/models';
import { StorageService } from '../storage/storage.service';
import { AuthService } from '../auth/auth.service';

/**
 * Backup payload shape — what gets written to and read from the backup file.
 *
 * The schemaVersion lets us evolve the format later without breaking older
 * backups. Bump it when we change the shape; add migrations in `importJson`.
 */
export interface BackupPayload {
  schemaVersion: 1;
  generatedAt: string;
  appVersion: string;
  /** Only present when the *current* user is admin — non-admin exports skip users. */
  users?: User[];
  tasks: Task[];
  investments: Investment[];
  notes: Note[];
  goals: Goal[];
}

/** Result returned by `importJson` so the UI can show a real summary. */
export interface ImportSummary {
  added: { users: number; tasks: number; investments: number; notes: number; goals: number };
  updated: { users: number; tasks: number; investments: number; notes: number; goals: number };
  skipped: { users: number; tasks: number; investments: number; notes: number; goals: number };
  conflicts: number;
  startedAt: number;
  finishedAt: number;
}

export type ImportStrategy = 'merge' | 'overwrite';

/**
 * Frontend-only backup / restore.
 *
 * Strategies:
 *   - `merge` (default): existing rows are kept; rows with the same id are
 *     replaced when the imported one has a newer `updatedAt`. New rows are
 *     appended.
 *   - `overwrite`: all collections in the backup wholesale replace the
 *     current store. Use with care.
 *
 * Atomicity note: every write in this service is "all-or-nothing within
 * a single import call" — we build the new collections fully in memory,
 * then commit them with one `saveTasks/Goals/...` call each. If a write
 * fails partway the user still has the original data intact (we keep a
 * snapshot first and roll back on error).
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  constructor(
    private storage: StorageService,
    private auth: AuthService
  ) {}

  // ---------- EXPORT ----------

  /**
   * Build the in-memory payload. Admin gets the full store; standard users
   * only get their own scoped data.
   */
  buildPayload(): BackupPayload {
    const isAdmin = this.auth.isAdmin();
    const userId = this.auth.getUserId();
    const now = new Date().toISOString();

    const allTasks = this.storage.getTasks();
    const allInvestments = this.storage.getInvestments();
    const allNotes = this.storage.getNotes();
    const allGoals = this.storage.getGoals();

    const tasks = isAdmin ? allTasks : allTasks.filter((t) => t.ownerId === userId);
    const investments = isAdmin
      ? allInvestments
      : allInvestments.filter((i) => i.ownerId === userId);
    const notes = isAdmin
      ? allNotes
      : allNotes.filter((n) => n.ownerId === userId);
    const goals = isAdmin
      ? allGoals
      : allGoals.filter((g) => g.ownerId === userId);

    const payload: BackupPayload = {
      schemaVersion: 1,
      generatedAt: now,
      appVersion: '2.0.0',
      tasks,
      investments,
      notes,
      goals,
    };

    if (isAdmin) {
      // Include users (with hashed passwords intact) so admin backups round-trip.
      payload.users = this.storage.getUsers();
    }
    return payload;
  }

  /** Trigger a JSON download. Returns the suggested filename. */
  exportJson(): string {
    const payload = this.buildPayload();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const filename = this.fileNameFor('json');
    this.triggerDownload(blob, filename);
    return filename;
  }

  /**
   * Trigger an Excel download — one sheet per collection. Read-only;
   * we don't import from xlsx because nested arrays (milestones, tags,
   * subtasks) flatten poorly across cell walls.
   */
  exportExcel(): string {
    const payload = this.buildPayload();
    const wb = XLSX.utils.book_new();

    if (payload.users && payload.users.length) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          payload.users.map((u) => ({
            id: u.id,
            userName: u.userName,
            userEmail: u.userEmail,
            phone: u.phone,
            role: u.role,
            createdAt: u.createdAt,
          }))
        ),
        'Users'
      );
    }

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        payload.tasks.map((t) => ({
          id: t._id,
          ownerId: t.ownerId,
          subject: t.subject,
          description: t.description,
          priority: t.priority,
          status: t.taskStatus,
          startDate: t.startDate,
          endDate: t.endDate,
          subtasks: (t.subtasks ?? []).join(' | '),
          isReminder: t.isRemainder,
          isDeleted: t.isDeleted,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        }))
      ),
      'Tasks'
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        payload.investments.map((i) => ({
          id: i._id,
          ownerId: i.ownerId,
          name: i.name,
          type: i.type,
          amount: i.amount,
          currentValue: i.currentValue,
          gain: i.currentValue - i.amount,
          gainPct: i.amount ? +(((i.currentValue - i.amount) / i.amount) * 100).toFixed(2) : 0,
          risk: i.risk,
          status: i.status,
          startDate: i.startDate,
          maturityDate: i.maturityDate,
          notes: i.notes ?? '',
          isDeleted: i.isDeleted,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
        }))
      ),
      'Investments'
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        payload.notes.map((n) => ({
          id: n._id,
          ownerId: n.ownerId,
          title: n.title,
          body: n.body,
          color: n.color,
          tags: (n.tags ?? []).join(', '),
          pinned: n.pinned,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        }))
      ),
      'Notes'
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        payload.goals.map((g) => ({
          id: g._id,
          ownerId: g.ownerId,
          title: g.title,
          description: g.description,
          category: g.category,
          target: g.targetValue,
          current: g.currentValue,
          unit: g.unit,
          progressPct: g.targetValue
            ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100))
            : 0,
          status: g.status,
          startDate: g.startDate,
          dueDate: g.dueDate,
          milestones: (g.milestones ?? [])
            .map((m) => `${m.done ? '[x]' : '[ ]'} ${m.label}`)
            .join(' | '),
          createdAt: g.createdAt,
          updatedAt: g.updatedAt,
        }))
      ),
      'Goals'
    );

    const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const filename = this.fileNameFor('xlsx');
    this.triggerDownload(blob, filename);
    return filename;
  }

  // ---------- IMPORT ----------

  /**
   * Read a File and validate the JSON shape. Throws on invalid input.
   */
  async readFile(file: File): Promise<BackupPayload> {
    if (file.size > 100 * 1024 * 1024) {
      // Browser localStorage caps around 5-10MB — anything bigger is suspicious
      // even though we can technically parse it.
      throw new Error('Backup file is unusually large (>100MB). Aborting.');
    }
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('File is not valid JSON.');
    }
    return this.validatePayload(parsed);
  }

  /**
   * Apply a parsed backup payload using the chosen strategy. Atomic per
   * collection: a snapshot of the current state is captured first; on any
   * error during commit we roll the in-memory state back so you don't end
   * up with half-applied data.
   */
  importJson(payload: BackupPayload, strategy: ImportStrategy = 'merge'): ImportSummary {
    const startedAt = Date.now();
    const isAdmin = this.auth.isAdmin();
    const meId = this.auth.getUserId();

    // Capture rollback snapshot before touching anything.
    const snap = {
      users: [...this.storage.getUsers()],
      tasks: [...this.storage.getTasks()],
      investments: [...this.storage.getInvestments()],
      notes: [...this.storage.getNotes()],
      goals: [...this.storage.getGoals()],
    };

    const summary: ImportSummary = {
      added:    { users: 0, tasks: 0, investments: 0, notes: 0, goals: 0 },
      updated:  { users: 0, tasks: 0, investments: 0, notes: 0, goals: 0 },
      skipped:  { users: 0, tasks: 0, investments: 0, notes: 0, goals: 0 },
      conflicts: 0,
      startedAt,
      finishedAt: 0,
    };

    try {
      // Standard users can only import their own data — drop ownerId mismatches
      // before any merge so they can't impersonate someone else.
      const inboundTasks = isAdmin
        ? payload.tasks
        : payload.tasks
            .filter((t) => !t.ownerId || t.ownerId === meId)
            .map((t) => ({ ...t, ownerId: meId ?? t.ownerId }));
      const inboundInvestments = isAdmin
        ? payload.investments
        : payload.investments
            .filter((i) => !i.ownerId || i.ownerId === meId)
            .map((i) => ({ ...i, ownerId: meId ?? i.ownerId }));
      const inboundNotes = isAdmin
        ? payload.notes
        : payload.notes
            .filter((n) => !n.ownerId || n.ownerId === meId)
            .map((n) => ({ ...n, ownerId: meId ?? n.ownerId }));
      const inboundGoals = isAdmin
        ? payload.goals
        : payload.goals
            .filter((g) => !g.ownerId || g.ownerId === meId)
            .map((g) => ({ ...g, ownerId: meId ?? g.ownerId }));

      // Track skipped counts (non-admin importing other users' data).
      summary.skipped.tasks += payload.tasks.length - inboundTasks.length;
      summary.skipped.investments += payload.investments.length - inboundInvestments.length;
      summary.skipped.notes += payload.notes.length - inboundNotes.length;
      summary.skipped.goals += payload.goals.length - inboundGoals.length;

      if (strategy === 'overwrite') {
        // Wholesale replace. Admin only — too dangerous for non-admins.
        if (!isAdmin) throw new Error('Overwrite imports require admin privileges.');

        if (payload.users && payload.users.length) {
          this.storage.saveUsers(payload.users);
          summary.added.users = payload.users.length;
        }
        this.storage.saveTasks(inboundTasks);
        summary.added.tasks = inboundTasks.length;
        this.storage.saveInvestments(inboundInvestments);
        summary.added.investments = inboundInvestments.length;
        this.storage.saveNotes(inboundNotes);
        summary.added.notes = inboundNotes.length;
        this.storage.saveGoals(inboundGoals);
        summary.added.goals = inboundGoals.length;

        summary.finishedAt = Date.now();
        return summary;
      }

      // Merge strategy — newer-wins on `updatedAt`, otherwise add.
      if (isAdmin && payload.users?.length) {
        const merged = this.mergeById(snap.users, payload.users, 'id', summary, 'users');
        this.storage.saveUsers(merged);
      }

      this.storage.saveTasks(this.mergeById(snap.tasks, inboundTasks, '_id', summary, 'tasks'));
      this.storage.saveInvestments(
        this.mergeById(snap.investments, inboundInvestments, '_id', summary, 'investments')
      );
      this.storage.saveNotes(
        this.mergeById(snap.notes, inboundNotes, '_id', summary, 'notes')
      );
      this.storage.saveGoals(
        this.mergeById(snap.goals, inboundGoals, '_id', summary, 'goals')
      );

      summary.finishedAt = Date.now();
      return summary;
    } catch (err) {
      // Roll back on any failure so we don't leave partial state behind.
      this.storage.saveUsers(snap.users);
      this.storage.saveTasks(snap.tasks);
      this.storage.saveInvestments(snap.investments);
      this.storage.saveNotes(snap.notes);
      this.storage.saveGoals(snap.goals);
      throw err;
    }
  }

  // ---------- internals ----------

  private mergeById<
    T extends { [k: string]: any; updatedAt?: string; createdAt?: string }
  >(
    current: T[],
    incoming: T[],
    idField: keyof T,
    summary: ImportSummary,
    bucket: keyof ImportSummary['added']
  ): T[] {
    const map = new Map<string, T>();
    for (const item of current) map.set(String(item[idField]), item);

    for (const item of incoming) {
      const id = String(item[idField]);
      if (!id) {
        summary.skipped[bucket]++;
        continue;
      }
      const existing = map.get(id);
      if (!existing) {
        map.set(id, item);
        summary.added[bucket]++;
        continue;
      }
      // Pick the newer one based on updatedAt; if missing, prefer existing.
      const existingTime = +new Date(existing.updatedAt ?? existing.createdAt ?? 0);
      const incomingTime = +new Date(item.updatedAt ?? item.createdAt ?? 0);
      if (incomingTime > existingTime) {
        map.set(id, item);
        summary.updated[bucket]++;
      } else if (incomingTime === existingTime) {
        summary.skipped[bucket]++;
      } else {
        summary.skipped[bucket]++;
        summary.conflicts++;
      }
    }
    return Array.from(map.values());
  }

  private validatePayload(raw: unknown): BackupPayload {
    if (!raw || typeof raw !== 'object') throw new Error('Backup is not an object.');
    const obj = raw as Partial<BackupPayload>;
    if (obj.schemaVersion !== 1) {
      throw new Error(
        `Unsupported backup schema version: ${obj.schemaVersion}. Expected 1.`
      );
    }
    const arrayOrFail = <T>(val: unknown, name: string): T[] => {
      if (!Array.isArray(val)) {
        throw new Error(`Backup is missing the "${name}" array.`);
      }
      return val as T[];
    };
    return {
      schemaVersion: 1,
      generatedAt: typeof obj.generatedAt === 'string' ? obj.generatedAt : '',
      appVersion: typeof obj.appVersion === 'string' ? obj.appVersion : '',
      users: Array.isArray(obj.users) ? (obj.users as User[]) : undefined,
      tasks: arrayOrFail<Task>(obj.tasks, 'tasks'),
      investments: arrayOrFail<Investment>(obj.investments, 'investments'),
      notes: arrayOrFail<Note>(obj.notes, 'notes'),
      goals: arrayOrFail<Goal>(obj.goals, 'goals'),
    };
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Free the object URL after a tick — Safari needs the click to dispatch first.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  private fileNameFor(ext: 'json' | 'xlsx'): string {
    const stamp = new Date()
      .toISOString()
      .replace(/[:T]/g, '-')
      .replace(/\..+$/, '');
    const who = this.auth.getUserName() || 'user';
    return `tid-backup_${who}_${stamp}.${ext}`;
  }
}
