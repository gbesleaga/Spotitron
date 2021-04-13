import { AfterViewInit } from '@angular/core';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'spotify-lib';

import { RenderingService, StarfieldState } from 'src/app/rendering/rendering.service';
import { CountryDataService } from 'src/app/shared/country-data.service';



@Component({
  selector: 'app-main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.css']
})
export class MainViewComponent implements AfterViewInit {

  constructor(
    private countryDataService: CountryDataService,
    private renderingService: RenderingService,
    private authService: AuthService,
    private router: Router) {
    }

  ngAfterViewInit(){
    this.renderingService.setStarfieldState(StarfieldState.Halt);
    this.renderingService.initGlobe(this.countryDataService.getChartData());
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
