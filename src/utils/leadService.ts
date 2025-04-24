const sheetUrl = import.meta.env.GSHEET_GET_WH_URL;

// Helper function to transform array of arrays to array of objects
function transformSheetData(data: string[][]): Record<string, string>[] {
  if (!data || data.length < 2) {
    // Handle empty or header-only data
    return [];
  }

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || ""; // Use header as key, handle potentially missing values
    });
    return obj;
  });
}

// --- Cache Implementation ---
let cachedData: Record<string, string>[] | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
// --- End Cache Implementation ---

export async function getLeads(): Promise<Record<string, string>[]> {
  console.time("getLeads called");
  if (!sheetUrl) {
    console.error("GSHEET_GET_WH_URL environment variable is not set.");
    return []; // Return empty array if URL is not configured
  }

  // --- Cache Check ---
  const now = Date.now();
  if (cachedData && now - lastFetchTime < CACHE_DURATION_MS) {
    console.log("Returning cached leads data from leadService.");
    console.timeEnd("getLeads called");
    return cachedData;
  }
  // --- End Cache Check ---

  console.log("Fetching fresh leads data via leadService...");
  try {
    const response = await fetch(sheetUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet data: ${response.statusText}`);
    }

    const sheetData: string[][] = await response.json();
    const processedData = transformSheetData(sheetData);

    // --- Update Cache ---
    cachedData = processedData;
    lastFetchTime = now;
    console.log("leadService cache updated.");
    // --- End Update Cache ---

    console.timeEnd("getLeads called");
    return processedData;
  } catch (error) {
    console.error(
      "Error fetching or processing sheet data in leadService:",
      error
    );
    // Optionally: return stale cache if fetch fails?
    // if (cachedData) { return cachedData; }
    console.timeEnd("getLeads called");
    return []; // Return empty array on error
  }
}
