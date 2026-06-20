import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type ConfirmTone = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmRequest {
  /** Short eyebrow above the title — e.g. "Delete user". */
  eyebrow?: string;
  /** Bold dialog headline. */
  title: string;
  /** One- or two-line body copy. Plain text — no HTML. */
  message: string;
  /** Optional bullet list rendered under the message (e.g. "this will remove…"). */
  details?: string[];
  /** "Type to confirm" requirement. If set, the confirm button stays disabled
   *  until the user types this exact string. */
  confirmInput?: string;
  /** Visual tone — sets icon and accent color. */
  tone?: ConfirmTone;
  /** Confirm button label. Default "Confirm". */
  confirmLabel?: string;
  /** Cancel button label. Default "Cancel". */
  cancelLabel?: string;
  /** Optional FontAwesome icon class (default depends on tone). */
  icon?: string;
}

export interface ConfirmInternal extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

/**
 * Service-driven confirm dialog. Components inject this and call
 * `await confirm.ask({...})` instead of using `window.confirm`.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  /** The host component subscribes to this stream and renders the dialog. */
  readonly request$ = new Subject<ConfirmInternal>();

  ask(req: ConfirmRequest): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.request$.next({ ...req, resolve });
    });
  }
}
