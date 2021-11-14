import { SpotifyUserObject, SpotifyPagingObject, SpotifyPlaylistTrackObject, SpotifyTrackObject, SpotifySimplifiedArtistObject, SpotifySimplifiedAlbumObject, SpotifyImageObject } from "spotify-lib";
import { CountryChart } from "./types";


export function extractChart(obj: any): CountryChart {
  const country: string = obj.country;
  const name: string = obj.name;
  const id: string = obj.id;

  const owner = extractSpotifyUserObject(obj.owner);

  const tracks = extractSpotifyPagingObject(obj.tracks);

  return { country, name, tracks, id, owner };
}


function extractSpotifyUserObject(obj: any): SpotifyUserObject {
  return { id: obj.id };
}


function extractSpotifyPagingObject(obj: any): SpotifyPagingObject {
  return {
    href: obj.href,
    items: obj.items.map(extractSpotifyPlaylistTrackObject),
    limit: obj.limit,
    next: obj.next,
    offset: obj.offset,
    previous: obj.previous,
    total: obj.total
  }
}


function extractSpotifyPlaylistTrackObject(obj: any): SpotifyPlaylistTrackObject {
  return { track: extractSpotifyTrackObject(obj.track) }
}


function extractSpotifyTrackObject(obj: any): SpotifyTrackObject {
  return {
    id: obj.id,
    name: obj.name,
    artists: obj.artists.map(extractSpotifySimplifiedArtistObject),
    album: extractSpotifySimplifiedAlbumObject(obj.album),
    preview_url: obj.preview_url,
  }
}


function extractSpotifySimplifiedArtistObject(obj: any): SpotifySimplifiedArtistObject {
  return {
    id: obj.id,
    name: obj.name
  }
}


function extractSpotifySimplifiedAlbumObject(obj: any): SpotifySimplifiedAlbumObject {
  return {
    name: obj.name,
    id: obj.id,
    images: obj.images.map(extractSpotifyImageObject)
  }
}


function extractSpotifyImageObject(obj: any): SpotifyImageObject {
  return {
    height: obj.height,
    url: obj.url,
    width: obj.width
  }
}