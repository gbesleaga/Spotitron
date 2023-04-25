import { ChangeDetectorRef, Component, ComponentFactoryResolver, ViewChild } from '@angular/core';
import { NotificationsService, NotificationType } from 'notifications-lib';
import { Subscription } from 'rxjs';
import { AuthService, SpotifyHttpClientService, SpotifyPlaylistTrackObject, SpotifySimplifiedPlaylistObject, SpotifyTrackObject } from 'spotify-lib';
import { ContextMenuComponent, MenuDisplayer } from 'src/app/shared/components/context-menu/context-menu.component';
import { ContextMenuDirective } from 'src/app/shared/components/context-menu/context-menu.directive';
import { CountryDataService } from 'src/app/shared/country-data.service';
import { CountrySelectionService } from 'src/app/shared/country-selection.service';
import { MobileService } from 'src/app/shared/mobile.service';
import { SpotifyUserService } from 'src/app/shared/spotify-user.service';
import { CountryChart } from 'src/app/shared/types';


interface DisplayChartTitle {
  showState: boolean;

  following: 'yes' | 'no' | 'unknown';
  followingText: '❤' | '';
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
export class CountryViewComponent {

  show: boolean = false;
  chartName: string = "";
  displayTracks: DisplayTrack[] = [];
  displayChartTitle: DisplayChartTitle = { showState: false, following: 'unknown', followingText: '' };

  currentlyPlayingTrackIndex: number = -1;

  selectedCountrySubscription: Subscription | undefined = undefined;

  countryChart: CountryChart | undefined;

  // context-menu
  showMenu = false;
  playlistsOfCurrentUser: SpotifySimplifiedPlaylistObject[] = [];

  // mobile
  private previouslySelectedTrackIndex: number = -1;

  @ViewChild(ContextMenuDirective, { static: true }) contextMenuHost: ContextMenuDirective | undefined;


  constructor(
    private countrySelectionService: CountrySelectionService,
    private countryDataService: CountryDataService,
    private componentFactoryResolver: ComponentFactoryResolver,
    private spotifyService: SpotifyHttpClientService,
    private authService: AuthService,
    private spotifyUserService: SpotifyUserService,
    private notificationService: NotificationsService,
    private mobileService: MobileService,
    private changeDetector: ChangeDetectorRef) {

    
    this.displayChartTitle.showState = true; // always visible on mobile

    this.playlistsOfCurrentUser = this.spotifyUserService.getUserOwnedPlaylists();

    this.countrySelectionService.getSelectedCountry().subscribe(country => {
      this.countryChart = this.countryDataService.getChartDataForCountry(country);

      if (this.countryChart) {
        this.show = true;
        this.chartName = this.countryChart.name;
        this.displayChartTitle.following = 'unknown';
        this.displayChartTitle.followingText = '';

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

        // get following state
        this.fetchChartFollowingState();

      } else {
        this.onLeaveView();
      }

      this.changeDetector.detectChanges();
    });
  }


  private fetchChartFollowingState(): void {
    this.spotifyService.areFollowingPlaylist({
      accessToken: this.authService.getAccessToken(),
      playlistId: this.countryChart!.id,
      userIds: [this.spotifyUserService.getUserId()]
    }).subscribe(
      response => {
        if (response[0] === true) {
          this.displayChartTitle.following = 'yes'
          this.displayChartTitle.followingText = '❤';
        } else {
          this.displayChartTitle.following = 'no';
          this.displayChartTitle.followingText = '';
        }
      },
      err => {
        console.log("Failed to retrieve follow state.");
      }
    );
  }


  onDisplayTrackHoverEnter(index: number): void {
    if (this.mobileService.isOnMobile()) {
      // no-op on mobile
      return;
    }

    if (this.displayTracks[index].playing) {
      this.displayTracks[index].stateDisplay = 'pause';
    }

    this.displayTracks[index].showState = true;
  }


  onDisplayTrackHoverLeave(index: number): void {
    if (this.mobileService.isOnMobile()) {
      // no-op on mobile
      return; 
    }

    if (this.displayTracks[index].playing) {
      this.displayTracks[index].stateDisplay = 'playing';
    } else {
      this.displayTracks[index].showState = false;
    }
  }


  onDisplayTrackClicked(index: number): void {
    if (!this.mobileService.isOnMobile()) {
      // no-op on desktop
      return; 
    }

    // disable previous
    this.onDisplayTrackBlur(this.previouslySelectedTrackIndex);

    if (this.displayTracks[index].playing) {
      this.displayTracks[index].stateDisplay = 'pause';
    }

    this.displayTracks[index].showState = true;

    this.previouslySelectedTrackIndex = index;
  }


  onDisplayTrackBlur(index: number): void {
    if (index < 0) {
      return;
    }

    if (this.displayTracks[index].playing) {
      this.displayTracks[index].stateDisplay = 'playing';
    } else {
      this.displayTracks[index].showState = false;
    }
  }


