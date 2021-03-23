import { AfterViewInit } from '@angular/core';
import { Component } from '@angular/core';
import { AuthService, SpotifyHttpClientService, SpotifyPlaylistTrackObject } from 'spotify-lib';
import { AnimationService } from 'src/app/rendering/animation.service';
import { RenderingService } from 'src/app/rendering/rendering.service';

@Component({
  selector: 'app-main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.css']
})
export class MainViewComponent implements AfterViewInit {

  constructor(private renderingService: RenderingService,
    private animationService: AnimationService,
    private authService: AuthService,
    private spotifyService: SpotifyHttpClientService ) { }

  ngAfterViewInit(){
    this.spotifyService.getCountryChart({accessToken: this.authService.getAccessToken(), countryName: 'Costa Rica' }).subscribe( chart => {
      const playlistItems = chart.tracks.items as SpotifyPlaylistTrackObject[];

      for (let item of playlistItems) {
        console.log(item.track.name);
      }

    });
    
    this.renderingService.init();
    this.animationService.animate();
  }
}
