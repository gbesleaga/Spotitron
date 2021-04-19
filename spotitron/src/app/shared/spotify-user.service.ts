import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { forkJoin } from "rxjs";
import { AuthService, SpotifyHttpClientService, SpotifySimplifiedPlaylistObject } from "spotify-lib";

@Injectable({providedIn: 'root'})
export class SpotifyUserService {

    private currentUserId = "";
    private currentUserOwnedPlaylists: SpotifySimplifiedPlaylistObject[] = [];

    constructor(private spotifyService: SpotifyHttpClientService,
        private authService: AuthService) {
    }

    fetchData() {
        const fetching: Observable<boolean> = new Observable((observer) => {
            this.currentUserId = "";
            this.currentUserOwnedPlaylists = [];
            
            // get playlists that current user owns
            forkJoin({
                userId: this.spotifyService.getUserId({ accessToken: this.authService.getAccessToken() }),
                userPlaylists: this.spotifyService.getPlaylistsOfCurrentUser({ accessToken: this.authService.getAccessToken() })
            })
            .subscribe( 
                response => {
                    this.currentUserId = response.userId.id;
                    let playlists = response.userPlaylists.items as SpotifySimplifiedPlaylistObject[];
    
                    for (let p of playlists) {
                        if (p.owner.id === this.currentUserId) {
                            this.currentUserOwnedPlaylists.push(p);
                        }
                    }

                    observer.next(true);
                },
                err => {
                    console.log(err);
                    observer.next(false);
                }
            );
        });

        return fetching;
    }

    isReady() {
        return (this.currentUserId !== '');
    }

    getUserId() {
        return this.currentUserId;
    }

    getUserOwnedPlaylists() {
        return this.currentUserOwnedPlaylists;
    }
}