import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
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
export class AddeditviewtaskComponent {
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
    } = this.taskForm.value;
    let jsonData: any = { description, priority, endDate };

    if (!this.taskId) {
      jsonData = {
        subject,
        description,
        priority,
        startDate,
        endDate,
        isRemainder,
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
}
