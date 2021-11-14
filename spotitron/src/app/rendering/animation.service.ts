import { Injectable, NgZone } from '@angular/core';
import { RenderingService } from './rendering.service';

@Injectable({providedIn: 'root'})
export class AnimationService {

  constructor(
    private renderingService: RenderingService,
    private ngZone: NgZone) {
      this.ngZone.runOutsideAngular(() => this.animate());
  }
  
  
  public animate(): void {
      requestAnimationFrame( () => this.animate() );
      this.renderingService.render();
  }
}