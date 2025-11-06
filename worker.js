// set BOT_TOKEN as a secret binding in the worker environment
const allowedOrigins = []; // update or remove for testing

function makeTelegramUrl(token, file_path_or_url) {
  // if direct_url starts with https://api.telegram.org/file/bot, return it
  if (/^https?:\/\//i.test(file_path_or_url)) {
    return file_path_or_url;
  }
  // otherwise file_path_or_url is the file_path returned by getFile
  return `https://api.telegram.org/file/bot${token}/${file_path_or_url}`;
}

export default {
  async fetch(request, env, ctx) {
    try {
      // Basic origin check (optional but recommended)
      const origin = request.headers.get("origin") || "";
      // if you want open public access, skip origin check
      if (allowedOrigins.length && !allowedOrigins.includes(origin)) {
        // Allow OPTION preflight for CORS
        if (request.method === "OPTIONS") {
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": origin || "*",
              "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
              "Access-Control-Allow-Headers": "Range,Authorization,Content-Type",
              "Access-Control-Max-Age": "86400"
            }
          });
        }
        return new Response("Origin not allowed", { status: 403 });
      }

      const url = new URL(request.url);
      const file_path = url.searchParams.get("file_path");
      const direct_url = url.searchParams.get("direct_url");
      if (!file_path && !direct_url) {
        return new Response("Missing file_path or direct_url query param", { status: 400 });
      }


      const BOT_TOKEN = env.BOT_TOKEN; // bound to the worker (see deployment steps)
      if (!BOT_TOKEN) {
        return new Response("Server misconfigured: missing BOT_TOKEN", { status: 500 });
      }

      const target = makeTelegramUrl(BOT_TOKEN, direct_url || file_path);

      // Forward Range header if present
      const headers = {};
      const rangeHeader = request.headers.get("range");
      if (rangeHeader) {
        headers["Range"] = rangeHeader;
      }

      // Set a sensible timeout/context; Cloudflare handles runtime limits.
      const res = await fetch(target, { headers, cf: { cacheTtl: 0 } });

      // Build response headers to relay important ones
      const responseHeaders = new Headers();
      // Forward content-type
      const contentType = res.headers.get("content-type");
      if (contentType) responseHeaders.set("Content-Type", contentType);
      // If Telegram provides Content-Range, forward it; otherwise, forward Accept-Ranges
      const contentRange = res.headers.get("content-range");
      if (contentRange) responseHeaders.set("Content-Range", contentRange);
      const acceptRanges = res.headers.get("accept-ranges") || "bytes";
      responseHeaders.set("Accept-Ranges", acceptRanges);

      // CORS — allow origin that requested or wildcard
      const allowOrigin = origin || "*";
      responseHeaders.set("Access-Control-Allow-Origin", allowOrigin);
      responseHeaders.set("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
      responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Type");

      // Relay status code (Telegram uses 206 for range responses)
      return new Response(res.body, {
        status: res.status,
        headers: responseHeaders
      });

    } catch (err) {
      return new Response("Proxy error: " + String(err), { status: 502 });
    }
  }
};
