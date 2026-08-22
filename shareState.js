// Share-snapshot encoding: current worksheet state <-> URL hash fragment.
// Pure functions; loaded before app.js and CommonJS-exported for tests.

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded) {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Encode a scenario snapshot for a URL hash. Returns "#s=<base64url>".
 * Only plain-JSON-safe fields survive.
 */
function encodeShareState(state) {
  if (!state || typeof state !== "object") {
    throw new Error("share state must be an object");
  }
  return `#s=${toBase64Url(JSON.stringify(state))}`;
}

/**
 * Decode a location.hash produced by encodeShareState.
 * Returns the state object, or null when the hash is absent/foreign/corrupt.
 */
function decodeShareState(hash) {
  if (!hash || !hash.startsWith("#s=")) {
    return null;
  }
  try {
    const parsed = JSON.parse(fromBase64Url(hash.slice(3)));
    return parsed && typeof parsed === "object" && Array.isArray(parsed.rows) ? parsed : null;
  } catch {
    return null;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { encodeShareState, decodeShareState };
}
