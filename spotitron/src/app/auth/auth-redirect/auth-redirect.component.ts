import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'spotify-lib';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-auth-redirect',
  templateUrl: './auth-redirect.component.html',
  styleUrls: ['./auth-redirect.component.css']
})
export class AuthRedirectComponent {

  constructor(private router: Router, private authService: AuthService) {
    // we are authenticated; just navigate away
    if (authService.isAuthenticated()) {
      this.router.navigate([environment.spotifyCallBackRoute]);
    }
  }

  
  public redirectToSpotify(): void {
    // redirect
    window.location.href = this.authService.getSpotifyAuthRedirectURI();
  }
}
