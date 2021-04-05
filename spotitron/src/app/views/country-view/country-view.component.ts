import { Component, ComponentFactoryResolver, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { SpotifyPlaylistTrackObject, SpotifyTrackObject } from 'spotify-lib';
import { ContextMenuComponent, Menu, MenuDisplayer } from 'src/app/shared/components/context-menu/context-menu.component';
import { ContextMenuDirective } from 'src/app/shared/components/context-menu/context-menu.directive';
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

  countryChart: CountryChart | undefined;

  // more-menu
  showMenu = false;
  menuType: 'track' | 'chart' | undefined = undefined;

  @ViewChild(ContextMenuDirective, {static: true}) contextMenuHost: ContextMenuDirective | undefined;

  constructor(
    private countrySelectionService: CountrySelectionService,
    private countryDataService: CountryDataService,
    private componentFactoryResolver: ComponentFactoryResolver) {
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

  toggleTrackMoreMenu(index: number, e: MouseEvent) {
    this.showMenu = !this.showMenu;

    if (this.showMenu) {
      this.prepareMoreMenu('track', e.pageY + 20, e.pageX);
    }
  }

  //TODO do this once and then swap? might need another child to hold everything
  private prepareMoreMenu(type: 'track' | 'chart', posTop: number, posLeft: number) {
    //if (this.menuType === type) {
    //  return;
    //}

    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(ContextMenuComponent);

    if (!this.contextMenuHost) {
      console.log('cant find placeholder');
      return;
    }

    const viewContainerRef = this.contextMenuHost.viewContainerRef;
    viewContainerRef.clear();

    const componentRef = viewContainerRef?.createComponent<MenuDisplayer>(componentFactory);

    if (componentRef) {
      const items = [];
      const children = [];

      if (type === 'track') {
        items.push({
          id: 0, 
          text: 'Save to your Liked Songs', 
          action: () => {
            console.log("Saved to your Liked Songs");
          }
        });
        items.push({
          id: 1, 
          text: 'Add to Playlist ...',
          submenuIndex: 0
        });

        const test1 = 'test1';
        const test2 = 'test2';
        const addToPlaylistMenu = {
          show: false,
          top: 25,
          left: -200,
          items: [
            {
              id: 2,
              text: test1,
              action: () => {
                console.log(test1);
              }
            },
            {
              id: 3,
              text: test2,
              action: () => {
                console.log(test2);
              }
            },
          ],
          children: []
        }

        children.push(addToPlaylistMenu);
      } else {
        //items.push('Save to Your Library');
      }

      componentRef.instance.menu.items = items;
      componentRef.instance.menu.children = children;

      componentRef.instance.menu.show = true;
      componentRef.instance.menu.top = posTop;
      componentRef.instance.menu.left = posLeft;
    }


    this.menuType = type;
  }

  closeMoreMenu() {
    this.showMenu = false;
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
