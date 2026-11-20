// Finds the video link in whatever text you paste or share: a bare link, a link
// with the video's title around it, a link without "https://", and every kind of
// YouTube link (youtu.be, Shorts, live, mobile, music). YouTube links come back in
// one tidy form without tracking codes like ?si=…
const INVISIBLE = /[​-‏‪-‮⁠-⁯﻿]/g;
const KNOWN_SITES = /\b(?:www\.|m\.|mobile\.|vm\.|music\.)?(?:youtube\.com|youtu\.be|twitch\.tv|tiktok\.com|x\.com|twitter\.com|instagram\.com|vimeo\.com|facebook\.com|fb\.watch|kick\.com|rumble\.com|drive\.google\.com|dropbox\.com)\/[^\s<>"'`]+/i;
const YOUTUBE_ID = /^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|live\/|embed\/|v\/)|youtu\.be\/)([\w-]{11})(?![\w-])/i;

// The YouTube video id in a link, or null.
export function youtubeId(link) {
  const m = String(link || '').match(YOUTUBE_ID);
  return m ? m[1] : null;
}

export function findLink(text) {
  const s = String(text || '').replace(INVISIBLE, ' ');
  const m = s.match(/https?:\/\/[^\s<>"'`]+/i) || s.match(KNOWN_SITES);
  if (!m) return null;
  let link = m[0].replace(/[)\]}.,;:!?'"’”]+$/, '');
  if (!/^https?:\/\//i.test(link)) link = `https://${link}`;
  if (!/^https?:\/\/[^/\s]+\.[^/\s]+/i.test(link)) return null;
  const id = youtubeId(link);
  return id ? `https://www.youtube.com/watch?v=${id}` : link;
}
