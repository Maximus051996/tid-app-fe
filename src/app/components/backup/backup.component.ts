import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewChild,
} from '@angular/core';
import {
  BackupPayload,
  BackupService,
  ImportStrategy,
  ImportSummary,
} from '../../services/backup/backup.service';
import { AuthService } from '../../services/auth/auth.service';
import { DataService } from '../../services/data/data.service';
import { ConfirmDialogService } from '../confirm-dialog/confirm-dialog.service';

interface ImportPreview {
  payload: BackupPayload;
  fileName: string;
  fileSize: number;
}

@Component({
  selector: 'app-backup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './backup.component.html',
  styleUrl: './backup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackupComponent {
  readonly isAdmin: boolean;
  preview: ImportPreview | null = null;
  lastSummary: ImportSummary | null = null;
  busy = false;

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  constructor(
    private backup: BackupService,
    private auth: AuthService,
    private data: DataService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {
    this.isAdmin = this.auth.isAdmin();
  }

  // ---------- Export ----------

  exportJson(): void {
    if (this.busy) return;
    try {
      const filename = this.backup.exportJson();
      this.data.showSuccessToasterMsg(`Saved ${filename}`);
    } catch (err) {
      this.data.showerrorToaster((err as Error).message);
    }
  }

  exportExcel(): void {
    if (this.busy) return;
    try {
      const filename = this.backup.exportExcel();
      this.data.showSuccessToasterMsg(`Saved ${filename}`);
    } catch (err) {
      this.data.showerrorToaster((err as Error).message);
    }
  }

  // ---------- Import ----------

  pickFile(): void {
    this.fileInput?.nativeElement.click();
  }

  async onFileChosen(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.busy = true;
    this.cdr.markForCheck();
    try {
      const payload = await this.backup.readFile(file);
      this.preview = { payload, fileName: file.name, fileSize: file.size };
      this.lastSummary = null;
    } catch (err) {
      this.preview = null;
      this.data.showerrorToaster((err as Error).message);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  cancelImport(): void {
    this.preview = null;
    this.cdr.markForCheck();
  }

  async applyMerge(): Promise<void> {
    if (!this.preview) return;
    const ok = await this.confirmDialog.ask({
      eyebrow: 'Merge backup',
      title: 'Merge data into this device?',
      message:
        'Newer rows from the backup will replace older rows with the same id. Existing rows that aren\'t in the backup are preserved. This is the safe option.',
      details: this.previewDetails(),
      tone: 'info',
      confirmLabel: 'Merge',
      icon: 'fa-solid fa-code-merge',
    });
    if (!ok) return;
    this.runImport('merge');
  }

  async applyOverwrite(): Promise<void> {
    if (!this.preview) return;
    if (!this.isAdmin) {
      this.data.showerrorToaster('Overwrite requires admin privileges.');
      return;
    }
    const ok = await this.confirmDialog.ask({
      eyebrow: 'Danger zone',
      title: 'Overwrite all data on this device?',
      message:
        'This wipes the current store and replaces it wholesale with the backup. Anything not in the backup is permanently lost.',
      details: this.previewDetails(),
      tone: 'danger',
      confirmInput: 'OVERWRITE',
      confirmLabel: 'Overwrite everything',
      icon: 'fa-solid fa-arrow-down-up-across-line',
    });
    if (!ok) return;
    this.runImport('overwrite');
  }

  private runImport(strategy: ImportStrategy): void {
    if (!this.preview) return;
    this.busy = true;
    try {
      const summary = this.backup.importJson(this.preview.payload, strategy);
      this.lastSummary = summary;
      this.preview = null;
      const tally =
        summary.added.tasks + summary.added.investments + summary.added.notes + summary.added.goals;
      const updated =
        summary.updated.tasks + summary.updated.investments + summary.updated.notes + summary.updated.goals;
      this.data.showSuccessToasterMsg(
        `Imported · ${tally} added, ${updated} updated`
      );
    } catch (err) {
      this.data.showerrorToaster((err as Error).message);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  // ---------- Display helpers ----------

  previewDetails(): string[] {
    if (!this.preview) return [];
    const p = this.preview.payload;
    const lines: string[] = [];
    if (p.users) lines.push(`${p.users.length} user(s)`);
    lines.push(`${p.tasks.length} task(s)`);
    lines.push(`${p.investments.length} investment(s)`);
    lines.push(`${p.notes.length} note(s)`);
    lines.push(`${p.goals.length} goal(s)`);
    return lines;
  }

  fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  fmtDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  }
}
