import type { LocationInfo } from "./utils/crypto";

declare namespace App {
  interface Locals {
    // Add properties that are added to locals in middleware:
    locationInfo: LocationInfo | null;
    clientUuid: string | null;
    // Add other custom locals properties here if you have them
  }
}
