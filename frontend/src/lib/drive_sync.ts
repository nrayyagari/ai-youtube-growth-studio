import { storage } from "./storage";

const CLIENT_ID_STORAGE_KEY = "google_drive_client_id";

interface DriveTokens {
  access_token: string;
  refresh_token?: string;
  expiry: number;
}

export function getClientId(): string {
  return localStorage.getItem(CLIENT_ID_STORAGE_KEY) || "";
}

export function setClientId(clientId: string) {
  localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
}

export function clearClientId() {
  localStorage.removeItem(CLIENT_ID_STORAGE_KEY);
}

function getTokens(): DriveTokens | null {
  const raw = localStorage.getItem("google_drive_tokens");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setTokens(tokens: DriveTokens) {
  localStorage.setItem("google_drive_tokens", JSON.stringify(tokens));
}

function clearTokens() {
  localStorage.removeItem("google_drive_tokens");
}

function isTokenValid(tokens: DriveTokens): boolean {
  return tokens.expiry > Date.now() - 60000;
}

export function getDriveAuthUrl(clientId: string): string {
  const redirectUri = `${window.location.origin}/drive/callback`;
  const scope = "https://www.googleapis.com/auth/drive.file";
  return (
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    "response_type=token&" +
    `scope=${encodeURIComponent(scope)}&` +
    "include_granted_scopes=true&state=drive_sync"
  );
}

export function handleDriveCallback(): boolean {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  if (!accessToken) return false;

  const expiresIn = parseInt(params.get("expires_in") || "3600", 10);
  setTokens({
    access_token: accessToken,
    expiry: Date.now() + expiresIn * 1000,
  });
  return true;
}

const FILE_NAME = "growth_studio_backup.json";

async function getOrCreateFile(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens || !isTokenValid(tokens)) return null;

  const query = `name='${FILE_NAME}' and 'appDataFolder' in parents and trashed=false`;
  const searchUrl =
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(query)}&fields=files(id,name)`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const searchData = await searchRes.json();
  const files = searchData.files || [];
  if (files.length > 0) return files[0].id;

  const metadata = {
    name: FILE_NAME,
    mimeType: "application/json",
    parents: ["appDataFolder"],
  };
  const createRes = await fetch(
    "https://www.googleapis.com/drive/v3/files",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    },
  );
  const createData = await createRes.json();
  return createData.id || null;
}

export async function backupToDrive(): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens || !isTokenValid(tokens)) return false;

  try {
    const fileId = await getOrCreateFile();
    if (!fileId) return false;

    const blob = await storage.exportAll();
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const uploadRes = await fetch(uploadUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
      body: blob,
    });
    return uploadRes.ok;
  } catch {
    return false;
  }
}

export async function restoreFromDrive(): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens || !isTokenValid(tokens)) return false;

  try {
    const fileId = await getOrCreateFile();
    if (!fileId) return false;

    const downloadRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    if (!downloadRes.ok) return false;

    const data = await downloadRes.json();
    const imported = await storage.importAll(data);
    return imported > 0;
  } catch {
    return false;
  }
}

export function isDriveConnected(): boolean {
  const tokens = getTokens();
  return !!tokens && isTokenValid(tokens);
}

export function disconnectDrive() {
  clearTokens();
}
