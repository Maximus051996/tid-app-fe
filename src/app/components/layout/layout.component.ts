import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, CommonModule, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  menuItems = [
    { name: 'Tasks', path: 'taskinfo', icon: 'fa-solid fa-list-check' },
    {
      name: 'Investment',
      path: 'add-edit-task',
      icon: 'fa-solid fa-hand-holding-dollar',
    },
  ];
}
