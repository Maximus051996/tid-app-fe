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
  private notes: Note[] = [];
  searchText = '';
  selectedColor: NoteColor | 'all' = 'all';

  /** Precomputed buckets — rebuilt only on data or filter changes. */
  pinnedNotes: Note[] = [];
  otherNotes: Note[] = [];
  filteredCount = 0;

  /** Cached aggregates. */
  totalCount = 0;
  pinnedCount = 0;
  tagCount = 0;

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
    // NoteService is in-memory: defer + Promise.resolve resolves synchronously.
    // No spinner flash needed — the route loader already covers navigation.
    this.noteService
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.notes = res;
          this.recomputeAll();
          this.dataService.changeNoteCount(
            this.notes.filter((n) => !n.isDeleted).length
          );
          this.cdr.markForCheck();
        },
        error: (err: Error) => this.dataService.showerrorToaster(err.message),
      });
  }

  // ---------- Filter input → recompute view ----------

  onSearchChange(): void {
    this.rebuildBuckets();
    this.cdr.markForCheck();
  }
  onColorFilter(): void {
    this.rebuildBuckets();
    this.cdr.markForCheck();
  }

  // ---------- Derived ----------

  private recomputeAll(): void {
    this.recomputeStats();
    this.rebuildBuckets();
  }

  private recomputeStats(): void {
    this.totalCount = this.notes.length;
    let pinned = 0;
    const tags = new Set<string>();
    for (const n of this.notes) {
      if (n.pinned) pinned++;
      for (const t of n.tags) tags.add(t);
    }
    this.pinnedCount = pinned;
    this.tagCount = tags.size;
  }

  private rebuildBuckets(): void {
    const q = this.searchText.trim().toLowerCase();
    const color = this.selectedColor;
    const pinned: Note[] = [];
    const other: Note[] = [];

    for (const n of this.notes) {
      if (color !== 'all' && n.color !== color) continue;
      if (q) {
        const inTitle = n.title.toLowerCase().includes(q);
        const inBody = n.body.toLowerCase().includes(q);
        let inTags = false;
        if (!inTitle && !inBody) {
          for (const t of n.tags) {
            if (t.toLowerCase().includes(q)) { inTags = true; break; }
          }
        }
        if (!inTitle && !inBody && !inTags) continue;
      }
      (n.pinned ? pinned : other).push(n);
    }

    const byUpdated = (a: Note, b: Note) =>
      +new Date(b.updatedAt) - +new Date(a.updatedAt);
    pinned.sort(byUpdated);
    other.sort(byUpdated);

    this.pinnedNotes = pinned;
    this.otherNotes = other;
    this.filteredCount = pinned.length + other.length;
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

    const op$ = this.editing
      ? this.noteService.edit(this.editing._id, payload)
      : this.noteService.add(payload);

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
