import { Routes } from '@angular/router';
import { TasklistComponent } from './components/task/tasklist/tasklist.component';
import { RegisterloginComponent } from './components/registerlogin/registerlogin.component';
import { LayoutComponent } from './components/layout/layout.component';
import { authGuardGuard } from './middlewares/guards/auth-guard.guard';
import { PagenotfoundComponent } from './components/pagenotfound/pagenotfound.component';
import { AddeditviewtaskComponent } from './components/task/addeditviewtask/addeditviewtask.component';

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
      { path: 'add-task', component: AddeditviewtaskComponent },
      { path: 'edit-task/:id', component: AddeditviewtaskComponent },
      { path: 'view-task/:id', component: AddeditviewtaskComponent },
      { path: '**', component: PagenotfoundComponent },
    ],
  },
];
