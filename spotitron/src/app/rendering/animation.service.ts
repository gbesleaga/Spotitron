import { Injectable, NgZone } from '@angular/core';
import { RenderingService } from './rendering.service';

@Injectable({providedIn: 'root'})
export class AnimationService {

  constructor(
    private renderingService: RenderingService) {
  }
  
  
  public animate(): void {
      requestAnimationFrame( () => this.animate() );
      //NgZone.assertNotInAngularZone();
      this.renderingService.render();
  }
}