import { ThrowStmt } from '@angular/compiler';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SpotifyHttpClientService, AuthService } from 'spotify-lib';
import { RenderingService, StarfieldState } from 'src/app/rendering/rendering.service';
import { CountryDataService } from 'src/app/shared/country-data.service';

@Component({
  selector: 'app-auth-callback',
  templateUrl: './auth-callback.component.html',
  styleUrls: ['./auth-callback.component.css']
})
export class AuthCallbackComponent implements OnInit, OnDestroy {

  loadingProgress = 0;

  private chartDataProgressSubscription: Subscription | undefined = undefined;
  private chartDataReadySubscription: Subscription | undefined = undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private spotifyHttpClient: SpotifyHttpClientService,
    private authService: AuthService,
    private countryDataService: CountryDataService,
    private renderingService: RenderingService,
    /*private notificationService: NotificationsService*/) { 
    }

    ngOnInit() {
      if (this.authService.isAuthenticated()) {
        if (this.countryDataService.isChartDataReady()) {
          this.router.navigate(['view/main']);
          return;
        } else {
          this.loadCharts();
          return;
        }
      }
  
      const error: string = this.route.snapshot.queryParams.error;
  
      if (error) {
        //this.notificationService.notify({type: NotificationType.ERROR, msg: 'Login failed. Reason: ' + error});
        console.log('Login failed. Reason: ' + error);
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
        console.log('Failed to retrieve code verifier.');
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
              //this.notificationService.notify({type: NotificationType.ERROR, msg: 'Login failed.'});
              console.log('Login failed.');
              this.router.navigate(['']);
            } else {
              this.loadCharts();
            }
          }, 
          err => {
            //this.notificationService.notify({type: NotificationType.ERROR, msg: 'Failed to obtain authentication token.'});
            console.log('Failed to obtain authentication token.');
            this.router.navigate(['']);
          });
    }
  
    private isCallbackCodeValid(callbackCode: string) {
      if (callbackCode) {
        return true;
      }
  
      return false;
    }
  
    private isStateValid(state: string) {
      if (state) {
        if (state === this.authService.getState()) {
          return true;
        }
      }
  
      return false;
    }

    private loadCharts() {
      this.renderingService.setStarfieldState(StarfieldState.Hyper);

      this.chartDataProgressSubscription = this.countryDataService.onChartDataProgress().subscribe( progress => {
        this.loadingProgress = progress;
      });

      this.chartDataReadySubscription = this.countryDataService.onChartDataReady().subscribe( () => {
        this.router.navigate(['view/main']);
      });

      this.countryDataService.fetchChartData();
    }

    ngOnDestroy() {
      if (this.chartDataProgressSubscription) {
        this.chartDataProgressSubscription.unsubscribe();
      }

      if (this.chartDataReadySubscription) {
        this.chartDataReadySubscription.unsubscribe();
      }
    }
}
