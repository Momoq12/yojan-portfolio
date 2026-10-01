const vinyl = document.querySelector('#vinyl');
const spotifyLink = document.querySelector('#spotify-link');
const albumArt = document.querySelector('#album-art');
const vinylCover = document.querySelector('#vinyl-cover');
const playbackStatus = document.querySelector('#playback-status');
const trackName = document.querySelector('#track-name');
const artistName = document.querySelector('#artist-name');

async function updateSpotify() {
  if (!vinyl || !spotifyLink || !albumArt || !vinylCover || !playbackStatus || !trackName || !artistName) return;
  try {
    const response = await fetch('/api/now-playing', { cache: 'no-store' });
    if (!response.ok) throw new Error('Spotify is not connected');
    const data = await response.json();
    vinyl.classList.toggle('playing', Boolean(data.isPlaying));
    playbackStatus.textContent = data.isPlaying ? 'Now playing on Spotify' : 'Spotify is quiet';
    trackName.textContent = data.title || 'Nothing playing';
    artistName.textContent = data.artist || 'YOJAN ON SPOTIFY';
    if (data.albumArt) {
      albumArt.src = data.albumArt;
      vinylCover.src = data.albumArt;
    } 
    if (data.songUrl) spotifyLink.href = data.songUrl;
  } catch {
    vinyl.classList.remove('playing');
    playbackStatus.textContent = 'Spotify connection pending';
  }
}

updateSpotify();
setInterval(updateSpotify, 15000);
