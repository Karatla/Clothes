/**
 * Production web server.
 *
 * Serves the app over http, and additionally over https when the certificates
 * created by create-cert exist. http must stay available: a phone can only
 * download the certificate over http, before it trusts anything.
 *
 * Started by start-web.bat / start-web.sh
 */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const next = require("next");

const port = Number(process.env.PORT || 3000);
const httpsPort = Number(process.env.WEB_HTTPS_PORT || 3443);
const certDir =
  process.env.CERT_DIR || path.resolve(__dirname, "..", "..", "certs");
const certPath = path.join(certDir, "server.crt");
const keyPath = path.join(certDir, "server.key");

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  http.createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`Web (http)   http://localhost:${port}`);
  });

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const options = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
    https
      .createServer(options, (req, res) => handle(req, res))
      .listen(httpsPort, () => {
        console.log(`Web (https)  https://localhost:${httpsPort}`);
      });
  } else {
    console.log(
      "HTTPS is off (no certificate found). Phone camera scanning needs HTTPS -",
      "run create-cert to enable it.",
    );
  }
});
