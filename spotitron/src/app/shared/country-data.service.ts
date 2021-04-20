import { Injectable } from "@angular/core";
import { AuthService, SpotifyHttpClientService, SpotifyPlaylistTrackObject } from "spotify-lib";

import countryGeometryData from '../../assets/countries/data.json'
import { CountryChart } from "./types";

import { catchError, map } from 'rxjs/operators'
import { forkJoin, of, Subject } from 'rxjs';
import { extractChart } from "./spotify-lib-util";





@Injectable({providedIn: 'root'})
export class CountryDataService {
    public readonly geometryData: any = undefined;

    private chartDataReady: boolean = false;

    private chartData: Map<string, CountryChart> = new Map();

    private chartDataProgressSubject: Subject<number> = new Subject();
    private chartDataReadySubject: Subject<void> = new Subject();

    public readonly countryNames: string[];

    private readonly storageKeyForChartData: string = 'STRON_charts';
    private readonly storageKeyForChartDataTimestamp: string = "STRON_chartsTimestamp"

    private readonly storageExpireAfterMS = 24 * 3600 * 1000; // 24h 
    
    //TODO adjust if needed
    private readonly parallelRequests = 7;
    private readonly requestWaitIntervalMs = 25;

    constructor(private spotifyService: SpotifyHttpClientService,
      private authService: AuthService) {
      
        this.geometryData = countryGeometryData;

        if (this.fetchChartDataFromStorage()) {
          this.chartDataReady = true;
          this.countryNames = Array.from(this.chartData.keys());
        } else {
          this.chartDataReady = false;

          this.countryNames = [];
        
          for (let country in this.geometryData) {
              this.countryNames.push(country);
          }
        }
    }

    public clearStorage() {
      localStorage.removeItem(this.storageKeyForChartData);
    }

    public isChartDataReady() {
      return this.chartDataReady;
    }

    public fetchChartData() {
      if (!this.chartDataReady) {
        // fetch from server
        this.fetchNextCountry(0, this.countryNames.length);
      } else {
        this.chartDataReadySubject.next();
      }
    }

    private fetchNextCountry(at: number, stop: number) {
        if (at >= stop) {
          this.setChartDataReady();
          return;
        }

        this.chartDataProgress( at * 100 / stop);
    
        const requests = [];
    
        let step = stop - at;
    
        if (step > this.parallelRequests) {
          step = this.parallelRequests;
        }
    
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
                this.chartData.set(chart.country, extractChart(chart));
              }
            }
          }
      
          window.setTimeout(() => {
            this.fetchNextCountry(at + step, stop);  
          }, this.requestWaitIntervalMs);
        },
        err => {
          //TODO error handling
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

    private setChartDataReady() {
      this.chartDataReady = true;

      // store
      this.storeChartData();

      // notify
      this.chartDataReadySubject.next();
    }

    private fetchChartDataFromStorage() : boolean {
      const chartDataTimestampAsStr = localStorage.getItem(this.storageKeyForChartDataTimestamp);

      if (!chartDataTimestampAsStr) {
        return false;
      }

      const chartDataTimestamp = new Date(Date.parse(chartDataTimestampAsStr));
      const now = new Date();

      // check if data is still valid
      const elapsed = now.getTime() - chartDataTimestamp.getTime();
      
      if (elapsed > this.storageExpireAfterMS) {
        return false;
      }

      const chartDataAsStr = localStorage.getItem(this.storageKeyForChartData);

      if (!chartDataAsStr) {
        return false;
      }

      this.chartData = new Map(JSON.parse(chartDataAsStr));

      return true;
    }

    private storeChartData() {
      try {
        const storedData = JSON.stringify([...this.chartData]);
        //TODO additional compression with lz-string?
        localStorage.setItem(this.storageKeyForChartData, storedData);

        const storedTimestamp = (new Date()).toString();
        localStorage.setItem(this.storageKeyForChartDataTimestamp, storedTimestamp);
      } catch (e) {
        // do nothing
      }
    }
}