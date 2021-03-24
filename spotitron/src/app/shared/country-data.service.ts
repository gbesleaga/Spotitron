import { Injectable } from "@angular/core";

import countryData from '../../assets/countries/data.json'

@Injectable({providedIn: 'root'})
export class CountryDataService {
    
    public readonly data: any = undefined;

    public readonly countryNames: string[];

    constructor() {
        this.data = countryData;

        this.countryNames = [];
        
        for (let country in this.data) {
            this.countryNames.push(country);
        }
    }
}