import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastContainerComponent } from './shared/ui/toast/toast-container.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent],
  template: '<router-outlet /><app-toast-container />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
