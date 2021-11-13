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

  quality: Quality = "Low";

  constructor(private renderingService: RenderingService,
    private animationService: AnimationService) {}

  ngAfterViewInit(){
    this.renderingService.init();
    this.animationService.animate();
  }

  ngAfterContentInit() {
    // get autodetected quality
    this.quality = this.renderingService.getQuality();
  }

  onLowQualitySelected() {
    this.quality = 'Low';
    this.renderingService.setQuality(this.quality);
  }

  onStandardQualitySelected() {
    this.quality = 'Standard';
    this.renderingService.setQuality(this.quality);
  }
}
