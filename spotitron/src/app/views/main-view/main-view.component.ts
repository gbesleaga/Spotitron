import { AfterViewInit, OnDestroy } from '@angular/core';
import { Component } from '@angular/core';
import { Subscription } from 'rxjs';

import { AnimationService } from 'src/app/rendering/animation.service';
import { RenderingService } from 'src/app/rendering/rendering.service';
import { CountryDataService } from 'src/app/shared/country-data.service';



@Component({
  selector: 'app-main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.css']
})
export class MainViewComponent implements AfterViewInit, OnDestroy {
  
  private chartDataSubscribtion: Subscription | undefined = undefined;

  constructor(
    private countryDataService: CountryDataService,
    private renderingService: RenderingService,
    private animationService: AnimationService) {
    }

  ngAfterViewInit(){
    // TODO will be moved; should we group these 2 calls into 1? 
    this.countryDataService.fetchChartData();
    this.countryDataService.getChartData().subscribe(charts => {
      this.renderingService.init(charts);
      this.animationService.animate();
    })
  }

  ngOnDestroy() {
    if (this.chartDataSubscribtion) {
      this.chartDataSubscribtion.unsubscribe();
    }
  }
}
