import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { NgxSpinnerModule } from 'ngx-spinner';
import { TaskService } from '../../../services/task/task.service';
import { Router } from '@angular/router';
import { DataService } from '../../../services/data/data.service';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-tasklist',
  standalone: true,
  imports: [NgxSpinnerModule, CommonModule, NgxPaginationModule, FormsModule],
  templateUrl: './tasklist.component.html',
  styleUrl: './tasklist.component.scss',
})
export class TasklistComponent implements OnInit {
  items: any[] = []; // Initialize items as an empty array

  constructor(
    private taskService: TaskService,
    private dataService: DataService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.getTaskDetails();
  }

  searchText = '';
  currentPage = 1;
  itemsPerPage = 5;

  addItem() {
    this.router.navigate(['/add-task']);
  }

  editItem(item: any) {
    //console.log('Edit button clicked for item:', item);
  }

  get filteredItems() {
    return this.items.filter((item) =>
      item.subject.toLowerCase().includes(this.searchText.toLowerCase())
    );
  }

  editviewDetails(id: any, operation: any) {
    this.authService.showSpinner();
    const responseObservable = this.taskService.gettaskbyId(id);
    responseObservable.subscribe(
      (res: any) => {
        this.authService.hideSpinner();
        if (operation == 'Edit') {
          this.router.navigate(['/edit-task', id]);
        } else if (operation == 'View') {
          this.router.navigate(['/view-task', id]);
        }
      },
      (err) => {
        this.dataService.showerrorToaster(err.message);
        this.authService.hideSpinner();
      }
    );
  }

  getCardClass(priority: string, isDeleted: boolean): string {
    if (isDeleted) {
      return 'bg-light text-dark';
    }
    switch (priority) {
      case 'High':
        return 'bg-danger text-white';
      case 'Medium':
        return 'bg-warning text-dark';
      case 'Low':
        return 'bg-primary text-white';
      case 'Done':
        return 'bg-success text-white';
      default:
        return 'bg-light text-dark';
    }
  }

  deleteItem(id: any) {
    this.authService.showSpinner();
    this.taskService.deleteTask(id).subscribe((res: any) => {
      if (res.message) {
        this.getTaskDetails();
      }
    });
  }

  getTaskDetails() {
    this.authService.showSpinner();
    const responseObservable = this.taskService.getallTasks();
    responseObservable.subscribe(
      (res: any) => {
        this.items = res;
        setTimeout(() => {
          this.authService.hideSpinner();
        }, 500);
      },
      (err) => {
        this.dataService.showerrorToaster(err.message);
        setTimeout(() => {
          this.authService.hideSpinner();
        }, 2000);
      }
    );
  }
}
