import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { NgxSpinnerModule } from 'ngx-spinner';
import { DataService } from '../../services/data/data.service';
import { TaskService } from '../../services/task/task.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    CommonModule,
    RouterLinkActive,
    NgxSpinnerModule,
  ],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  userName: any;
  taskCount: number = 0;
  constructor(
    private authService: AuthService,
    private dataService: DataService,
    private taskService: TaskService
  ) {
    this.userName = this.authService.getUserName();

    this.taskService.getallTasks().subscribe((data) => {
      data = data.filter(
        (task: any) => task.isDeleted == false && task.isCompleted == false
      );
      this.taskCount = data.length;
    });
  }
  menuItems = [
    { name: 'Tasks', path: 'taskinfo', icon: 'fa-solid fa-list-check' },
    {
      name: 'Investment',
      path: 'add-edit-task',
      icon: 'fa-solid fa-hand-holding-dollar',
    },
  ];

  logout() {
    this.authService.removeJwtToken();
    this.dataService.showSuccessToasterMsg('Logout Successfully');
  }
}
