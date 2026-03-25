export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // /proxy/https://example.com/path ဆိုတဲ့ format နဲ့ request လုပ်မယ်
    const targetPath = url.pathname.replace(/^\/proxy\//, "");
    const targetUrl = decodeURIComponent(targetPath) + url.search;

    if (!targetUrl.startsWith("http")) {
      return new Response("Usage: /proxy/https://example.com", { status: 400 });
    }

    const headers = new Headers(request.headers);
    // DPI ကို confuse လုပ်ဖို့ headers clean လုပ်
    headers.delete("x-forwarded-for");
    headers.delete("cf-connecting-ip");
    headers.delete("cf-ipcountry");
    headers.set("user-agent", "Mozilla/5.0 (compatible)");

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
        redirect: "follow",
      });

      const newHeaders = new Headers(response.headers);
      newHeaders.set("access-control-allow-origin", "*");
      newHeaders.delete("content-security-policy");

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    } catch (err) {
      return new Response("Tunnel error: " + err.message, { status: 502 });
    }
  },
};

wrangler.toml
tomlname = "mm-tunnel"
main = "_worker.js"
compatibility_date = "2025-01-01"

[vars]
ENV = "production
