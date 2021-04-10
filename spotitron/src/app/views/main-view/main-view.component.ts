import { AfterViewInit } from '@angular/core';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'spotify-lib';

import { RenderingService } from 'src/app/rendering/rendering.service';
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
    this.renderingService.initGlobe(this.countryDataService.getChartData());
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['']);
  }
}
