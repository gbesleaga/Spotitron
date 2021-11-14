import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";

@Injectable({ providedIn: 'root' })
export class CountrySelectionService {
  private countryHoveredSubject: Subject<string> = new Subject();
  private countrySelectedSubject: Subject<string> = new Subject();
  private clearSelectionSubject: Subject<void> = new Subject();


  hoverCountry(country: string): void {
    this.countryHoveredSubject.next(country);
  }


  selectCountry(country: string): void {
    this.countryHoveredSubject.next("");
    this.countrySelectedSubject.next(country);
  }


  getHoveredCountry(): Observable<string> {
    return this.countryHoveredSubject.asObservable();
  }


  getSelectedCountry(): Observable<string> {
    return this.countrySelectedSubject.asObservable();
  }


  clearSelection(): void {
    this.clearSelectionSubject.next();
  }


  onClearSelection(): Observable<void> {
    return this.clearSelectionSubject.asObservable();
  }
}