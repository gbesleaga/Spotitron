import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { SpotifyPlaylistTrackObject, SpotifyTrackObject } from 'spotify-lib';
import { CountryDataService } from 'src/app/shared/country-data.service';
import { CountrySelectionService } from 'src/app/shared/country-selection.service';
import { CountryChart } from 'src/app/shared/types';


interface DisplayTrack {
  name: string;
  artist: string;

  audio: HTMLAudioElement | undefined;
  
  stateDisplay: string;
  showState: boolean;

  playing: boolean;
}


@Component({
  selector: 'app-country-view',
  templateUrl: './country-view.component.html',
  styleUrls: ['./country-view.component.css']
})
export class CountryViewComponent implements OnInit {

  show: boolean = false;
  chartName: string = "";
  displayTracks: DisplayTrack[] = [];

  currentlyPlayingTrackIndex: number = -1;

  selectedCountrySubscription: Subscription | undefined = undefined;

  private countryChart: CountryChart | undefined;

  constructor(
    private countrySelectionService: CountrySelectionService,
    private countryDataService: CountryDataService) {
      this.countrySelectionService.getSelectedCountry().subscribe( country => {
      
      this.countryChart = this.countryDataService.getChartDataForCountry(country);
      
      if (this.countryChart) {
        this.show = true;
        this.chartName = this.countryChart.name;

        this.displayTracks = [];
        const tracks: SpotifyPlaylistTrackObject[] = this.countryChart.tracks.items as SpotifyPlaylistTrackObject[];

        for (let t of tracks) {
          const dt = {
            name: this.getDisplayTrackName(t.track),
            artist: this.getDisplayTrackArtist(t.track),
            audio: this.getDisplayTrackAudio(t.track),
            playing: false,
            stateDisplay: 'play',
            showState: false,
          }

          this.displayTracks.push(dt);
        }

      } else {
        this.onLeaveView();
      }

    });
  }

  ngOnInit(): void {
  }

  onDisplayTrackHoverEnter(index: number) {
    if (this.displayTracks[index].playing) {
      this.displayTracks[index].stateDisplay = 'pause';
    }

    this.displayTracks[index].showState = true;
  }

  onDisplayTrackHoverLeave(index: number) {
    if (this.displayTracks[index].playing) {
      this.displayTracks[index].stateDisplay = 'playing';
    } else {
      this.displayTracks[index].showState = false;
    }
  }

  togglePlay(index: number) {
    // what to do
    const play = !this.displayTracks[index].playing;

    if (this.currentlyPlayingTrackIndex === index) {
      if (play) {
        this.playTrack(index);
      } else {
        this.pauseTrack(index);
      }
    } else {
      this.pauseActiveTrack();

      if (play) {
        this.playTrack(index);
      } else {
        this.pauseTrack(index);
      }
    }
  }

  private pauseActiveTrack() {
    if (this.currentlyPlayingTrackIndex >= 0) {
      this.displayTracks[this.currentlyPlayingTrackIndex].showState = false;
      this.pauseTrack(this.currentlyPlayingTrackIndex);
    }
  }

  private playTrack(index: number) {
    const track = this.displayTracks[index];

    track.playing = true;
    track.stateDisplay = 'pause';
    track.audio?.play();

    this.currentlyPlayingTrackIndex = index;
  }

  private pauseTrack(index: number) {
    const track = this.displayTracks[index];

    track.playing = false;
    track.stateDisplay = 'play';
    track.audio?.pause();

    this.currentlyPlayingTrackIndex = -1;
  }


  onLeaveView() {
    //this.show = false;
    //this.countrySelectionService.clearSelection();
  }

  private getDisplayTrackName(track: SpotifyTrackObject) {
    return track.name;
  }

  private getDisplayTrackArtist(track: SpotifyTrackObject) {
    let artistConcat = '';

    if (track.artists.length === 0) {
      return artistConcat;
    }
    
    for (let i = 0; i < track.artists.length - 1; ++i) {
      artistConcat += track.artists[i].name + ', ';
    }

    artistConcat += track.artists[track.artists.length - 1].name;

    return artistConcat;
  }

  private getDisplayTrackAudio(track: SpotifyTrackObject) {
    if(track.preview_url) {
      const audio = new Audio(track.preview_url);
      audio.loop = true;
      return audio;
    }

    return undefined;
  }
}
