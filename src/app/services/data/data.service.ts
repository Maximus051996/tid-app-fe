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

  changeData(data: number) {
    this.taskCountSource.next(data);
  }

  changeInvestmentCount(count: number) {
    this.investmentCountSource.next(count);
  }

  showSuccessToasterMsg(message: string) {
    this.toastr.success(message, 'Success');
  }

  showerrorToaster(message: string) {
    this.toastr.error(message, 'Error');
  }
}
