import { Routes } from '@angular/router';
import { TasklistComponent } from './components/task/tasklist/tasklist.component';
import { RegisterloginComponent } from './components/registerlogin/registerlogin.component';
import { LayoutComponent } from './components/layout/layout.component';
import { AddedittaskComponent } from './components/task/addedittask/addedittask.component';
import { authGuardGuard } from './middlewares/guards/auth-guard.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'register-login', pathMatch: 'full' },
  {
    path: 'register-login',
    component: RegisterloginComponent,
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuardGuard], // Protect this route with AuthGuard
    children: [
      { path: 'taskinfo', component: TasklistComponent },
      { path: 'add-edit-task', component: AddedittaskComponent },
    ],
  },
];
