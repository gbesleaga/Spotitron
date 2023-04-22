import { Injectable } from "@angular/core";
import { AuthService, SpotifyHttpClientService, SpotifyPlaylistTrackObject } from "spotify-lib";

import countryGeometryData from '../../assets/countries/data.json'
import { CountryChart } from "./types";

import { catchError, map, take } from 'rxjs/operators'
import { interval, Observable, of, Subject, Subscription } from 'rxjs';
import { extractChart } from "./spotify-lib-util";


@Injectable({ providedIn: 'root' })
export class CountryDataService {
  public readonly geometryData: any = undefined;

  private chartDataReady: boolean = false;

  private chartData: Map<string, CountryChart> = new Map();

  private chartDataProgressSubject: Subject<number> = new Subject();
  private chartDataReadySubject: Subject<void> = new Subject();
  private chartDataLazyFetchSubject: Subject<string> = new Subject();

  private readonly storageKeyForChartData: string = 'STRON_charts';
  private readonly storageKeyForChartDataTimestamp: string = "STRON_chartsTimestamp"

  private readonly storageExpireAfterMS = 24 * 3600 * 1000; // 24h 

  // avoid rate limiting
  private readonly fastRequestIntervalMS = 50;
  private readonly slowRequestIntervalMS = 200;

  private chartDataRequesterSub: Subscription | undefined = undefined;

  private isStorageDirty = false;

  constructor(private spotifyService: SpotifyHttpClientService,
    private authService: AuthService) {

    this.geometryData = countryGeometryData;
    
    // fetch what we have in storage
    this.fetchChartDataFromStorage();
    
    this.chartDataReady = false;
  }


  public clearStorage(): void {
    localStorage.removeItem(this.storageKeyForChartData);
  }

  public cancelChartDataRetrieval(): void {
    if (this.chartDataRequesterSub) {
      this.chartDataRequesterSub.unsubscribe();
      this.chartDataRequesterSub = undefined;
    }
  }


  public isChartDataReady(): boolean {
    return this.chartDataReady;
  }


  public fetchChartData(): void {
    if (!this.chartDataReady) {
      // fetch from server
      // we will first fetch countries that are known to have chart data
      // sending requests very fast
      // when this is done we are ready (we don't care about individual requests)

      let prioCountries: string[] = [];
      for (const country of SPOTIFY_COUNTRIES) {
        if (!this.chartData.has(country)) {
          // need to fetch
          prioCountries.push(country);
        }
      }

      this.fetchCountries(
        prioCountries, 
        this.fastRequestIntervalMS, 
        this.chartDataProgress.bind(this),
        undefined, 
        this.setChartDataReady.bind(this)
      );
    } else {
      this.chartDataReadySubject.next();
    }
  }


  private fetchCountries(
    countryNames: string[], 
    intervalBetweenRequestsMs: number, 
    onProgress?: (completionPercentage: number) => void,
    onSuccessfulRequest?: (countryName: string) => void,
    onDone?: () => void): void {

    const stop = countryNames.length;

    if (stop === 0 && onDone) {
      onDone();
    }

    let at = 0;

    const source = interval(intervalBetweenRequestsMs);

    this.cancelChartDataRetrieval();
    
    this.chartDataRequesterSub = source.pipe(take(stop)).subscribe( i => {
      // setup request
      const request = this.spotifyService.getCountryChart({ accessToken: this.authService.getAccessToken(), countryName: countryNames[i] })
        .pipe(
          catchError(error => of(error)), // ignore errors
          map(chart => ({ ...chart, country: countryNames[i] }))
        );

      // make request
      request.subscribe(
        chart => {
          // check if we have retrieved data
          if (chart && chart.tracks) {
            const playlistItems = chart.tracks.items as SpotifyPlaylistTrackObject[];

            if (playlistItems) {
              this.isStorageDirty = true;
              
              const dataFromChart = extractChart(chart);
              if (dataFromChart) {
                this.chartData.set(chart.country, dataFromChart);
              }

              if (onSuccessfulRequest) {
                onSuccessfulRequest(chart.country);
              }
            }
          }

          // update progress
          at += 1;
          if (onProgress) {
            onProgress(at * 100 / stop);
          }


          if (at == stop && onDone) {
            onDone();
          }
        }
      );
    });
  }


