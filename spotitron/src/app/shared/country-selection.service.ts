import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

@Injectable({providedIn: 'root'})
export class CountrySelectionService {

    //private countrySelected = false;
    //private country: string = "";

    private countrySelectedSubject: Subject<string> = new Subject();
    private clearSelectionSubject: Subject<void> = new Subject(); 

    selectCountry(country: string) {
        
        //this.country = country;

        this.countrySelectedSubject.next(country);
    }

    getSelectedCountry() {
        return this.countrySelectedSubject.asObservable();
    }

    clearSelection() {
        this.clearSelectionSubject.next();
    }

    onClearSelection() {
        return this.clearSelectionSubject.asObservable();
    }
}