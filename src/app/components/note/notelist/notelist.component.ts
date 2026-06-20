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

import { NoteService } from '../../../services/note/note.service';
import { DataService } from '../../../services/data/data.service';
import { AuthService } from '../../../services/auth/auth.service';
import { Note, NoteColor } from '../../../models/models';
import { ConfirmDialogService } from '../../confirm-dialog/confirm-dialog.service';
import { AppSelectComponent, SelectOption } from '../../app-select/app-select.component';

const COLOR_OPTIONS: { value: NoteColor; label: string }[] = [
  { value: 'yellow', label: 'Lemon' },
  { value: 'pink',   label: 'Blush' },
  { value: 'blue',   label: 'Ocean' },
  { value: 'green',  label: 'Mint' },
  { value: 'violet', label: 'Lilac' },
  { value: 'orange', label: 'Sunset' },
  { value: 'slate',  label: 'Slate' },
];

@Component({
  selector: 'app-notelist',
  standalone: true,
  imports: [CommonModule, FormsModule, AppSelectComponent],
  templateUrl: './notelist.component.html',
  styleUrl: './notelist.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotelistComponent implements OnInit, OnDestroy {
  notes: Note[] = [];
  searchText = '';
  selectedColor: NoteColor | 'all' = 'all';

  /** Editor state. */
  editorOpen = false;
  editing: Note | null = null;
  draft: {
    title: string;
    body: string;
    color: NoteColor;
    tagsRaw: string;
    pinned: boolean;
  } = this.blankDraft();

  readonly colorPalette = COLOR_OPTIONS;
  readonly colorFilterOptions: SelectOption[] = [
    { value: 'all', label: 'All colors', icon: 'fa-solid fa-palette' },
    ...COLOR_OPTIONS.map((c) => ({
      value: c.value,
      label: c.label,
      icon: 'fa-solid fa-circle',
    })),
  ];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private noteService: NoteService,
    private dataService: DataService,
    private authService: AuthService,
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
    this.authService.showSpinner();
    this.noteService
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.notes = res;
          this.cdr.markForCheck();
          this.authService.hideSpinner();
        },
        error: (err: Error) => {
          this.dataService.showerrorToaster(err.message);
          this.authService.hideSpinner();
        },
      });
  }

  // ---------- Filtering / derived ----------

  get filtered(): Note[] {
    const q = this.searchText.trim().toLowerCase();
    return this.notes.filter((n) => {
      const matchesText =
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q));
      const matchesColor =
        this.selectedColor === 'all' || n.color === this.selectedColor;
      return matchesText && matchesColor;
    });
  }

  get pinnedNotes(): Note[] {
    return this.filtered
      .filter((n) => n.pinned)
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }

  get otherNotes(): Note[] {
    return this.filtered
      .filter((n) => !n.pinned)
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }

  get totalCount(): number {
    return this.notes.length;
  }
  get pinnedCount(): number {
    return this.notes.filter((n) => n.pinned).length;
  }
  get tagCount(): number {
    return new Set(this.notes.flatMap((n) => n.tags)).size;
  }

  // ---------- Editor ----------

  openCreate(): void {
    this.editing = null;
    this.draft = this.blankDraft();
    this.editorOpen = true;
    document.body.style.overflow = 'hidden';
  }

  openEdit(note: Note): void {
    this.editing = note;
    this.draft = {
      title: note.title,
      body: note.body,
      color: note.color,
      tagsRaw: note.tags.join(', '),
      pinned: note.pinned,
    };
    this.editorOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeEditor(): void {
    this.editorOpen = false;
    document.body.style.overflow = '';
  }

  save(): void {
    const tags = this.draft.tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (!this.draft.title && !this.draft.body) {
      this.dataService.showerrorToaster('Add a title or body before saving.');
      return;
    }

    const payload = {
      title: this.draft.title,
      body: this.draft.body,
      color: this.draft.color,
      tags,
      pinned: this.draft.pinned,
    };

    if (this.editing) {
      this.noteService
        .edit(this.editing._id, payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.dataService.showSuccessToasterMsg(res.message);
            this.closeEditor();
            this.load();
          },
          error: (err: Error) =>
            this.dataService.showerrorToaster(err.message),
        });
    } else {
      this.noteService
        .add(payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.dataService.showSuccessToasterMsg(res.message);
            this.closeEditor();
            this.load();
          },
          error: (err: Error) =>
            this.dataService.showerrorToaster(err.message),
        });
    }
  }

  // ---------- Card actions ----------

  togglePin(note: Note, ev: Event): void {
    ev.stopPropagation();
    this.noteService
      .togglePin(note._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: (err: Error) => this.dataService.showerrorToaster(err.message),
      });
  }

  async remove(note: Note, ev: Event): Promise<void> {
    ev.stopPropagation();
    const ok = await this.confirmDialog.ask({
      eyebrow: 'Delete note',
      title: note.title ? `Delete "${note.title}"?` : 'Delete this note?',
      message: 'Notes are removed permanently and cannot be restored.',
      tone: 'danger',
      confirmLabel: 'Delete note',
      icon: 'fa-solid fa-trash',
    });
    if (!ok) return;
    this.noteService
      .delete(note._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.dataService.showSuccessToasterMsg(res.message);
          this.load();
        },
        error: (err: Error) => this.dataService.showerrorToaster(err.message),
      });
  }

  pickColor(c: NoteColor): void {
    this.draft.color = c;
  }

  togglePinDraft(): void {
    this.draft.pinned = !this.draft.pinned;
  }

  preview(body: string, max = 240): string {
    if (!body) return '';
    return body.length > max ? body.slice(0, max).trimEnd() + '…' : body;
  }

  trackById(_i: number, n: Note): string {
    return n._id;
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.editorOpen) this.closeEditor();
  }

  private blankDraft() {
    return {
      title: '',
      body: '',
      color: 'yellow' as NoteColor,
      tagsRaw: '',
      pinned: false,
    };
  }
}
