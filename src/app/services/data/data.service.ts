import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  constructor(private toastr: ToastrService) {}

  private dataSource = new BehaviorSubject<number>(0); // Initialize with a default value
  currentData = this.dataSource.asObservable(); // Expose the observable

  // Method to emit data
  changeData(data: number) {
    this.dataSource.next(data); // Update the value in the BehaviorSubject
  }

  showSuccessToasterMsg(message: any) {
    this.toastr.success(message, 'Success');
  }

  showerrorToaster(message: any) {
    this.toastr.error(message, 'Error');
  }
}
