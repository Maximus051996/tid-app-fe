import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgxSpinnerModule } from 'ngx-spinner';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../../services/auth/auth.service';
import { DataService } from '../../../services/data/data.service';
import { InvestmentService } from '../../../services/investment/investment.service';
import { Investment } from '../../../models/models';
import { DateTimePickerComponent } from '../../datetime-picker/datetime-picker.component';
import { AppSelectComponent, SelectOption } from '../../app-select/app-select.component';

@Component({
  selector: 'app-addeditviewinvestment',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgxSpinnerModule,
    DateTimePickerComponent,
    AppSelectComponent,
  ],
  templateUrl: './addeditviewinvestment.component.html',
  styleUrl: './addeditviewinvestment.component.scss',
})
export class AddeditviewinvestmentComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  operationHeader = '';
  isViewMode = false;
  investmentId: string | null = null;

  types: Investment['type'][] = [
    'Stock', 'Mutual Fund', 'Fixed Deposit', 'Bond', 'Real Estate', 'Crypto', 'Other',
  ];
  risks: Investment['risk'][] = ['Low', 'Medium', 'High'];
  statuses: Investment['status'][] = ['Active', 'Matured', 'Sold'];

  readonly typeOptions: SelectOption[] = [
    { value: 'Stock', label: 'Stock', icon: 'fa-solid fa-chart-line', tone: 'info', description: 'Equities & ETFs' },
    { value: 'Mutual Fund', label: 'Mutual Fund', icon: 'fa-solid fa-layer-group', tone: 'accent', description: 'Pooled investments' },
    { value: 'Fixed Deposit', label: 'Fixed Deposit', icon: 'fa-solid fa-piggy-bank', tone: 'warning', description: 'Term deposit' },
    { value: 'Bond', label: 'Bond', icon: 'fa-solid fa-file-contract', tone: 'muted', description: 'Debt instrument' },
    { value: 'Real Estate', label: 'Real Estate', icon: 'fa-solid fa-house', tone: 'accent', description: 'Property holdings' },
    { value: 'Crypto', label: 'Crypto', icon: 'fa-brands fa-bitcoin', tone: 'warning', description: 'Digital assets' },
    { value: 'Other', label: 'Other', icon: 'fa-solid fa-ellipsis', tone: 'muted' },
  ];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private service: InvestmentService,
    private auth: AuthService,
    private data: DataService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.route.url
      .pipe(takeUntil(this.destroy$))
      .subscribe((segments) => {
        this.operationHeader = this.formatString(segments[0].path);
        this.isViewMode = this.operationHeader === 'View Investment';
      });
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.investmentId = params.get('id');
        if (this.investmentId) this.loadInvestment(this.investmentId);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(80)]],
      type: ['Stock', Validators.required],
      amount: [0, [Validators.required, Validators.min(1)]],
      currentValue: [0, [Validators.required, Validators.min(0)]],
      startDate: ['', Validators.required],
      maturityDate: [''],
      risk: ['Medium', Validators.required],
      status: ['Active', Validators.required],
      notes: [''],
    });
  }

  loadInvestment(id: string): void {
    this.auth.showSpinner();
    this.service
      .getById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (investment) => {
          this.form.patchValue({
            name: investment.name,
            type: investment.type,
            amount: investment.amount,
            currentValue: investment.currentValue,
            startDate: this.toDateInput(investment.startDate),
            maturityDate: this.toDateInput(investment.maturityDate),
            risk: investment.risk,
            status: investment.status,
            notes: investment.notes ?? '',
          });
          if (this.isViewMode) this.form.disable();
          this.auth.hideSpinner();
        },
        error: (err: Error) => {
          this.data.showerrorToaster(err.message);
          this.auth.hideSpinner();
          this.router.navigate(['/investmentinfo']);
        },
      });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    if (v.maturityDate && v.startDate && v.maturityDate < v.startDate) {
      this.data.showerrorToaster('Maturity date must be after the start date.');
      return;
    }

    const payload: Partial<Investment> = {
      name: v.name,
      type: v.type,
      amount: Number(v.amount),
      currentValue: Number(v.currentValue),
      startDate: new Date(v.startDate).toISOString(),
      maturityDate: v.maturityDate ? new Date(v.maturityDate).toISOString() : null,
      risk: v.risk,
      status: v.status,
      notes: v.notes,
    };

    this.auth.showSpinner();
    const obs = this.investmentId
      ? this.service.edit(this.investmentId, payload)
      : this.service.add(payload);

    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.data.showSuccessToasterMsg(res.message);
        this.auth.hideSpinner();
        this.router.navigate(['/investmentinfo']);
      },
      error: (err: Error) => {
        this.data.showerrorToaster(err.message);
        this.auth.hideSpinner();
      },
    });
  }

  onReset(): void {
    if (this.investmentId) {
      this.loadInvestment(this.investmentId);
    } else {
      this.form.reset({
        type: 'Stock',
        risk: 'Medium',
        status: 'Active',
        amount: 0,
        currentValue: 0,
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/investmentinfo']);
  }

  get gainPreview(): number {
    const a = Number(this.form.get('amount')?.value) || 0;
    const c = Number(this.form.get('currentValue')?.value) || 0;
    return c - a;
  }

  get gainPctPreview(): number {
    const a = Number(this.form.get('amount')?.value) || 0;
    if (!a) return 0;
    return (this.gainPreview / a) * 100;
  }

  private formatString(input: string): string {
    return input
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private toDateInput(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => (n < 10 ? '0' + n : n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
