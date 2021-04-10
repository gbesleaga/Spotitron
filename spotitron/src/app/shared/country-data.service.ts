import { Injectable } from "@angular/core";
import { AuthService, SpotifyHttpClientService, SpotifyPlaylistTrackObject } from "spotify-lib";

import countryGeometryData from '../../assets/countries/data.json'
import { CountryChart } from "./types";

import { catchError, map } from 'rxjs/operators'
import { forkJoin, of, Subject } from 'rxjs';

@Injectable({providedIn: 'root'})
export class CountryDataService {
    
    public readonly geometryData: any = undefined;

    private chartData: Map<string, CountryChart> = new Map();

    private chartDataProgressSubject: Subject<number> = new Subject();
    private chartDataReadySubject: Subject<void> = new Subject();

    public readonly countryNames: string[];

    constructor(private spotifyService: SpotifyHttpClientService,
        private authService: AuthService) {
        this.geometryData = countryGeometryData;

        this.countryNames = [];
        
        for (let country in this.geometryData) {
            this.countryNames.push(country);
        }
    }

    public fetchChartData() {
        //TODO get all
        this.fetchNextCountry(0, this.countryNames.length);
    }

    private fetchNextCountry(at: number, stop: number) {
        if (at >= stop) {
          this.chartDataReady();
          return;
        }

        this.chartDataProgress( at * 100 / stop);
    
        const requests = [];
    
        let step = stop - at;
    
        //TODO figure out how many requests we can send before we get timed-out; 30?
        if (step > 10) step = 10;
    
        for (let i = at; i < at + step; ++i) {
          const request =  this.spotifyService.getCountryChart({accessToken: this.authService.getAccessToken(), countryName: this.countryNames[i] }).pipe(catchError(error => of(error)), map(chart => ({...chart, country: this.countryNames[i]})));
          requests.push(request);
        }
    
       forkJoin(requests).subscribe( 
        responseList => {
          for (let chart of responseList) {
            if (chart && chart.tracks) {
              const playlistItems = chart.tracks.items as SpotifyPlaylistTrackObject[];
    
              if (playlistItems) {
                this.chartData.set(chart.country, chart);
              }
            }
          }
          this.fetchNextCountry(at + step, stop);
        },
        err => {
          console.log("An error occured: " + err);
        });
    }

    public onChartDataProgress() {
      return this.chartDataProgressSubject.asObservable();
    }

    public onChartDataReady() {
      return this.chartDataReadySubject.asObservable();
    }

    public getChartData() {
      return this.chartData;
    }

    public getChartDataForCountry(country: string): CountryChart | undefined {
      return this.chartData.get(country);
    }

    private chartDataProgress(completionPercentage: number) {
      this.chartDataProgressSubject.next(completionPercentage);
    }

    private chartDataReady() {
      for (let chart of this.chartData) {
        //const playlistItems = chart.tracks.items as SpotifyPlaylistTrackObject[];
        //console.log(chart.country + " : " + playlistItems[0].track.name);
        
        //console.log(chart);
      }

      this.chartDataReadySubject.next();
    }
}