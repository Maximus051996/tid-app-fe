import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TaskService } from '../../../services/task/task.service';
import { AuthService } from '../../../services/auth/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DataService } from '../../../services/data/data.service';
import { DateTimePickerComponent } from '../../datetime-picker/datetime-picker.component';
import { AppSelectComponent, SelectOption } from '../../app-select/app-select.component';

@Component({
  selector: 'app-addeditviewtask',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    DateTimePickerComponent,
    AppSelectComponent,
  ],
  templateUrl: './addeditviewtask.component.html',
  styleUrl: './addeditviewtask.component.scss',
})
export class AddeditviewtaskComponent implements OnInit, OnDestroy {
  taskForm!: FormGroup;
  operationHeader: string = '';
  priorities: string[] = ['Low', 'Medium', 'High'];
  taskId: string | null = null;
  isStartDatePickerMode: boolean = false;
  isViewMode: boolean = false;

  readonly priorityOptions: SelectOption[] = [
    { value: 'Low', label: 'Low', icon: 'fa-regular fa-circle', tone: 'info', description: 'Backlog' },
    { value: 'Medium', label: 'Medium', icon: 'fa-solid fa-bolt', tone: 'warning', description: 'In flight' },
    { value: 'High', label: 'High', icon: 'fa-solid fa-fire', tone: 'danger', description: 'Open & urgent' },
  ];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private taskService: TaskService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private dataService: DataService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.route.url
      .pipe(takeUntil(this.destroy$))
      .subscribe((urlSegments) => {
        this.operationHeader = this.formatString(urlSegments[0].path);
        this.checkOpearationMode(this.operationHeader);
      });
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.taskId = params.get('id');
        if (this.taskId) {
          this.getTaskDetails(this.taskId);
        }
      });
    // Pre-fill due date when navigating from calendar via ?due=YYYY-MM-DD
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((q) => {
        const due = q.get('due');
        if (due && !this.taskId) {
          const [y, m, d] = due.split('-').map(Number);
          // Build the prefill in the user's local timezone (9:00 → 17:00),
          // then emit the picker's ISO format so timezone never gets lost.
          const start = new Date(y, (m ?? 1) - 1, d ?? 1, 9, 0, 0, 0);
          const end = new Date(y, (m ?? 1) - 1, d ?? 1, 17, 0, 0, 0);
          this.taskForm.patchValue({
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  checkOpearationMode(operationHeader: string) {
    switch (operationHeader) {
      case 'Add Task':
        this.isViewMode = false;
        break;
      case 'Edit Task':
        this.isViewMode = false;
        break;
      case 'View Task':
        this.isViewMode = true;
        break;
    }
  }

  initializeForm(): void {
    this.taskForm = this.fb.group({
      subject: ['', Validators.required],
      description: ['', Validators.required],
      priority: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      isRemainder: [false],
      isDeleted: [false],
      taskStatus: ['notStarted', Validators.required],
      subtasks: this.fb.array([]),
    });
  }

  onSubmit(): void {
    if (this.taskForm.invalid) {
      return;
    } else if (this.taskForm.value.startDate > this.taskForm.value.endDate) {
      this.dataService.showerrorToaster(
        'End Date should be greater than Start Date'
      );
      return;
    }
    const {
      subject,
      description,
      priority,
      startDate,
      endDate,
      isRemainder,
      taskStatus,
      subtasks,
    } = this.taskForm.value;

    // Transform subtasks to an array of strings
    const formattedSubtasks = subtasks.map((subtask: any) => subtask.subtask);

    let jsonData: any = {
      subject,
      description,
      priority,
      startDate,
      endDate,
      subtasks: formattedSubtasks,
    };

    if (!this.taskId) {
      jsonData = {
        subject,
        description,
        priority,
        startDate,
        endDate,
        isRemainder,
        subtasks: formattedSubtasks,
        taskStatus,
      };
    } else {
      jsonData = { ...jsonData, isRemainder, taskStatus };
    }

    this.authService.showSpinner();

    const taskObservable = this.taskId
      ? this.taskService.editTask(this.taskId, jsonData)
      : this.taskService.addtask(jsonData);

    taskObservable.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.dataService.showSuccessToasterMsg(res.message);
        this.router.navigate(['/taskinfo']);
      },
      error: (err) => {
        console.error('Error: ', err);
        this.dataService.showerrorToaster('Failed to process task');
        this.authService.hideSpinner();
      },
      complete: () => {
        this.authService.hideSpinner();
      },
    });
  }

  getTaskDetails(id: string) {
    this.authService.showSpinner();
    this.taskService
      .gettaskbyId(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (task) => {
          if (task) {
            const formattedSubtasks = task.subtasks
              ? task.subtasks.map((subtask: string) => ({ subtask }))
              : [];

            this.isVisiblesub_taskflag = formattedSubtasks.length > 0;

            this.taskForm.patchValue({
              subject: task.subject,
              description: task.description,
              priority: task.priority,
              // Pass the ISO string straight through — the picker parses it
              // with `new Date(...)` and renders the user's local wall-clock
              // time. Round-trips cleanly across timezones.
              startDate: task.startDate,
              endDate: task.endDate,
              isRemainder: task.isRemainder,
              isDeleted: task.isDeleted,
              taskStatus: task.taskStatus,
            });
            const subtasksArray = this.taskForm.get('subtasks') as FormArray;
            subtasksArray.clear();
            formattedSubtasks.forEach((subtask: any) => {
              subtasksArray.push(this.fb.group({ subtask: [subtask.subtask] }));
            });

            this.authService.hideSpinner();
          }
        },
        error: (error) => {
          this.authService.hideSpinner();
          this.dataService.showerrorToaster(error?.message ?? String(error));
        },
      });
  }

  formatString(input: string): string {
    return input
      .split('-') // Split the string by hyphen
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize the first letter of each word
      .join(' '); // Join the words with a space
  }

  onReset(): void {
    this.taskForm.reset();
  }

  onCancel() {
    this.router.navigate(['/taskinfo']);
  }

  get subtasks(): FormArray {
    return this.taskForm.get('subtasks') as FormArray;
  }

  addRow() {
    this.subtasks.push(
      this.fb.group({
        subtask: [''],
      })
    );
  }
  isVisiblesub_taskflag: boolean = false;
  isVisbleSubtask($event: any) {
    this.isVisiblesub_taskflag = $event.target.checked;
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === 'Tab') {
      this.dataService.showerrorToaster('Enter or tab key is not allowed');
      event.preventDefault();
    }
  }

  removeSubtask(index: number): void {
    this.subtasks.removeAt(index);
  }
}
