import fs from "fs";
import path from "path";
import { getPreferenceValues } from "@raycast/api";

const userDataDirectoryPath = () => {
  if (!process.env.HOME) {
    throw new Error("$HOME environment variable is not set.");
  }

  return path.join(process.env.HOME, "Library", "Application Support", "LibreWolf", "Profiles");
};

const getProfileName = (userDirectoryPath: string) => {
  if (!fs.existsSync(userDirectoryPath)) {
    return ""; // Dizin yoksa boş string döndür
  }
  const profiles = fs.readdirSync(userDirectoryPath);
  const preferences = getPreferenceValues<Preferences>();

  const customProfile = profiles.find((profile) => profile.endsWith(preferences.profileDirectorySuffix));
  const defaultReleaseProfile = profiles.find((profile) => profile.endsWith(".Default (release)"));
  const defaultAlphaProfile = profiles.find((profile) => profile.endsWith(".Default (alpha)"));

  if (customProfile) return customProfile;
  if (defaultReleaseProfile) return defaultReleaseProfile;
  if (defaultAlphaProfile) return defaultAlphaProfile;
  if (profiles.length > 0) return profiles[0];
  return "";
};

export const getHistoryDbPath = (): string => {
  const userDirectoryPath = userDataDirectoryPath();
  const profileName = getProfileName(userDirectoryPath);
  if (!profileName) return ""; // Profil yoksa boş string döndür
  return path.join(userDirectoryPath, profileName, "places.sqlite");
};

export const getBookmarksDirectoryPath = (): string => {
  const userDirectoryPath = userDataDirectoryPath();
  return path.join(userDirectoryPath, getProfileName(userDirectoryPath), "bookmarkbackups");
};

export const getSessionManagerExtensionPath = (extensionId: string) => {
  const userDirectoryPath = userDataDirectoryPath();
  return path.join(
    userDirectoryPath,
    getProfileName(userDirectoryPath),
    "storage",
    "default",
    `moz-extension+++${extensionId}`,
    "idb",
  );
};

export const getSessionInactivePath = () => {
  const userDirectoryPath = userDataDirectoryPath();
  return path.join(userDirectoryPath, getProfileName(userDirectoryPath), "sessionstore.jsonlz4");
};

export const getSessionActivePath = async () => {
  const userDirectoryPath = userDataDirectoryPath();
  return path.join(userDirectoryPath, getProfileName(userDirectoryPath), "sessionstore-backups", "recovery.jsonlz4");
};

export function decodeLZ4(buffer: Buffer) {
  const u8sz = buffer.slice(8, 12);
  const origLen = u8sz[0] + u8sz[1] * 256 + u8sz[2] * 256 * 256 + u8sz[3] * 256 * 256 * 256;
  // Extract compressed data (past mozilla jsonlz4 header of 12 bytes)
  const jsonStart = 12;
  const u8Comp = buffer.slice(jsonStart);
  // Create LZ4 buffer
  const comp = Buffer.from(u8Comp);
  const orig = Buffer.alloc(origLen);
  // perform lz4 decompression
  const decompressedLen = decodeBlock(comp, orig);
  const data = orig.subarray(0, decompressedLen);
  return JSON.parse(data.toString());
}

function decodeBlock(input: Buffer, output: Buffer, sIdx?: number, eIdx?: number) {
  sIdx = sIdx || 0;
  eIdx = eIdx || input.length - sIdx;
  let a;
  // Process each sequence in the incoming data
  for (let i = sIdx, n = eIdx, j = 0; i < n; ) {
    a = j;
    const token = input[i++];

    // Literals
    let literals_length = token >> 4;
    if (literals_length > 0) {
      // length of literals
      let l = literals_length + 240;
      while (l === 255) {
        l = input[i++];
        literals_length += l;
      }

      // Copy the literals
      const end = i + literals_length;
      while (i < end) output[j++] = input[i++];

      // End of buffer?
      if (i === n) return j;
    }

    // Match copy
    // 2 bytes offset (little endian)
    const offset = input[i++] | (input[i++] << 8);

    // 0 is an invalid offset value
    if (offset === 0 || offset > j) return -(i - 2);

    // length of match copy
    let match_length = token & 0xf;
    let l = match_length + 240;
    while (l === 255) {
      l = input[i++];
      match_length += l;
    }

    // Copy the match
    let pos = j - offset; // position of the match copy in the current output
    const end = j + match_length + 4; // minmatch = 4
    while (j < end) output[j++] = output[pos++];
  }

  return a;
}
