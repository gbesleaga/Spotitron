/*
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.txt', which is part of this source code package.
 */

import { Injectable } from '@angular/core';
import { Router, CanActivate } from '@angular/router';
import { CountryDataService } from './country-data.service'

@Injectable({providedIn: 'root'})
export class CountryDataGuardService implements CanActivate {  

  cantActivateRoute = '';

  constructor(public countryDataService: CountryDataService, public router: Router) {}
  
  setCantActivateReroute(route: string) {
    this.cantActivateRoute = route;
  }
  
  canActivate(): boolean {
    if (!this.countryDataService.isChartDataReady()) {
      this.router.navigate([this.cantActivateRoute]);
      return false;
    }

    return true;
  }
}
