/**
 * Room Code Utilities for Watch Party
 *
 * - Exactly 6 characters
 * - Uppercase alphanumeric characters
 * - Avoids visually ambiguous characters (O, 0, I, 1)
 * - Safe normalization of inputs (strips "ROOM-", whitespace, URL prefixes)
 * - Format validation
 */

// 32 characters: uppercase letters + numbers without O, 0, I, 1
export const ROOM_CODE_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Generate a random 6-character room code using cryptographically secure randomness.
 * Works in browser, Edge, and Node.js environments.
 */
export function generateRoomCode() {
  const bytes = new Uint8Array(6);
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 6; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARSET[bytes[i] % ROOM_CODE_CHARSET.length];
  }
  return code;
}

/**
 * Normalizes user input for room codes.
 * - Extracts room code if full URL was pasted
 * - Converts to uppercase
 * - Strips "ROOM-" or "ROOM_" or "ROOM " prefixes
 * - Removes hyphens, spaces, and unwanted symbols
 *
 * Examples:
 * " room-lnatjp " -> "LNATJP"
 * "https://.../watch-party/A7K2P9" -> "A7K2P9"
 * "ROOM-A7K2P9" -> "A7K2P9"
 */
export function normalizeRoomCode(rawInput) {
  if (!rawInput) return "";
  let input = String(rawInput).trim();

  // If user pasted a full URL (e.g. from "Copy invite"), extract the room code
  if (input.includes("://") || input.includes("/watch-party/")) {
    try {
      const url = new URL(input.includes("://") ? input : `https://${input}`);
      const parts = url.pathname.split("/").filter(Boolean);
      const watchPartyIndex = parts.indexOf("watch-party");
      if (watchPartyIndex !== -1 && parts[watchPartyIndex + 1]) {
        input = parts[watchPartyIndex + 1];
      } else if (parts.length > 0) {
        input = parts[parts.length - 1];
      }
    } catch {
      const match = input.match(/watch-party\/([a-zA-Z0-9_-]+)/i);
      if (match) input = match[1];
    }
  }

  // Remove query strings, hashes, trailing slashes
  input = input.split("?")[0].split("#")[0].replace(/\/$/, "").trim();

  // Convert to uppercase
  input = input.toUpperCase();

  // Strip "ROOM-" or "ROOM_" or "ROOM " or "ROOM:" prefix if present
  input = input.replace(/^ROOM[-_:\s]+/, "");

  // Remove any remaining spaces and hyphens
  input = input.replace(/[\s-]/g, "");

  return input;
}

/**
 * Validates if a code (or normalized code) matches the 6-character alphanumeric format.
 */
export function isValidRoomCode(code) {
  if (!code || typeof code !== "string") return false;
  const normalized = normalizeRoomCode(code);
  return /^[A-Z0-9]{6}$/.test(normalized);
}
