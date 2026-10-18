import { pb } from './pocketbase';

/**
 * Searches Apple Music / iTunes Store for albums and artists.
 * Returns high-resolution album artwork (1000x1000) and metadata.
 */
export async function searchAppleMusic(query, limit = 25) {
    if (!query || !query.trim()) return [];
    const cleanQuery = query.trim();

    // 1. Try direct iTunes Search API (Fast, client-side, CORS allowed by Apple)
    try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&entity=album&limit=${limit}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                return data.results.map(album => {
                    const artwork100 = album.artworkUrl100 || '';
                    const highRes = artwork100 ? artwork100.replace('100x100bb', '1000x1000bb') : null;
                    const mediumRes = artwork100 ? artwork100.replace('100x100bb', '600x600bb') : null;
                    const cleanLabel = album.copyright ? album.copyright.replace(/℗\s*\d{4}\s*/, '').trim() : '';

                    return {
                        id: album.collectionId,
                        collectionId: album.collectionId,
                        title: album.collectionName || 'Unknown Title',
                        artist: album.artistName || 'Unknown Artist',
                        year: album.releaseDate ? album.releaseDate.substring(0, 4) : '',
                        genre: album.primaryGenreName || '',
                        label: cleanLabel || '',
                        thumb: highRes || mediumRes || artwork100,
                        thumbPreview: mediumRes || artwork100,
                        trackCount: album.trackCount || 0
                    };
                });
            }
        }
    } catch (err) {
        console.warn('Direct iTunes search failed, trying PocketBase fallback:', err);
    }

    // 2. Fallback to PocketBase backend proxy if direct fetch is blocked
    try {
        const pbBase = pb.baseUrl.replace(/\/$/, '');
        const res = await fetch(`${pbBase}/api/music/search?q=${encodeURIComponent(cleanQuery)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                return data.results.map(r => ({
                    id: r.id || r.collectionId || Math.random(),
                    collectionId: r.collectionId || r.id,
                    title: r.title || 'Unknown Title',
                    artist: r.artist || 'Unknown Artist',
                    year: r.year ? String(r.year) : '',
                    genre: Array.isArray(r.genre) ? r.genre.join(', ') : (r.genre || ''),
                    label: Array.isArray(r.label) ? r.label[0] : (r.label || ''),
                    thumb: r.thumb ? r.thumb.replace('100x100bb', '1000x1000bb').replace('600x600bb', '1000x1000bb') : '',
                    thumbPreview: r.thumb || '',
                    trackCount: r.trackCount || 0
                }));
            }
        }
    } catch (err) {
        console.error('All music search methods failed:', err);
    }

    return [];
}

/**
 * Fetches the full tracklist for an album collection from iTunes.
 */
export async function fetchAlbumTracks(collectionId) {
    if (!collectionId) return '';
    try {
        const res = await fetch(`https://itunes.apple.com/lookup?id=${collectionId}&entity=song`);
        if (!res.ok) return '';
        const data = await res.json();
        const songs = (data.results || []).filter(item => item.wrapperType === 'track');
        if (songs.length === 0) return '';

        return songs.map((s, idx) => {
            const num = s.trackNumber || (idx + 1);
            const timeMs = s.trackTimeMillis;
            let timeStr = '';
            if (timeMs) {
                const totalSec = Math.floor(timeMs / 1000);
                const m = Math.floor(totalSec / 60);
                const sRem = totalSec % 60;
                timeStr = ` (${m}:${sRem < 10 ? '0' : ''}${sRem})`;
            }
            return `${num}. ${s.trackName}${timeStr}`;
        }).join('\n');
    } catch (err) {
        console.warn('Could not fetch album tracks:', err);
        return '';
    }
}

/**
 * Downloads a remote image URL and converts it to a File ready for PocketBase upload.
 * Has canvas fallback if direct fetch hits CORS.
 */
export async function downloadCoverAsFile(imageUrl, filename = 'cover.jpg') {
    if (!imageUrl) throw new Error('No image URL provided');

    // Attempt 1: Direct fetch blob
    try {
        const res = await fetch(imageUrl, { mode: 'cors' });
        if (res.ok) {
            const blob = await res.blob();
            return new File([blob], filename, { type: blob.type || 'image/jpeg' });
        }
    } catch (err) {
        console.warn('Direct image fetch failed, attempting canvas fallback:', err);
    }

    // Attempt 2: Image element + Canvas
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], filename, { type: 'image/jpeg' }));
                    } else {
                        reject(new Error('Canvas toBlob returned null'));
                    }
                }, 'image/jpeg', 0.92);
            } catch (canvasErr) {
                reject(canvasErr);
            }
        };
        img.onerror = (e) => reject(new Error('Failed to load image for canvas export'));
        img.src = imageUrl;
    });
}
