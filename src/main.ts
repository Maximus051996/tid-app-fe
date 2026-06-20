import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    // Fade out the boot splash as soon as Angular's first render lands.
    requestAnimationFrame(() => {
      const splash = document.getElementById('boot-splash');
      if (!splash) return;
      splash.classList.add('fade-out');
      // Remove after the CSS transition finishes
      setTimeout(() => splash.remove(), 400);
    });
  })
  .catch((err) => console.error(err));
