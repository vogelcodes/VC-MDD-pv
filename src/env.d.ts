/// <reference types="astro/client" />

// Import the type definition if it's not globally available
// Adjust path if your crypto util is elsewhere
import type { LocationInfo } from "./utils/crypto";

declare namespace App {
  interface Locals {
    // Add properties that are added to locals in middleware:
    locationInfo: LocationInfo | null;
    // Add other custom locals properties here if you have them
  }
}
