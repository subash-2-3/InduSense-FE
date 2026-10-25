import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppFailurePanelComponent } from './core/errors/app-failure-panel.component';
import { ToastContainerComponent } from './shared/ui/toast/toast-container.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent, AppFailurePanelComponent],
  template: '<router-outlet /><app-toast-container /><app-failure-panel />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
