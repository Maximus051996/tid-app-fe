import { Routes } from '@angular/router';
import { LayoutComponent } from './components/layout/layout.component';
import { authGuardGuard, roleGuard } from './middlewares/guards/auth-guard.guard';

/**
 * Every page is lazy-loaded so the initial bundle stays small.
 * The shell (LayoutComponent + login screen) is the only eager-loaded UI.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'register-login', pathMatch: 'full' },
  {
    path: 'register-login',
    loadComponent: () =>
      import('./components/registerlogin/registerlogin.component').then(
        (m) => m.RegisterloginComponent
      ),
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuardGuard],
    children: [
      {
        path: 'goals',
        loadComponent: () =>
          import('./components/goal/goallist/goallist.component').then(
            (m) => m.GoallistComponent
          ),
      },
      {
        path: 'taskinfo',
        loadComponent: () =>
          import('./components/task/tasklist/tasklist.component').then(
            (m) => m.TasklistComponent
          ),
      },
      {
        path: 'add-task',
        loadComponent: () =>
          import('./components/task/addeditviewtask/addeditviewtask.component').then(
            (m) => m.AddeditviewtaskComponent
          ),
      },
      {
        path: 'edit-task/:id',
        loadComponent: () =>
          import('./components/task/addeditviewtask/addeditviewtask.component').then(
            (m) => m.AddeditviewtaskComponent
          ),
      },
      {
        path: 'view-task/:id',
        loadComponent: () =>
          import('./components/task/addeditviewtask/addeditviewtask.component').then(
            (m) => m.AddeditviewtaskComponent
          ),
      },
      {
        path: 'notes',
        loadComponent: () =>
          import('./components/note/notelist/notelist.component').then(
            (m) => m.NotelistComponent
          ),
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./components/calendar/calendar.component').then(
            (m) => m.CalendarComponent
          ),
      },
      {
        path: 'investmentinfo',
        loadComponent: () =>
          import('./components/investment/investmentlist/investmentlist.component').then(
            (m) => m.InvestmentlistComponent
          ),
      },
      {
        path: 'add-investment',
        loadComponent: () =>
          import('./components/investment/addeditviewinvestment/addeditviewinvestment.component').then(
            (m) => m.AddeditviewinvestmentComponent
          ),
      },
      {
        path: 'edit-investment/:id',
        loadComponent: () =>
          import('./components/investment/addeditviewinvestment/addeditviewinvestment.component').then(
            (m) => m.AddeditviewinvestmentComponent
          ),
      },
      {
        path: 'view-investment/:id',
        loadComponent: () =>
          import('./components/investment/addeditviewinvestment/addeditviewinvestment.component').then(
            (m) => m.AddeditviewinvestmentComponent
          ),
      },
      {
        path: 'help',
        loadComponent: () =>
          import('./components/help/help.component').then(
            (m) => m.HelpComponent
          ),
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('./components/admin/admin.component').then(
            (m) => m.AdminComponent
          ),
        canActivate: [roleGuard(['admin'])],
      },
      {
        path: '**',
        loadComponent: () =>
          import('./components/pagenotfound/pagenotfound.component').then(
            (m) => m.PagenotfoundComponent
          ),
      },
    ],
  },
];
