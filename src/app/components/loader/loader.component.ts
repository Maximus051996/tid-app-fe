import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LoaderService } from '../../services/loader/loader.service';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="loader-shell" [class.visible]="visible" aria-live="polite" [attr.aria-busy]="visible">
      <div class="loader-card">
        <!-- Animated brand-mark spinner -->
        <span class="loader-orb">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <defs>
              <linearGradient id="ldr-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#34d399" />
                <stop offset="100%" stop-color="#15803d" />
              </linearGradient>
            </defs>
            <!-- Outer arc that spins -->
            <circle class="ldr-arc" cx="32" cy="32" r="26" />
            <!-- Inner brand bars -->
            <rect class="ldr-bar b1" x="22" y="32" width="5" height="10" rx="1.5" />
            <rect class="ldr-bar b2" x="29.5" y="28" width="5" height="14" rx="1.5" />
            <rect class="ldr-bar b3" x="37" y="22" width="5" height="20" rx="1.5" />
            <circle class="ldr-dot" cx="39.5" cy="17" r="2.2" />
          </svg>
        </span>

        <span class="loader-msg" *ngIf="message">{{ message }}</span>
        <span class="loader-msg" *ngIf="!message">Loading…</span>

        <!-- Indeterminate progress strip -->
        <span class="loader-strip"><span class="loader-strip-fill"></span></span>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 1200;
        pointer-events: none;
      }

      .loader-shell {
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at center, rgba(13, 15, 21, 0.65) 0%, rgba(13, 15, 21, 0.85) 100%);
        backdrop-filter: blur(6px) saturate(140%);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s ease, visibility 0s linear 0.2s;
      }

      .loader-shell.visible {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transition: opacity 0.2s ease, visibility 0s;
      }

      .loader-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.85rem;
        padding: 1.5rem 1.75rem;
        background: rgba(20, 22, 30, 0.85);
        border: 1px solid rgba(34, 197, 94, 0.3);
        border-radius: 18px;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5);
        min-width: 220px;
        animation: loader-card-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2);
      }

      @keyframes loader-card-in {
        from { opacity: 0; transform: translateY(8px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .loader-orb {
        position: relative;
        width: 64px;
        height: 64px;

        svg { width: 100%; height: 100%; }

        .ldr-arc {
          fill: none;
          stroke: url(#ldr-grad);
          stroke-width: 4;
          stroke-linecap: round;
          stroke-dasharray: 110 60;
          transform-origin: 32px 32px;
          animation: ldr-spin 1.4s linear infinite;
          filter: drop-shadow(0 0 8px rgba(34, 197, 94, 0.45));
        }

        .ldr-bar {
          fill: #ffffff;
          transform-origin: center 42px;
          animation: ldr-bar-pulse 1.4s ease-in-out infinite;
        }
        .ldr-bar.b1 { animation-delay: 0s; }
        .ldr-bar.b2 { animation-delay: 0.18s; }
        .ldr-bar.b3 { animation-delay: 0.36s; }

        .ldr-dot {
          fill: #ffffff;
          transform-origin: 39.5px 17px;
          animation: ldr-dot-pulse 1.4s ease-in-out 0.5s infinite;
        }
      }

      @keyframes ldr-spin {
        to { transform: rotate(360deg); }
      }

      @keyframes ldr-bar-pulse {
        0%, 100% { transform: scaleY(1); opacity: 1; }
        50% { transform: scaleY(0.4); opacity: 0.55; }
      }

      @keyframes ldr-dot-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.3); opacity: 0.6; }
      }

      .loader-msg {
        color: #e6e8ed;
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: 0.01em;
      }

      .loader-strip {
        position: relative;
        width: 200px;
        height: 3px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.06);
      }

      .loader-strip-fill {
        position: absolute;
        height: 100%;
        width: 40%;
        border-radius: 999px;
        background: linear-gradient(90deg, transparent, #22c55e 20%, #4ade80 50%, #22c55e 80%, transparent);
        animation: ldr-strip 1.6s ease-in-out infinite;
      }

      @keyframes ldr-strip {
        0%   { transform: translateX(-110%); }
        100% { transform: translateX(260%); }
      }

      @media (prefers-reduced-motion: reduce) {
        .loader-card,
        .ldr-arc,
        .ldr-bar,
        .ldr-dot,
        .loader-strip-fill { animation: none !important; }
      }
    `,
  ],
})
export class LoaderComponent implements OnInit, OnDestroy {
  visible = false;
  message = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private loader: LoaderService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loader.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((v) => { this.visible = v; this.cdr.markForCheck(); });
    this.loader.message$
      .pipe(takeUntil(this.destroy$))
      .subscribe((m) => { this.message = m; this.cdr.markForCheck(); });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
