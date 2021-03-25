import { SpotifyPlaylistObject } from "spotify-lib";

export interface CountryChart extends SpotifyPlaylistObject {
    country: string;
}

export interface Position2D {
  x: number;
  y: number;
}
