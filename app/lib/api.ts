const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

function trimSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export const API_BASE_URL = trimSlash(rawBase || "http://121.41.208.145:8000");
