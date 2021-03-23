import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { AuthRedirectComponent } from './auth/auth-redirect/auth-redirect.component';
import { AuthCallbackComponent } from './auth/auth-callback/auth-callback.component';
import { RouterModule, Routes } from '@angular/router';
import { environment } from 'src/environments/environment';
import { AuthGuardService, AuthService, SpotifyHttpClientService, SpotifyLibModule } from 'spotify-lib';
import { HttpClientModule } from '@angular/common/http';

const appRoutes: Routes = [
  {
    path: '',
    component: AuthRedirectComponent
  },
  { 
    path: environment.spotifyCallBackRoute, 
    component: AuthCallbackComponent 
  },
  { 
    path: '**', 
    redirectTo: ''
  }
]

@NgModule({
  declarations: [
    AppComponent,
    AuthRedirectComponent,
    AuthCallbackComponent
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot(appRoutes),
    HttpClientModule,
    SpotifyLibModule.forRoot({
      redirectURI: environment.spotifyAuthRedirectURI,
      clientId: '40bdabd3ffb14520bebc8e90e97c0c77',
      clientScope: 'playlist-read-private streaming user-read-email user-read-private user-top-read playlist-modify-public',
      storageKeyForCodeVerifier: 'STRON_codeVerifier',
      storageKeyForAuthToken: 'STRON_authToken',
      storageKeyForAuthTokenValidUntil: 'STRON_authTokenValidUntil',
      storageKeyForAuthRequestState: 'STRON_state'
    })
  ],
  providers: [
    AuthService,
    AuthGuardService,
    SpotifyHttpClientService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
