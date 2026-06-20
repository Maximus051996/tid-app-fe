import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgxPaginationModule } from 'ngx-pagination';
import { NgxSpinnerModule } from 'ngx-spinner';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import * as Highcharts from 'highcharts';
import { HighchartsChartModule } from 'highcharts-angular';

import { InvestmentService } from '../../../services/investment/investment.service';
import { AuthService } from '../../../services/auth/auth.service';
import { DataService } from '../../../services/data/data.service';
import { ThemeService } from '../../../services/theme/theme.service';
import { Investment } from '../../../models/models';
import { ConfirmDialogService } from '../../confirm-dialog/confirm-dialog.service';

@Component({
  selector: 'app-investmentlist',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgxSpinnerModule,
    NgxPaginationModule,
    HighchartsChartModule,
  ],
  templateUrl: './investmentlist.component.html',
  styleUrl: './investmentlist.component.scss',
})
export class InvestmentlistComponent implements OnInit, OnDestroy {
  Highcharts = Highcharts;
  allocationOptions: any;
  performanceOptions: any;

  items: Investment[] = [];
  searchText = '';
  filterType = 'All';
  currentPage = 1;
  itemsPerPage = 6;

  totalInvested = 0;
  currentPortfolioValue = 0;
  totalGain = 0;
  gainPct = 0;
  activeCount = 0;

