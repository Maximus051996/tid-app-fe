import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TaskService } from '../../../services/task/task.service';
import { NgxSpinnerModule } from 'ngx-spinner';
import { AuthService } from '../../../services/auth/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../../services/data/data.service';

@Component({
  selector: 'app-addeditviewtask',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, NgxSpinnerModule],
  templateUrl: './addeditviewtask.component.html',
  styleUrl: './addeditviewtask.component.scss',
})
export class AddeditviewtaskComponent implements OnInit {
  taskForm!: FormGroup;
  operationHeader: string = '';
  priorities: string[] = ['Low', 'Medium', 'High'];
  taskId: string | null = null;
  isStartDatePickerMode: boolean = false;
  isViewMode: boolean = false;
  constructor(
    private fb: FormBuilder,
    private taskService: TaskService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private dataService: DataService
  ) {}

  ngOnInit(): void {
    this.route.url.subscribe((urlSegments) => {
      this.operationHeader = this.formatString(urlSegments[0].path);
    });
    this.checkOpearationMode(this.operationHeader);
    this.initializeForm();
    this.route.paramMap.subscribe((params) => {
      this.taskId = params.get('id');
      if (this.taskId) {
        this.getTaskDetails(this.taskId);
      }
    });
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
      isCompleted: [false],
      subtasks: this.fb.array([]),
    });
  }

  onSubmit(): void {
    if (this.taskForm.invalid) {
      return;
    }

    const {
      subject,
      description,
      priority,
      startDate,
      endDate,
      isRemainder,
      isCompleted,
      subtasks,
    } = this.taskForm.value;

    // Transform subtasks to an array of strings
    const formattedSubtasks = subtasks.map((subtask: any) => subtask.subtask);

    let jsonData: any = {
      description,
      priority,
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
      };
    } else {
      jsonData = { ...jsonData, isRemainder, isCompleted };
    }

    this.authService.showSpinner();

    const taskObservable = this.taskId
      ? this.taskService.editTask(this.taskId, jsonData)
      : this.taskService.addtask(jsonData);

    taskObservable.subscribe({
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
    this.taskService.gettaskbyId(id).subscribe(
      (task) => {
        if (task) {
          const formattedSubtasks = task.subtasks
            ? task.subtasks.map((subtask: string) => ({
                subtask,
              }))
            : [];

          this.isVisiblesub_taskflag =
            formattedSubtasks.length > 0 ? true : false;

          this.taskForm.patchValue({
            subject: task.subject,
            description: task.description,
            priority: task.priority,
            startDate: this.formatDateToInput(new Date(task.startDate)),
            endDate: this.formatDateToInput(new Date(task.endDate)),
            isRemainder: task.isRemainder,
            isDeleted: task.isDeleted,
            isCompleted: task.isCompleted,
          });
          const subtasksArray = this.taskForm.get('subtasks') as FormArray;
          subtasksArray.clear(); // Clear any existing subtasks

          formattedSubtasks.forEach((subtask: any) => {
            subtasksArray.push(
              this.fb.group({
                subtask: [subtask.subtask],
              })
            );
          });

          this.authService.hideSpinner();
        }
      },
      (error) => {
        this.authService.hideSpinner();
        this.dataService.showerrorToaster(error);
      }
    );
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

  formatDateToInput(date: Date | null): string {
    if (date == null) {
      return ''; // Return empty string if date is null or invalid
    }

    const pad = (n: number) => (n < 10 ? '0' + n : n);

    // Subtract 5 hours and 30 minutes
    const adjustedDate = new Date(date.getTime() - (5 * 60 + 30) * 60000); // Convert 5 hours 30 minutes into milliseconds

    return `${adjustedDate.getFullYear()}-${pad(
      adjustedDate.getMonth() + 1
    )}-${pad(adjustedDate.getDate())}T${pad(adjustedDate.getHours())}:${pad(
      adjustedDate.getMinutes()
    )}`;
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
}
