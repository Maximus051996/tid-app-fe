/**
 * App-wide identity constants — single source of truth for version,
 * author, copyright. Update once on release; templates and docs read from here.
 */
export const APP_NAME = 'TID — Task & Investment Decision';
export const APP_SHORT_NAME = 'TID';
export const APP_VERSION = '2.0.0';
export const APP_RELEASE_NAME = 'v2 · Goals, Notes & Co-pilot';
export const APP_RELEASE_DATE = '2026-06-20';
export const APP_AUTHOR = 'Sayan Pramanick';
export const APP_COPYRIGHT_YEAR = new Date().getFullYear();
export const APP_COPYRIGHT = `© ${APP_COPYRIGHT_YEAR} ${APP_AUTHOR}. All rights reserved.`;

/** Static doc paths served from /public. */
export const DOC_PATHS = {
  userGuide: 'docs/TID-User-Guide.html',
  releaseNotes: 'docs/TID-Release-Notes.html',
};
