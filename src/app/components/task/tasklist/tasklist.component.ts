import { Component } from '@angular/core';
import { NgxSpinnerModule } from 'ngx-spinner';

@Component({
  selector: 'app-tasklist',
  standalone: true,
  imports: [NgxSpinnerModule],
  templateUrl: './tasklist.component.html',
  styleUrl: './tasklist.component.scss',
})
export class TasklistComponent {}
