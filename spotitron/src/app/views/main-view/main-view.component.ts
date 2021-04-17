import { AfterViewInit, OnDestroy } from '@angular/core';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from 'spotify-lib';

import { RenderingService, StarfieldState } from 'src/app/rendering/rendering.service';
import { CountryDataService } from 'src/app/shared/country-data.service';
import { CountrySelectionService } from 'src/app/shared/country-selection.service';



@Component({
  selector: 'app-main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.css']
})
export class MainViewComponent implements AfterViewInit, OnDestroy {

  hoveredCountrySubscription: Subscription | undefined = undefined;
  hoveredCountry: string = "";

  constructor(
    private countryDataService: CountryDataService,
    private CountrySelectionService: CountrySelectionService,
    private renderingService: RenderingService,
    private authService: AuthService,
    private router: Router) {
    }

  ngAfterViewInit(){
    this.renderingService.setStarfieldState(StarfieldState.Halt);
    this.renderingService.initGlobe(this.countryDataService.getChartData());
    this.hoveredCountrySubscription = this.CountrySelectionService.getHoveredCountry().subscribe(country => {
      this.hoveredCountry = country;
    });
  }

  ngOnDestroy() {
    if (this.hoveredCountrySubscription) {
      this.hoveredCountrySubscription.unsubscribe();
    }
  }

  onLogout() {
    // we just need to hide globe, the instance of the service will be recreated
    this.renderingService.hideGlobe();
    this.renderingService.setStarfieldState(StarfieldState.Cruise); 
   
    this.authService.logout();
    this.countryDataService.clearStorage();
    this.router.navigate(['']);
  }
}
