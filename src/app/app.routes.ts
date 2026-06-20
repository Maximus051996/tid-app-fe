import { Routes } from '@angular/router';
import { TasklistComponent } from './components/task/tasklist/tasklist.component';
import { RegisterloginComponent } from './components/registerlogin/registerlogin.component';
import { LayoutComponent } from './components/layout/layout.component';
import { authGuardGuard, roleGuard } from './middlewares/guards/auth-guard.guard';
import { PagenotfoundComponent } from './components/pagenotfound/pagenotfound.component';
import { AddeditviewtaskComponent } from './components/task/addeditviewtask/addeditviewtask.component';
import { InvestmentlistComponent } from './components/investment/investmentlist/investmentlist.component';
import { AddeditviewinvestmentComponent } from './components/investment/addeditviewinvestment/addeditviewinvestment.component';
import { AdminComponent } from './components/admin/admin.component';
import { CalendarComponent } from './components/calendar/calendar.component';
import { NotelistComponent } from './components/note/notelist/notelist.component';
import { GoallistComponent } from './components/goal/goallist/goallist.component';
import { HelpComponent } from './components/help/help.component';

export const routes: Routes = [
  { path: '', redirectTo: 'register-login', pathMatch: 'full' },
  {
    path: 'register-login',
    component: RegisterloginComponent,
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuardGuard],
    children: [
      { path: 'taskinfo', component: TasklistComponent },
      { path: 'calendar', component: CalendarComponent },
      { path: 'add-task', component: AddeditviewtaskComponent },
      { path: 'edit-task/:id', component: AddeditviewtaskComponent },
      { path: 'view-task/:id', component: AddeditviewtaskComponent },
      { path: 'investmentinfo', component: InvestmentlistComponent },
      { path: 'add-investment', component: AddeditviewinvestmentComponent },
      {
        path: 'edit-investment/:id',
        component: AddeditviewinvestmentComponent,
      },
      {
        path: 'view-investment/:id',
        component: AddeditviewinvestmentComponent,
      },
      { path: 'notes', component: NotelistComponent },
      { path: 'goals', component: GoallistComponent },
      { path: 'help', component: HelpComponent },
      {
        path: 'admin',
        component: AdminComponent,
        canActivate: [roleGuard(['admin'])],
      },
      { path: '**', component: PagenotfoundComponent },
    ],
  },
];
