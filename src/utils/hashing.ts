import pkg from "hash.js";
const { sha256 } = pkg;

export interface RawUserData {
  email?: string | null;
  phone?: string | null; // Expects phone number without country code/symbols
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null; // Region/State abbreviation
  countryCode?: string | null; // 2-letter country code
  // Add other fields as needed
}

export interface HashedUserData {
  em?: string; // Email
  ph?: string; // Phone
  fn?: string; // First Name
  ln?: string; // Last Name
  ct?: string; // City
  st?: string; // State
  country?: string; // Country Code (Using 'country' as Meta often uses short codes)
}

/**
 * Hashes user data fields using SHA256 according to Meta's requirements.
 * Input fields should be trimmed and lowercased where appropriate *before* calling this function.
 */
export function hashUserData(data: RawUserData): HashedUserData {
  const hashed: HashedUserData = {};

  if (data.email) {
    hashed.em = sha256().update(data.email).digest("hex");
  }
  if (data.phone) {
    // Ensure phone is just digits if not already sanitized
    const sanitizedPhone = data.phone.replace(/[^0-9]/g, "");
    hashed.ph = sha256().update(sanitizedPhone).digest("hex");
  }
  if (data.firstName) {
    hashed.fn = sha256().update(data.firstName.toLowerCase()).digest("hex");
  }
  if (data.lastName) {
    hashed.ln = sha256().update(data.lastName.toLowerCase()).digest("hex");
  }
  if (data.city) {
    // Assuming city should be hashed lowercased without spaces? Adjust if needed.
    hashed.ct = sha256()
      .update(data.city.toLowerCase().replace(/\s+/g, ""))
      .digest("hex");
  }
  if (data.state) {
    hashed.st = sha256().update(data.state.toLowerCase()).digest("hex");
  }
  if (data.countryCode) {
    console.log("data.countryCode", data.countryCode);
    hashed.country = sha256()
      .update(data.countryCode.toLowerCase())
      .digest("hex");
  }

  return hashed;
}
