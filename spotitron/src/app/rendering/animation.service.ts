import { Injectable, NgZone } from '@angular/core';
import { Quality, RenderingService } from './rendering.service';

const LOW_FPS = 30
const HIGH_FPS = 60

@Injectable({providedIn: 'root'})
export class AnimationService {

  fpsInterval: number = 1000  / LOW_FPS;
  lastRender: number = 0;

  constructor(private renderingService: RenderingService) {
  }
  
  public setQuality(q: Quality) {
    switch(q) {
      case "Ultra-Low":
      case "Low":
      case "Mid":
        this.fpsInterval = 1000 / LOW_FPS;
        break;


      case 'High':
        this.fpsInterval = 1000 / HIGH_FPS;
        break;
    }
  }

  public animate(): void {
      requestAnimationFrame( () => this.animate() );

      //NgZone.assertNotInAngularZone();

      if (this.lastRender == 0) {
        this.lastRender = Date.now();
        this.renderingService.render();
      } else {
        const now = Date.now();
        const elapsed = now - this.lastRender;
  
        if (elapsed > this.fpsInterval) {
          this.lastRender = now - (elapsed % this.fpsInterval);
          this.renderingService.render();
        }
      }
  }
}