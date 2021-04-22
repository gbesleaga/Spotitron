import { AfterContentInit, AfterViewInit, Component } from '@angular/core';
import { AnimationService } from './rendering/animation.service';
import { Quality, RenderingService } from './rendering/rendering.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit, AfterContentInit {
  title = 'spotitron';

  quality: 'Low' | 'Standard' | '' = '';

  constructor(private renderingService: RenderingService,
    private animationService: AnimationService) {}

  ngAfterViewInit(){
    this.renderingService.init();
    this.animationService.animate();
  }

  ngAfterContentInit() {
    // get autodetected quality
    const q = this.renderingService.getQuality();

    switch (q) {
      case Quality.Low:
        this.quality = 'Low';
        break;

      case Quality.Standard:
        this.quality = 'Standard';
        break;
    }
  }

  onLowQualitySelected() {
    this.renderingService.setQuality(Quality.Low);
    this.quality = 'Low';
  }

  onStandardQualitySelected() {
    this.renderingService.setQuality(Quality.Standard);
    this.quality = 'Standard';
  }
}