  togglePlay(index: number, e: MouseEvent): void {
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


  private pauseActiveTrack(): void {
    if (this.currentlyPlayingTrackIndex >= 0) {
      this.displayTracks[this.currentlyPlayingTrackIndex].showState = false;
      this.pauseTrack(this.currentlyPlayingTrackIndex);
    }
  }


  private playTrack(index: number): void {
    const track = this.displayTracks[index];

    track.playing = true;
    track.stateDisplay = 'pause';
    track.audio?.play();

    this.currentlyPlayingTrackIndex = index;
  }


  private pauseTrack(index: number): void {
    const track = this.displayTracks[index];

    track.playing = false;
    track.stateDisplay = 'play';
    track.audio?.pause();

    this.currentlyPlayingTrackIndex = -1;
  }


  openChartMoreMenu(e: MouseEvent): void {
    e.stopPropagation();

    this.showMenu = true;

    if (this.showMenu) {
      this.prepareChartMenu(e.pageY + 10, e.pageX - 150 - 10);
    }
  }


  openTrackMoreMenu(index: number, e: MouseEvent): void {
    e.stopPropagation();

    this.showMenu = true;

    if (this.showMenu) {
      // should always be enough space to the left
      const posLeft = e.pageX - 150 - 10;

      // pop bottom if enough space, otherwise pop top
      const posTop = ((window.innerHeight - e.pageY - 20 - 50) > 0) ? e.pageY + 10 : e.pageY - 50;

      this.prepareTrackMenu(index, posTop, posLeft);
    }
  }


  private prepareChartMenu(posTop: number, posLeft: number): void {
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(ContextMenuComponent);

    if (!this.contextMenuHost) {
      console.log('Failed to create chart context menu.');
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
          this.spotifyService.followPlaylist({ accessToken: this.authService.getAccessToken(), playlistId: this.countryChart!.id }).subscribe(
            () => {
              this.displayChartTitle.following = 'yes';
              this.displayChartTitle.followingText = '❤';
            },
            err => {
              this.displayChartTitle.following = 'unknown';
              this.displayChartTitle.followingText = '';

              this.notificationService.notify({ type: NotificationType.ERROR, msg: 'Failed to follow chart.' });
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
          this.spotifyService.unfollowPlaylist({ accessToken: this.authService.getAccessToken(), playlistId: this.countryChart!.id }).subscribe(
            () => {
              this.displayChartTitle.following = 'no';
              this.displayChartTitle.followingText = '';
            },
            err => {
              this.displayChartTitle.following = 'unknown';
              this.displayChartTitle.followingText = '';
              this.notificationService.notify({ type: NotificationType.ERROR, msg: 'Failed to unfollow chart.' });
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


  private prepareTrackMenu(trackIndex: number, posTop: number, posLeft: number): void {

    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(ContextMenuComponent);

    if (!this.contextMenuHost) {
      console.log('Failed to create track context menu.');
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
      text: 'Add to Playlist ...',
      submenuIndex: 0
    });

    const playlistMenuItems = [];

    for (let p of this.playlistsOfCurrentUser) {
      playlistMenuItems.push({
        text: p.name.substr(0, 38),
        action: () => {
          const trackId = (this.countryChart?.tracks.items[trackIndex] as SpotifyPlaylistTrackObject).track.id;

          this.spotifyService.addTracksToPlaylist({
            accessToken: this.authService.getAccessToken(),
            playlistId: p.id,
            trackIds: [trackId]
          }).subscribe(
            () => {
              this.notificationService.notify({ type: NotificationType.INFO, msg: "Track added to " + p.name });
            },
            err => {
              this.notificationService.notify({ type: NotificationType.ERROR, msg: "Failed to add track to " + p.name });
            }
          );

          // close menu
          this.showMenu = false;
        }
      });
    }

    // where to place submenu
    let submenuTop = -1;

    if (posTop < (window.innerHeight / 2)) {
      submenuTop = 20;
    } else {
      submenuTop = -20 - playlistMenuItems.length * 40;
    }

    const submenuLeft = 0;

    const addToPlaylistMenu = {
      show: false,
      top: submenuTop,
      left: -150, //TODO this is hardcoded to menu width in css
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


  closeMoreMenu(e: MouseEvent): void {
    e.stopPropagation();

    this.showMenu = false;
  }


  onLeaveView(): void {
    this.show = false;
    this.countrySelectionService.clearSelection();
    this.pauseActiveTrack();

    // reset scroll
    const container = document.getElementById("tracks-container");
    if (container) {
      container.scrollTop = 0;
    }
  }


  private getDisplayTrackName(track: SpotifyTrackObject): string {
    return track.name;
  }


  private getDisplayTrackArtist(track: SpotifyTrackObject): string {
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


  private getDisplayTrackAudio(track: SpotifyTrackObject): HTMLAudioElement | undefined {
    if (track.preview_url) {
      const audio = new Audio(track.preview_url);
      audio.loop = true;
      return audio;
    }

    return undefined;
  }
}
