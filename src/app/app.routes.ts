import { Routes } from '@angular/router';
import { TasklistComponent } from './components/task/tasklist/tasklist.component';
import { RegisterloginComponent } from './components/registerlogin/registerlogin/registerlogin.component';

export const routes: Routes = [
  { path: 'register-login', component: RegisterloginComponent },
  { path: 'taskinfo', component: TasklistComponent },
];
