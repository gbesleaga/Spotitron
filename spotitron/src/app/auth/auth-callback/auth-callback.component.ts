import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationsService, NotificationType } from 'notifications-lib';
import { Subscription } from 'rxjs';
import { SpotifyHttpClientService, AuthService } from 'spotify-lib';
import { RenderingService, StarfieldState } from 'src/app/rendering/rendering.service';
import { CountryDataService } from 'src/app/shared/country-data.service';
import { SpotifyUserService } from 'src/app/shared/spotify-user.service';


@Component({
  selector: 'app-auth-callback',
  templateUrl: './auth-callback.component.html',
  styleUrls: ['./auth-callback.component.css']
})
export class AuthCallbackComponent implements OnInit, OnDestroy {

  public loadingProgress = 0;

  private userDataRdy = false;
  private chartDataRdy = false;

  private userDataReadySubscription: Subscription | undefined = undefined;

  private chartDataProgressSubscription: Subscription | undefined = undefined;
  private chartDataReadySubscription: Subscription | undefined = undefined;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private spotifyHttpClient: SpotifyHttpClientService,
    private authService: AuthService,
    private countryDataService: CountryDataService,
    private renderingService: RenderingService,
    private spotifyUSerService: SpotifyUserService,
    private notificationService: NotificationsService) { 
  }
  

  public ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.load();
      return;
    }
  
    const error: string = this.route.snapshot.queryParams.error;

    if (error) {
      this.notificationService.notify({type: NotificationType.ERROR, msg: 'Login failed. Reason: ' + error});
      this.router.navigate(['']);
      return;
    }
  
    const callbackCode: string = this.route.snapshot.queryParams.code;
    const state: string = this.route.snapshot.queryParams.state;

    if (!this.isCallbackCodeValid(callbackCode) ||
        !this.isStateValid(state)) {

          this.router.navigate(['']);
          return;
    }

    const code = this.authService.getCodeVerifier();
    if (!code) {
      this.notificationService.notify({type: NotificationType.ERROR, msg: 'Login failed. Reason: ' + 'Failed to retrieve code verifier.'});
      this.router.navigate(['']);
      return;
    }
  
    this.spotifyHttpClient.getAccessToken({
      clientId: this.authService.getClientId(), 
      codeVerifier: code, 
      code: callbackCode, 
      redirectURI: this.authService.getRedirectURI()})
        .subscribe(responseData => {
          const success = this.authService.authenticate(responseData);

          if (!success) {
            this.notificationService.notify({type: NotificationType.ERROR, msg: 'Login failed.'});
            this.router.navigate(['']);
          } else {
            this.load();
          }
        }, 
        err => {
          this.notificationService.notify({type: NotificationType.ERROR, msg: 'Failed to obtain authentication token.'});
          this.router.navigate(['']);
        });
  }

  
  public ngOnDestroy(): void {
    if (this.userDataReadySubscription) {
      this.userDataReadySubscription.unsubscribe();
    }

    if (this.chartDataProgressSubscription) {
      this.chartDataProgressSubscription.unsubscribe();
    }

    if (this.chartDataReadySubscription) {
      this.chartDataReadySubscription.unsubscribe();
    }
  }


  private load(): void {
    this.userDataRdy = this.spotifyUSerService.isReady();
    this.chartDataRdy = this.countryDataService.isChartDataReady();

    if (this.userDataRdy && this.chartDataRdy) {
      this.router.navigate(['view/main']);
      return;
    }

    if (!this.userDataRdy) {
      this.loadUserData();
    }

    if (!this.chartDataRdy) {
      this.loadCharts();
    }
  }


  private isCallbackCodeValid(callbackCode: string): boolean {
    if (callbackCode) {
      return true;
    }

    return false;
  }


  private isStateValid(state: string): boolean {
    if (state) {
      if (state === this.authService.getState()) {
        return true;
      }
    }

    return false;
  }


  private loadUserData(): void {
    this.userDataReadySubscription = this.spotifyUSerService.fetchData().subscribe( succ => {
      if (succ) {
        this.userDataRdy = true;
        this.onPartialLoad();
      } else {
        this.notificationService.notify({type: NotificationType.ERROR, msg: 'Failed to retrieve user data.'});
        this.router.navigate(['']);
      }
    });
  }


  private loadCharts(): void {
    this.renderingService.setStarfieldState(StarfieldState.Hyper);

    this.chartDataProgressSubscription = this.countryDataService.onChartDataProgress().subscribe( progress => {
      this.loadingProgress = progress;
    });

    this.chartDataReadySubscription = this.countryDataService.onChartDataReady().subscribe( () => {
      this.chartDataRdy = true;
      this.onPartialLoad();
    });

    this.countryDataService.fetchChartData();
  }


  private onPartialLoad(): void {
    if (this.userDataRdy && this.chartDataRdy) {
      this.router.navigate(['view/main']);
      return;
    }
  }
}
