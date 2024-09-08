import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  constructor(private toastr: ToastrService) {}

  private subject = new Subject<string>();

  // Observable stream
  data$ = this.subject.asObservable();

  // Method to emit data
  sendData(message: string) {
    this.subject.next(message);
  }

  showSuccessToasterMsg(message: any) {
    this.toastr.success(message, 'Success');
  }

  showerrorToaster(message: any) {
    this.toastr.error(message, 'Error');
  }
}