  private readonly destroy$ = new Subject<void>();
  private spinnerTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private service: InvestmentService,
    private auth: AuthService,
    private data: DataService,
    private router: Router,
    private themeService: ThemeService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.load();
    // Rebuild charts when the theme flips so colors stay readable.
    this.themeService.theme$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.items.length) this.buildCharts();
      });
  }

  ngOnDestroy(): void {
    if (this.spinnerTimer) clearTimeout(this.spinnerTimer);
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.auth.showSpinner();
    this.service
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.items = res;
          this.computeStats();
          this.buildCharts();
          const activeNonDeleted = res.filter(
            (i) => !i.isDeleted && i.status === 'Active'
          ).length;
          this.data.changeInvestmentCount(activeNonDeleted);
          if (this.spinnerTimer) clearTimeout(this.spinnerTimer);
          this.spinnerTimer = setTimeout(() => {
            this.auth.hideSpinner();
            this.spinnerTimer = null;
          }, 300);
        },
        error: (err: Error) => {
          this.data.showerrorToaster(err.message);
          this.auth.hideSpinner();
        },
      });
  }

  get filteredItems(): Investment[] {
    return this.items.filter((i) => {
      const matchesText = i.name
        .toLowerCase()
        .includes(this.searchText.toLowerCase());
      const matchesType = this.filterType === 'All' || i.type === this.filterType;
      return matchesText && matchesType;
    });
  }

  get types(): string[] {
    return ['All', ...Array.from(new Set(this.items.map((i) => i.type)))];
  }

  addItem(): void {
    this.router.navigate(['/add-investment']);
  }

  view(id: string): void {
    this.router.navigate(['/view-investment', id]);
  }

  edit(id: string): void {
    this.router.navigate(['/edit-investment', id]);
  }

  async delete(id: string): Promise<void> {
    const item = this.items.find((i) => i._id === id);
    const ok = await this.confirmDialog.ask({
      eyebrow: 'Delete investment',
      title: item ? `Delete "${item.name}"?` : 'Delete investment?',
      message:
        'This investment will be removed from your active portfolio and excluded from totals and charts.',
      details: item
        ? [
            `${item.type} • ${item.risk} risk`,
            `Invested: ${item.amount.toLocaleString()}`,
            `Current value: ${item.currentValue.toLocaleString()}`,
          ]
        : undefined,
      tone: 'danger',
      confirmLabel: 'Delete investment',
      icon: 'fa-solid fa-trash',
    });
    if (!ok) return;
    this.auth.showSpinner();
    this.service
      .delete(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.data.showSuccessToasterMsg(res.message);
          this.load();
        },
        error: (err: Error) => {
          this.data.showerrorToaster(err.message);
          this.auth.hideSpinner();
        },
      });
  }

  gainOf(item: Investment): number {
    return item.currentValue - item.amount;
  }

  gainPctOf(item: Investment): number {
    if (!item.amount) return 0;
    return ((item.currentValue - item.amount) / item.amount) * 100;
  }

  riskClass(risk: string): string {
    switch (risk) {
      case 'High': return 'risk-high';
      case 'Medium': return 'risk-medium';
      default: return 'risk-low';
    }
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Active': return 'status-active';
      case 'Matured': return 'status-matured';
      case 'Sold': return 'status-sold';
      default: return '';
    }
  }

  private computeStats(): void {
    const live = this.items.filter((i) => !i.isDeleted);
    this.totalInvested = live.reduce((sum, i) => sum + i.amount, 0);
    this.currentPortfolioValue = live.reduce((sum, i) => sum + i.currentValue, 0);
    this.totalGain = this.currentPortfolioValue - this.totalInvested;
    this.gainPct = this.totalInvested
      ? (this.totalGain / this.totalInvested) * 100
      : 0;
    this.activeCount = live.filter((i) => i.status === 'Active').length;
  }

  private buildCharts(): void {
    const live = this.items.filter((i) => !i.isDeleted);

    const isDark = this.themeService.current() === 'dark';
    const palette = {
      text: isDark ? '#e6e8ed' : '#0f172a',
      muted: isDark ? '#8b909e' : '#64748b',
      grid: isDark ? '#1c1f29' : '#e5e7f0',
      tooltipBg: isDark ? '#0a0c12' : '#ffffff',
      tooltipBorder: isDark ? '#1c1f29' : '#e5e7f0',
      borderColor: isDark ? '#14161e' : '#ffffff',
      pieColors: isDark
        ? ['#22c55e', '#38bdf8', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']
        : ['#16a34a', '#0284c7', '#7c3aed', '#d97706', '#dc2626', '#0891b2', '#db2777'],
      investedColor: isDark ? '#475569' : '#94a3b8',
      currentColor: isDark ? '#22c55e' : '#16a34a',
    };

    // Allocation pie by type
    const byType = new Map<string, number>();
    live.forEach((i) => byType.set(i.type, (byType.get(i.type) ?? 0) + i.currentValue));
    const allocationData = Array.from(byType.entries()).map(([k, v]) => [k, v]);

    this.allocationOptions = {
      chart: { type: 'pie', backgroundColor: 'transparent' },
      title: {
        text: 'Portfolio Allocation',
        style: { color: palette.text, fontWeight: '700', fontSize: '16px' },
      },
      credits: { enabled: false },
      tooltip: {
        backgroundColor: palette.tooltipBg,
        borderColor: palette.tooltipBorder,
        style: { color: palette.text },
        pointFormat: '<b>{point.name}</b>: ₹{point.y:,.0f} ({point.percentage:.1f}%)',
      },
      plotOptions: {
        pie: {
          innerSize: '55%',
          borderColor: palette.borderColor,
          borderRadius: 4,
          dataLabels: {
            enabled: true,
            format: '{point.name}: {point.percentage:.0f}%',
            style: { color: palette.muted, fontSize: '12px', textOutline: 'none' },
          },
        },
      },
      colors: palette.pieColors,
      series: [{ name: 'Value', data: allocationData }],
    };

    // Performance: invested vs current per investment
    const categories = live.map((i) => i.name);
    const invested = live.map((i) => i.amount);
    const current = live.map((i) => i.currentValue);

    this.performanceOptions = {
      chart: { type: 'column', backgroundColor: 'transparent' },
      title: {
        text: 'Invested vs Current Value',
        style: { color: palette.text, fontWeight: '700', fontSize: '16px' },
      },
      credits: { enabled: false },
      xAxis: {
        categories,
        labels: { style: { color: palette.muted, fontSize: '11px' } },
        lineColor: palette.grid,
        tickColor: palette.grid,
      },
      yAxis: {
        gridLineColor: palette.grid,
        title: { text: '₹ Amount', style: { color: palette.muted } },
        labels: { style: { color: palette.muted } },
      },
      legend: { itemStyle: { color: palette.text }, itemHoverStyle: { color: palette.text } },
      plotOptions: {
        column: { borderRadius: 6, borderColor: 'transparent', pointPadding: 0.15, groupPadding: 0.1 },
      },
      tooltip: {
        backgroundColor: palette.tooltipBg,
        borderColor: palette.tooltipBorder,
        style: { color: palette.text },
        shared: true,
        valuePrefix: '₹',
      },
      series: [
        { name: 'Invested', data: invested, color: palette.investedColor },
        { name: 'Current', data: current, color: palette.currentColor },
      ],
    };
  }
}
