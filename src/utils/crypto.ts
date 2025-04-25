import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
// Ensure LOCATION_ENCRYPTION_KEY is a 32-byte secure key set in your environment variables
const ENCRYPTION_KEY = Buffer.from(
  import.meta.env.LOCATION_ENCRYPTION_KEY || "",
  "hex"
); // Ensure key is 32 bytes (64 hex chars)
const IV_LENGTH = 16; // For AES GCM

if (ENCRYPTION_KEY.length !== 32 && import.meta.env.PROD) {
  console.error(
    "FATAL: LOCATION_ENCRYPTION_KEY must be set and be a 64-character hex string (32 bytes)."
  );
  // Optionally throw an error or exit in production if the key is invalid
  // throw new Error("Invalid ENCRYPTION_KEY length.");
}

/**
 * Encrypts data using AES-256-GCM.
 * Prepends the IV to the ciphertext.
 */
export function encryptData(data: string): string | null {
  if (ENCRYPTION_KEY.length !== 32) {
    console.error("Encryption failed: Invalid key length.");
    return null; // Don't encrypt if key is invalid
  }
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();
    // Prepend IV and AuthTag (hex encoded) to the encrypted data
    return iv.toString("hex") + authTag.toString("hex") + encrypted;
  } catch (error) {
    console.error("Encryption error:", error);
    return null;
  }
}

/**
 * Decrypts data encrypted with encryptData.
 * Assumes IV and AuthTag are prepended to the ciphertext.
 */
export function decryptData(encryptedData: string): string | null {
  if (ENCRYPTION_KEY.length !== 32) {
    console.error("Decryption failed: Invalid key length.");
    return null; // Don't decrypt if key is invalid
  }
  try {
    const iv = Buffer.from(encryptedData.substring(0, IV_LENGTH * 2), "hex");
    const authTag = Buffer.from(
      encryptedData.substring(IV_LENGTH * 2, IV_LENGTH * 2 + 16 * 2),
      "hex"
    ); // GCM Auth Tag is 16 bytes
    const encrypted = encryptedData.substring(IV_LENGTH * 2 + 16 * 2);

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    return null; // Return null if decryption fails (e.g., bad key, tampered data)
  }
}

// Define the structure for location info
export interface LocationInfo {
  status: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  query?: string; // The IP address used for the lookup
  message?: string; // Optional error message from ip-api
}
