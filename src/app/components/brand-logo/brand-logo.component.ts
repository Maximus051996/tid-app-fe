import { CommonModule } from '@angular/common';
import { Component, HostBinding, Input } from '@angular/core';

/**
 * TID brand mark — three ascending rounded bars inside a rounded
 * tile, with a small dot at the top representing the next milestone.
 *
 * The shape reads cleanly at any size: a chart for "investments"
 * and stacked task rows for "tasks". One mark, both meanings.
 *
 * Inputs:
 *  - size: pixel size (default 48). Can also be overridden by setting
 *          `--bl-size` directly on the host.
 *  - animated: animate on mount (bars rise + dot pop + sheen sweep)
 *  - flat: drop the elevated drop-shadow (used inside flat headers)
 */
@Component({
  selector: 'app-brand-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient [attr.id]="gid + '-grad'" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#34d399" />
          <stop offset="55%" stop-color="#22c55e" />
          <stop offset="100%" stop-color="#15803d" />
        </linearGradient>
        <linearGradient [attr.id]="gid + '-sheen'" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="white" stop-opacity="0.28" />
          <stop offset="100%" stop-color="white" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- Tile -->
      <rect width="48" height="48" rx="13" [attr.fill]="'url(#' + gid + '-grad)'" />
      <!-- Top sheen -->
      <rect width="48" height="22" rx="13" [attr.fill]="'url(#' + gid + '-sheen)'" />

      <!-- Three ascending bars -->
      <g class="bl-bars">
        <rect class="bl-bar b1" x="11" y="28" width="6" height="11" rx="2" fill="white" opacity="0.65" />
        <rect class="bl-bar b2" x="21" y="22" width="6" height="17" rx="2" fill="white" opacity="0.85" />
        <rect class="bl-bar b3" x="31" y="14" width="6" height="25" rx="2" fill="white" />
      </g>

      <!-- Milestone dot above the tallest bar -->
      <circle class="bl-dot" cx="34" cy="9.5" r="2.6" fill="white" />
    </svg>

    <!-- Internal shine sweep (CSS animated) -->
    <span class="bl-shine" aria-hidden="true"></span>
  `,
  styles: [
    `
      :host {
        display: inline-block;
        position: relative;
        width: var(--bl-size, 48px);
        height: var(--bl-size, 48px);
        border-radius: 27%;
        overflow: hidden;
        line-height: 0;
        filter: drop-shadow(0 10px 22px rgba(34, 197, 94, 0.42));
        flex-shrink: 0;
      }

      :host(.flat) { filter: none; }

      svg { display: block; width: 100%; height: 100%; }

      /* Sheen sweep — only when animated */
      .bl-shine {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          120deg,
          transparent 30%,
          rgba(255, 255, 255, 0.42) 50%,
          transparent 70%
        );
        transform: translateX(-130%);
        pointer-events: none;
        opacity: 0;
      }

      :host(.animated) .bl-shine {
        opacity: 1;
        animation: bl-shine 4.5s ease-in-out 1.6s infinite;
      }

      @keyframes bl-shine {
        0% { transform: translateX(-130%); }
        35% { transform: translateX(140%); }
        100% { transform: translateX(140%); }
      }

      /* Bars rise from the baseline */
      :host(.animated) .bl-bar {
        transform-origin: center 39px;
        transform: scaleY(0);
        animation: bl-rise 0.55s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards;
      }
      :host(.animated) .bl-bar.b1 { animation-delay: 0.15s; }
      :host(.animated) .bl-bar.b2 { animation-delay: 0.28s; }
      :host(.animated) .bl-bar.b3 { animation-delay: 0.42s; }

      @keyframes bl-rise {
        from { transform: scaleY(0); }
        70%  { transform: scaleY(1.05); }
        to   { transform: scaleY(1); }
      }

      /* Milestone dot pops + pulses */
      :host(.animated) .bl-dot {
        transform-origin: 34px 9.5px;
        transform: scale(0);
        animation:
          bl-dot-pop 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.4) 0.85s forwards,
          bl-dot-pulse 2.4s ease-in-out 1.4s infinite;
      }

      @keyframes bl-dot-pop {
        0% { transform: scale(0); }
        70% { transform: scale(1.4); }
        100% { transform: scale(1); }
      }

      @keyframes bl-dot-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.18); }
      }

      @media (prefers-reduced-motion: reduce) {
        :host(.animated) .bl-shine,
        :host(.animated) .bl-bar,
        :host(.animated) .bl-dot {
          animation: none !important;
          transform: none !important;
        }
      }
    `,
  ],
})
export class BrandLogoComponent {
  @Input() set size(value: number) {
    this._size = value;
  }
  get size(): number {
    return this._size;
  }
  private _size = 48;

  @HostBinding('style.--bl-size.px') get sizeVar(): number {
    return this._size;
  }

  @HostBinding('class.animated')
  @Input()
  animated = false;

  @HostBinding('class.flat')
  @Input()
  flat = false;

  /** Unique gradient ID per instance so multiple logos don't collide. */
  private static counter = 0;
  gid = 'bl-' + ++BrandLogoComponent.counter;
}
