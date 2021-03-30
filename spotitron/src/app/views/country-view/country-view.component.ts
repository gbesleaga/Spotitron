import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { CountrySelectionService } from 'src/app/shared/country-selection.service';

@Component({
  selector: 'app-country-view',
  templateUrl: './country-view.component.html',
  styleUrls: ['./country-view.component.css']
})
export class CountryViewComponent implements OnInit {

  show: boolean = false;

  selectedCountrySubscription: Subscription | undefined = undefined;

  constructor(private countrySelectionService: CountrySelectionService) {
    this.countrySelectionService.getSelectedCountry().subscribe( country => {
      this.show = true;
      console.log(country);
    });
  }

  ngOnInit(): void {
  }

  onLeaveView() {
    this.show = false;
    this.countrySelectionService.clearSelection();
  }
}
