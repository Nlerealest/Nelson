// Uploads a video of any length from the phone. Supabase's free plan takes at
// most 50 MB per file, so big videos go up in 45 MB parts that the agent joins
// back together (settings.parts tells it how many).
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { db } from './supabase';
import { BUCKET } from './data';

const PART = 45 * 1024 * 1024;
export const MAX_UPLOAD_MB = 800; // the free plan holds 1 GB in total, clips included

export async function pickVideo() {
  const res = await DocumentPicker.getDocumentAsync({ type: ['video/*'], copyToCacheDirectory: true });
  return res.canceled ? null : res.assets[0];
}

const titleOf = (asset) => (asset.name || 'Uploaded video').replace(/\.[a-z0-9]+$/i, '');

// Returns { path, parts, title } for newProject / a retry. onProgress gets 0–100.
export async function uploadVideo(asset, onProgress = () => {}) {
  const base = `uploads/${Date.now()}-${(asset.name || 'video.mp4').replace(/[^\w.-]+/g, '_')}.part`;
  if (Platform.OS === 'web') {
    if (asset.size > PART) throw new Error('On the web, upload videos up to 45 MB. Use the phone app for bigger ones.');
    const { error } = await db().storage.from(BUCKET).upload(`${base}0`, asset.file, { contentType: 'application/octet-stream' });
    if (error) throw error;
    return { path: base, parts: 1, title: titleOf(asset) };
  }
  const file = new File(asset.uri);
  const size = asset.size || file.size;
  if (!size) throw new Error('This video file is empty or can’t be read.');
  if (size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`This video is over ${MAX_UPLOAD_MB} MB. Trim it first, or use only part of it.`);
  const parts = Math.ceil(size / PART);
  const uploaded = [];
  const handle = file.open();
  try {
    for (let i = 0; i < parts; i++) {
      const bytes = handle.readBytes(Math.min(PART, size - i * PART));
      const body = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? bytes.buffer : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      let error;
      for (let attempt = 0; attempt < 3; attempt++) { // phone networks drop; try each part up to 3 times
        ({ error } = await db().storage.from(BUCKET).upload(`${base}${i}`, body, { contentType: 'application/octet-stream', upsert: true }));
        if (!error) break;
      }
      if (error) throw error;
      uploaded.push(`${base}${i}`);
      onProgress(Math.round(((i + 1) * 100) / parts));
    }
  } catch (e) {
    if (uploaded.length) await db().storage.from(BUCKET).remove(uploaded);
    throw e;
  } finally {
    handle.close();
  }
  return { path: base, parts, title: titleOf(asset) };
}

// Every storage file of an uploaded source (for deleting a project).
export const sourceFiles = (project) => {
  if (!project.source_path) return [];
  const n = Number(project.settings?.parts) || 0;
  return n ? Array.from({ length: n }, (_, i) => `${project.source_path}${i}`) : [project.source_path];
};