  public onChartDataProgress(): Observable<number> {
    return this.chartDataProgressSubject.asObservable();
  }


  public onChartDataReady(): Observable<void> {
    return this.chartDataReadySubject.asObservable();
  }


  public onChartDataLazyFetch(): Observable<string> {
    return this.chartDataLazyFetchSubject.asObservable();
  }


  public getChartData(): Map<string, CountryChart>  {
    return this.chartData;
  }


  public getChartDataForCountry(country: string): CountryChart | undefined {
    return this.chartData.get(country);
  }


  private chartDataProgress(completionPercentage: number): void {
    this.chartDataProgressSubject.next(completionPercentage);
  }


  private setChartDataReady(): void {
    this.chartDataReady = true;

    // store
    this.storeChartData();

    // we will then fetch the remaining countries in the background
    // using a much slower request rate
    // and send notifications for new additions
    // when we are done, we update the chart data in storage if needed
    // we do not care about completion percentage

    let remainingCountries: string[] = [];
    for (let country in this.geometryData) {
      if (!this.chartData.has(country)) {
        remainingCountries.push(country);
      }
    }

    this.fetchCountries(
      remainingCountries, 
      this.slowRequestIntervalMS,
      undefined,  
      this.newCountryChartFetched.bind(this), 
      this.allCountryChartDataFetched.bind(this)
    );

    // notify
    this.chartDataReadySubject.next();
  }


  private newCountryChartFetched(countryName: string): void {
    this.chartDataLazyFetchSubject.next(countryName);
  }


  private allCountryChartDataFetched(): void {
    this.storeChartData();
  }


  private fetchChartDataFromStorage(): boolean {
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


  private storeChartData(): void {
    if (!this.isStorageDirty) {
      return;
    }

    try {
      const storedData = JSON.stringify([...this.chartData]);
      //TODO additional compression with lz-string?
      localStorage.setItem(this.storageKeyForChartData, storedData);

      const storedTimestamp = (new Date()).toString();
      localStorage.setItem(this.storageKeyForChartDataTimestamp, storedTimestamp);

      this.isStorageDirty = false;
    } catch (e) {
      // do nothing
    }
  }
}



/** these countries are known to have spotify chart data */
const SPOTIFY_COUNTRIES = [
"Andorra",
"Argentina",
"Australia",
"Austria",
"Belgium",
"Bolivia",
"Bulgaria",
"Brazil",
"Canada",
"Chile",
"Taiwan",
"Colombia",
"Costa Rica",
"Cyprus",
"Czech Republic",
"Dominica",
"Denmark",
"Ecuador",
"Dominican Republic",
"El Salvador",
"Estonia",
"Finland",
"France",
"Germany",
"Greece",
"Guatemala",
"Honduras",
"Hong Kong",
"Hungary",
"Iceland",
"India",
"Indonesia",
"Israel",
"Ireland",
"Italy",
"Japan",
"South Korea",
"Latvia",
"Lithuania",
"Luxembourg",
"Malaysia",
"Mexico",
"Morocco",
"Netherlands",
"New Zealand",
"Nicaragua",
"Norway",
"Panama",
"Peru",
"Paraguay",
"Philippines",
"Poland",
"Portugal",
"Romania",
"Russia",
"Saudi Arabia",
"Singapore",
"Vietnam",
"Slovakia",
"South Africa",
"Spain",
"Sweden",
"Switzerland",
"Thailand",
"Turkey",
"Ukraine",
"Egypt",
"United Kingdom",
"United States",
"Uruguay"
]