import { Component, ComponentFactoryResolver, OnInit, ViewChild } from '@angular/core';
import { forkJoin, Subscription } from 'rxjs';
import { AuthService, SpotifyHttpClientService, SpotifyPlaylistTrackObject, SpotifySimplifiedPlaylistObject, SpotifyTrackObject } from 'spotify-lib';
import { ContextMenuComponent, MenuDisplayer } from 'src/app/shared/components/context-menu/context-menu.component';
import { ContextMenuDirective } from 'src/app/shared/components/context-menu/context-menu.directive';
import { CountryDataService } from 'src/app/shared/country-data.service';
import { CountrySelectionService } from 'src/app/shared/country-selection.service';
import { CountryChart } from 'src/app/shared/types';


interface DisplayChartTitle {
  showState: boolean;

  following: 'yes' | 'no' | 'unknown';
}

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
  displayChartTitle: DisplayChartTitle = {showState: false, following: 'unknown'};

  currentlyPlayingTrackIndex: number = -1;

  selectedCountrySubscription: Subscription | undefined = undefined;

  countryChart: CountryChart | undefined;

  // context-menu
  showMenu = false;
  currentUserId: string | undefined; //TODO get this once (maybe in a service at the beginning!!)
  playlistsOfCurrentUser: SpotifySimplifiedPlaylistObject[] = [];

  @ViewChild(ContextMenuDirective, {static: true}) contextMenuHost: ContextMenuDirective | undefined;

  constructor(
    private countrySelectionService: CountrySelectionService,
    private countryDataService: CountryDataService,
    private componentFactoryResolver: ComponentFactoryResolver,
    private spotifyService: SpotifyHttpClientService,
    private authService: AuthService) {

      //TODO we should know user id at this point!!

      this.countrySelectionService.getSelectedCountry().subscribe( country => {
        this.countryChart = this.countryDataService.getChartDataForCountry(country);
      
        if (this.countryChart) {
          this.show = true;
          this.chartName = this.countryChart.name;
          this.displayChartTitle.following = 'unknown';

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

      // get playlists that current user owns
      // TODO cleanup subscription?? (check others too!)
      forkJoin({
        userId: this.spotifyService.getUserId({ accessToken: this.authService.getAccessToken() }),
        userPlaylists: this.spotifyService.getPlaylistsOfCurrentUser({ accessToken: this.authService.getAccessToken() })
      })
      .subscribe( 
        response => {
          let userId = response.userId.id;
          let playlists = response.userPlaylists.items as SpotifySimplifiedPlaylistObject[];

          for (let p of playlists) {
            if (p.owner.id === userId) {
              this.playlistsOfCurrentUser.push(p);
            }
          }
        },
        err => {
          console.log(err);
        });
  }

  ngOnInit(): void {
  }

  onChartTitleHoverEnter() {
    if (this.displayChartTitle.following === 'unknown' && this.countryChart) {
      this.spotifyService.getUserId({accessToken: this.authService.getAccessToken()}).subscribe(
        user => {
          this.spotifyService.areFollowingPlaylist({accessToken: this.authService.getAccessToken(), playlistId: this.countryChart!.id, userIds: [user.id]}).subscribe(
            response => {
              if (response[0] === true) {
                this.displayChartTitle.following = 'yes'
              } else {
                this.displayChartTitle.following = 'no';
              }
              this.displayChartTitle.showState = true;
            },
            err => {
              console.log("Failed to retrieve follow state!");
              console.log(err);
            }
          )
        },
        err => {
          console.log("Failed to retrieve user id!");
          console.log(err);
        });
    } else {
      this.displayChartTitle.showState = true;
    }
  }

  onChartTitleHoverLeave() {
    this.displayChartTitle.showState = false;
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

  togglePlay(index: number, e: MouseEvent) {
    e.stopPropagation();

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

  openChartMoreMenu(e: MouseEvent) {
    e.stopPropagation();

    this.showMenu = true;

    if (this.showMenu) {
      this.prepareChartMenu(e.pageY + 20, e.pageX);
    }
  }

  openTrackMoreMenu(index: number, e: MouseEvent) {
    e.stopPropagation();

    this.showMenu = true;

    if (this.showMenu) {
      this.prepareTrackMenu(index, e.pageY + 20, e.pageX);
    }
  }

  private prepareChartMenu(posTop: number, posLeft: number) {
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(ContextMenuComponent);

    if (!this.contextMenuHost) {
      console.log('cant find placeholder');
      return;
    }

    const viewContainerRef = this.contextMenuHost.viewContainerRef;
    viewContainerRef.clear();

    const componentRef = viewContainerRef?.createComponent<MenuDisplayer>(componentFactory);

    if (!componentRef) {
      return;
    }

    const items = [];
    
    if (this.displayChartTitle.following === 'no') {
      items.push({
        text: 'Follow', 
        action: () => {
          this.spotifyService.followPlaylist({accessToken: this.authService.getAccessToken(), playlistId: this.countryChart!.id}).subscribe(
            () => {
              this.displayChartTitle.following = 'yes';
            },
            err => {
              this.displayChartTitle.following = 'unknown';
              console.log("Failed to follow!")
              console.log(err);
            }
          );

          // close menu
          this.showMenu = false;
        }
      });
    } else if (this.displayChartTitle.following === 'yes') {
      items.push({
        text: 'Unfollow', 
        action: () => {
          this.spotifyService.unfollowPlaylist({accessToken: this.authService.getAccessToken(), playlistId: this.countryChart!.id}).subscribe(
            () => {
              this.displayChartTitle.following = 'no';
            },
            err => {
              this.displayChartTitle.following = 'unknown';
              console.log("Failed to unfollow!")
              console.log(err);
            }
          );

          // close menu
          this.showMenu = false;
        }
      });
    } else {
      items.push({
        text: 'Nothing here...', 
        action: () => {
        }
      });
    }


    componentRef.instance.menu.items = items;
    componentRef.instance.menu.children = [];

    componentRef.instance.menu.show = true;
    componentRef.instance.menu.top = posTop;
    componentRef.instance.menu.left = posLeft;
  }

  //TODO do this once and then swap? might need another child to hold everything
  private prepareTrackMenu(trackIndex: number, posTop: number, posLeft: number) {

    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(ContextMenuComponent);

    if (!this.contextMenuHost) {
      console.log('cant find placeholder');
      return;
    }

    const viewContainerRef = this.contextMenuHost.viewContainerRef;
    viewContainerRef.clear();

    const componentRef = viewContainerRef?.createComponent<MenuDisplayer>(componentFactory);

    if (!componentRef) {
      return;
    }

    const items = [];
    const children = [];

    items.push({
      text: 'Save to your Liked Songs', 
      action: () => {
        console.log("Saved to your Liked Songs");
      }
    });

    items.push({
      text: 'Add to Playlist ...',
      submenuIndex: 0
    });

    const playlistMenuItems = [];

    for (let p of this.playlistsOfCurrentUser) {
      playlistMenuItems.push({
        text: p.name,
        action: () => {
          //console.log(p.name);
          const trackId = (this.countryChart?.tracks.items[trackIndex] as SpotifyPlaylistTrackObject).track.id;

          //TODO duplicates?
          this.spotifyService.addTracksToPlaylist({
            accessToken: this.authService.getAccessToken(),
            playlistId: p.id,
            trackIds: [trackId]
          }).subscribe(
            () => {
              console.log("Track added to " + p.name);
            },
            err => {
              console.log("Failed to add track to " + p.name + " : ");
              console.log(err);
            }
          );

          // close menu
          this.showMenu = false;
        }
      });
    }

    const addToPlaylistMenu = {
      show: false,
      top: 25,
      left: -200,
      items: playlistMenuItems,
      children: []
    }

    children.push(addToPlaylistMenu);

    componentRef.instance.menu.items = items;
    componentRef.instance.menu.children = children;

    componentRef.instance.menu.show = true;
    componentRef.instance.menu.top = posTop;
    componentRef.instance.menu.left = posLeft;
  }

  closeMoreMenu(e: MouseEvent) {
    e.stopPropagation();

    this.showMenu = false;
  }

  onLeaveView() {
    this.show = false;
    this.countrySelectionService.clearSelection();
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
