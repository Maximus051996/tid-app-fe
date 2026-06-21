import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DataService {
  constructor(private toastr: ToastrService) {}

  private taskCountSource = new BehaviorSubject<number>(0);
  currentData = this.taskCountSource.asObservable();

  private investmentCountSource = new BehaviorSubject<number>(0);
  investmentCount$ = this.investmentCountSource.asObservable();

  private noteCountSource = new BehaviorSubject<number>(0);
  noteCount$ = this.noteCountSource.asObservable();

  private goalCountSource = new BehaviorSubject<number>(0);
  goalCount$ = this.goalCountSource.asObservable();

  changeData(data: number) {
    this.taskCountSource.next(data);
  }

  changeInvestmentCount(count: number) {
    this.investmentCountSource.next(count);
  }

  changeNoteCount(count: number) {
    this.noteCountSource.next(count);
  }

  changeGoalCount(count: number) {
    this.goalCountSource.next(count);
  }

  showSuccessToasterMsg(message: string) {
    this.toastr.success(message, 'Success');
  }

  showerrorToaster(message: string) {
    this.toastr.error(message, 'Error');
  }
}
