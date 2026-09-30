module.exports = async function handler(request, response) {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_REFRESH_TOKEN } = process.env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_REFRESH_TOKEN) {
    return response.status(503).json({ isPlaying: false, configured: false });
  }

  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: SPOTIFY_REFRESH_TOKEN
      })
    });
    if (!tokenResponse.ok) throw new Error('Token refresh failed');
    const { access_token: accessToken } = await tokenResponse.json();
    const playingResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    response.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
    if (playingResponse.status === 204) return response.status(200).json({ isPlaying: false });
    if (!playingResponse.ok) throw new Error('Playback request failed');
    const data = await playingResponse.json();
    const item = data.item;
    return response.status(200).json({
      isPlaying: Boolean(data.is_playing),
      title: item?.name || null,
      artist: item?.artists?.map((artist) => artist.name).join(', ') || item?.show?.name || null,
      albumArt: item?.album?.images?.[1]?.url || item?.album?.images?.[0]?.url || item?.images?.[1]?.url || null,
      songUrl: item?.external_urls?.spotify || data.context?.external_urls?.spotify || null
    });
  } catch {
    return response.status(502).json({ isPlaying: false, error: 'Spotify unavailable' });
  }
};
