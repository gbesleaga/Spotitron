import { AfterContentInit, AfterViewInit, OnDestroy } from '@angular/core';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from 'spotify-lib';

import { RenderingService, StarfieldState } from 'src/app/rendering/rendering.service';
import { CountryDataService } from 'src/app/shared/country-data.service';
import { CountrySelectionService } from 'src/app/shared/country-selection.service';
import { MobileService } from 'src/app/shared/mobile.service';



@Component({
  selector: 'app-main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.css']
})
export class MainViewComponent implements AfterViewInit, AfterContentInit, OnDestroy {

  hoveredCountrySubscription: Subscription | undefined = undefined;
  hoveredCountry: string = "";

  selectedCountrySubscription: Subscription | undefined = undefined;
  selectionClearedSubscription: Subscription | undefined = undefined;

  isOnMobile: boolean = false;

  hideUI = false;

  constructor(
    private countryDataService: CountryDataService,
    private countrySelectionService: CountrySelectionService,
    private renderingService: RenderingService,
    private authService: AuthService,
    private mobileService: MobileService,
    private router: Router) {
    }

  ngAfterViewInit(){
    this.renderingService.setStarfieldState(StarfieldState.Halt);
    this.renderingService.initGlobe(this.countryDataService.getChartData());
    this.hoveredCountrySubscription = this.countrySelectionService.getHoveredCountry().subscribe(country => {
      this.hoveredCountry = country;
    });

    this.selectedCountrySubscription = this.selectedCountrySubscription = this.countrySelectionService.getSelectedCountry().subscribe( () => {
      this.hideUI = true;
    });

    this.selectionClearedSubscription = this.countrySelectionService.onClearSelection().subscribe( () => {
      this.hideUI = false;
    });
  }

  ngAfterContentInit() {
    this.isOnMobile = this.mobileService.isOnMobile();
  }

  ngOnDestroy() {
    if (this.hoveredCountrySubscription) {
      this.hoveredCountrySubscription.unsubscribe();
    }

    if (this.selectedCountrySubscription) {
      this.selectedCountrySubscription.unsubscribe();
    }

    if (this.selectionClearedSubscription) {
      this.selectionClearedSubscription.unsubscribe();
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
