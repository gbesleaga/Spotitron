import { AfterViewInit } from '@angular/core';
import { Component } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { AuthService, SpotifyHttpClientService, SpotifyPlaylistTrackObject } from 'spotify-lib';
import { AnimationService } from 'src/app/rendering/animation.service';
import { RenderingService } from 'src/app/rendering/rendering.service';
import { CountryDataService } from 'src/app/shared/country-data.service';
import { catchError, map } from 'rxjs/operators'

@Component({
  selector: 'app-main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.css']
})
export class MainViewComponent implements AfterViewInit {

  private charts: any[] = [];

  constructor(
    private countryDataService: CountryDataService,
    private renderingService: RenderingService,
    private animationService: AnimationService,
    private authService: AuthService,
    private spotifyService: SpotifyHttpClientService ) { }

  ngAfterViewInit(){
    this.fetchNextCountry(0, this.countryDataService.countryNames.length);
  }

  private fetchNextCountry(at: number, stop: number) {
    if (at >= stop) {
      this.readyToRender();
      return;
    }

    const requests = [];

    let step = stop - at;

    if (step > 30) step = 30;

    for (let i = at; i < at + step; ++i) {
      const request =  this.spotifyService.getCountryChart({accessToken: this.authService.getAccessToken(), countryName: this.countryDataService.countryNames[i] }).pipe(catchError(error => of(error)), map(chart => ({...chart, country: this.countryDataService.countryNames[i]})));
      requests.push(request);
    }

   forkJoin(requests).subscribe( 
    responseList => {
      for (let chart of responseList) {
        if (chart && chart.tracks) {
          const playlistItems = chart.tracks.items as SpotifyPlaylistTrackObject[];

          if (playlistItems) {
            this.charts.push(chart);
          }
        }
      }
      this.fetchNextCountry(at + step, stop);
    },
    err => {
      console.log("An error occured: " + err);
    });
  }

  private readyToRender() {
    for (let chart of this.charts) {
      const playlistItems = chart.tracks.items as SpotifyPlaylistTrackObject[];
      console.log(chart.country + " : " + playlistItems[0].track.name);
    }

    this.renderingService.init();
    this.animationService.animate();
  }
}
