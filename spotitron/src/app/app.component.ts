import { AfterContentInit, AfterViewInit, Component, NgZone, OnDestroy } from '@angular/core';
import { AnimationService } from './rendering/animation.service';
import { Quality, RenderingService } from './rendering/rendering.service';
import { CountrySelectionService } from './shared/country-selection.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit, AfterContentInit {
  title = 'spotitron';

  hideUI = false;
  quality: Quality = "Low";

  
  constructor(private renderingService: RenderingService,
    private animationService: AnimationService,
    private countrySelectionService: CountrySelectionService,
    private ngZone: NgZone) {
    // no need to clear
    this.countrySelectionService.getSelectedCountry().subscribe(() => {
      this.hideUI = true;
    });

    this.countrySelectionService.onClearSelection().subscribe(() => {
      this.hideUI = false;
    });
  }


  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      this.renderingService.init();
      this.animationService.animate();
    });
  }


  ngAfterContentInit() {
    // get autodetected quality
    this.quality = this.renderingService.getQuality();
    this.animationService.setQuality(this.quality);
  }


  onUltraLowQualitySelected(): void {
    this.quality = 'Ultra-Low';
    this.renderingService.setQuality(this.quality);
    this.animationService.setQuality(this.quality);
  }


  onLowQualitySelected(): void {
    this.quality = 'Low';
    this.renderingService.setQuality(this.quality);
    this.animationService.setQuality(this.quality);
  }


  onMidQualitySelected(): void {
    this.quality = 'Mid';
    this.renderingService.setQuality(this.quality);
    this.animationService.setQuality(this.quality);
  }


  onHighQualitySelected(): void {
    this.quality = 'High';
    this.renderingService.setQuality(this.quality);
    this.animationService.setQuality(this.quality);
  }
}
