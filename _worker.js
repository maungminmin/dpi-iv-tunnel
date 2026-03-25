

import { connect } from 'cloudflare:sockets';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');
    
    // Configuration from Variables 
    const userID = env.UUID || '56b1cbec-9519-4ead-9643-05f240a92107';
    const proxyIP = env.PROXYIP || 'cdn-all.xn--b6gac.eu.org';
    const hostName = url.hostname;

    // ၁။ WebSocket (VLESS Proxy)
    if (upgradeHeader === 'websocket') {
      return await handleVLESS(request, userID, proxyIP);
    }

    //  VLESS Link & QR
    const vlessLink = `vless://${userID}@${hostName}:443?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#Cloudflare-VLESS`;

    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>VLESS Config - ${hostName}</title>
          <style>
              body { background: #0f172a; color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
              .card { background: #1e293b; padding: 2rem; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); text-align: center; border: 1px solid #334155; max-width: 400px; width: 90%; }
              h2 { color: #38bdf8; margin-bottom: 1.5rem; font-size: 1.5rem; }
              .qr-box { background: white; padding: 15px; border-radius: 12px; display: inline-block; margin-bottom: 1.5rem; }
              .link-box { background: #0f172a; padding: 12px; border-radius: 8px; font-size: 0.8rem; word-break: break-all; color: #94a3b8; border: 1px solid #1e293b; line-height: 1.4; margin-bottom: 1rem; }
              .btn { background: #38bdf8; color: #0f172a; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; transition: 0.3s; }
              .btn:hover { background: #7dd3fc; }
          </style>
      </head>
      <body>
          <div class="card">
              <h2>Node Configuration</h2>
              <div class="qr-box">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(vlessLink)}" alt="QR Code">
              </div>
              <div class="link-box" id="vlessLink">${vlessLink}</div>
              <button class="btn" onclick="copyLink()">Copy VLESS Link</button>
          </div>
          <script>
              function copyLink() {
                  const link = document.getElementById('vlessLink').innerText;
                  navigator.clipboard.writeText(link);
                  alert('VLESS Link copied to clipboard!');
              }
          </script>
      </body>
      </html>`, { headers: { 'Content-Type': 'text/html' } });
  }
};

// VLESS Logic function (simplified for direct use)
async function handleVLESS(request, userID, proxyIP) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    server.accept();
    let remoteSocketWraper = { value: null };
    server.addEventListener('message', async ({ data }) => {
        if (remoteSocketWraper.value) {
            const writer = remoteSocketWraper.value.writable.getWriter();
            await writer.write(data);
            writer.releaseLock();
            return;
        }
        const reader = new Uint8Array(data);
        if (reader[0] !== 0) return;
        const addressLength = reader[18];
        const port = (reader[19 + addressLength] << 8) | reader[19 + addressLength + 1];
        try {
            const socket = connect({ hostname: proxyIP, port: port });
            remoteSocketWraper.value = socket;
            socket.readable.pipeTo(new WritableStream({
                write(chunk) { server.send(chunk); },
                close() { server.close(); },
                abort() { server.close(); }
            })).catch(() => server.close());
        } catch (e) { server.close(); }
    });
    return new Response(null, { status: 101, webSocket: client });
                    }
