import { SpotifyPlaylistObject } from "spotify-lib";

export interface CountryChart extends SpotifyPlaylistObject {
    country: string;
  }