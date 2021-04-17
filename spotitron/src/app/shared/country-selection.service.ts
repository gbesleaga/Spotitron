import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

@Injectable({providedIn: 'root'})
export class CountrySelectionService {
    private countryHoveredSubject: Subject<string> =  new Subject();
    private countrySelectedSubject: Subject<string> = new Subject();
    private clearSelectionSubject: Subject<void> = new Subject(); 


    hoverCountry(country: string) {
        this.countryHoveredSubject.next(country);
    }

    selectCountry(country: string) {
        this.countryHoveredSubject.next("");
        this.countrySelectedSubject.next(country);
    }

    getHoveredCountry() {
        return this.countryHoveredSubject.asObservable();
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