```typescript
/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare" />

import type { LocationInfo } from "./utils/crypto";

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    eventId?: string;
    locationInfo?: LocationInfo | null;
    clientUuid?: string;
    // Add other custom locals properties here if you have them
  }
}
```
