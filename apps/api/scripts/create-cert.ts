/**
 * Creates the local HTTPS certificates.
 *
 * Output (repo root /certs):
 *   ca.crt      - root certificate, this is the file phones/tablets install
 *   ca.key      - root private key, keep it on this computer only
 *   server.crt  - certificate used by the web and api servers
 *   server.key  - its private key
 *
 * The root certificate (ca.crt) is valid for 10 years and is REUSED on every
 * run, so devices only ever have to install it once. Only the server
 * certificate is re-issued, which is what you need after the computer's IP
 * address changes or once a year when it expires.
 *
 * Run:
 *   npx ts-node -P tsconfig.json scripts/create-cert.ts
 *   npx ts-node -P tsconfig.json scripts/create-cert.ts 192.168.1.50 shop.local
 *   npx ts-node -P tsconfig.json scripts/create-cert.ts --force-ca
 */
import forge from 'node-forge';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CERT_DIR = path.resolve(__dirname, '../../../certs');
const CA_CRT = path.join(CERT_DIR, 'ca.crt');
const CA_KEY = path.join(CERT_DIR, 'ca.key');
const SERVER_CRT = path.join(CERT_DIR, 'server.crt');
const SERVER_KEY = path.join(CERT_DIR, 'server.key');

// Apple rejects server certificates valid for more than 398 days, so the
// server certificate is issued for 397 days. The root stays valid for 10 years.
const SERVER_DAYS = 397;
const CA_YEARS = 10;

const args = process.argv.slice(2);
const forceCa = args.includes('--force-ca');
const extraNames = args.filter((arg) => !arg.startsWith('--'));

const localIps = () => {
  const result: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const list of Object.values(interfaces)) {
    for (const item of list ?? []) {
      if (item.family === 'IPv4' && !item.internal) {
        result.push(item.address);
      }
    }
  }
  return result;
};

const isIp = (value: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(value);

const createCa = () => {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = `00${forge.util.bytesToHex(forge.random.getBytesSync(8))}`;
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(
    cert.validity.notBefore.getFullYear() + CA_YEARS,
  );

  const attrs = [
    { name: 'commonName', value: 'Clothes Local CA' },
    { name: 'organizationName', value: 'Clothes Stock System' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  return { cert, privateKey: keys.privateKey };
};

const loadCa = () => {
  const cert = forge.pki.certificateFromPem(fs.readFileSync(CA_CRT, 'utf8'));
  const privateKey = forge.pki.privateKeyFromPem(
    fs.readFileSync(CA_KEY, 'utf8'),
  );
  return { cert, privateKey };
};

const createServerCert = (
  ca: { cert: forge.pki.Certificate; privateKey: forge.pki.PrivateKey },
  hosts: string[],
) => {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = `00${forge.util.bytesToHex(forge.random.getBytesSync(8))}`;
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setDate(
    cert.validity.notBefore.getDate() + SERVER_DAYS,
  );

  cert.setSubject([{ name: 'commonName', value: hosts[0] }]);
  cert.setIssuer(ca.cert.subject.attributes);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false, critical: true },
    {
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: true,
      critical: true,
    },
    { name: 'extKeyUsage', serverAuth: true },
    {
      name: 'subjectAltName',
      altNames: hosts.map((host) =>
        isIp(host) ? { type: 7, ip: host } : { type: 2, value: host },
      ),
    },
  ]);
  cert.sign(ca.privateKey as forge.pki.rsa.PrivateKey, forge.md.sha256.create());

  return { cert, privateKey: keys.privateKey };
};

function main() {
  fs.mkdirSync(CERT_DIR, { recursive: true });

  const ips = localIps();
  if (ips.length === 0) {
    console.warn(
      'WARNING: no local network address found. Phones will not be able to connect.',
    );
  }

  const hosts = Array.from(
    new Set([
      ...ips,
      ...extraNames,
      'localhost',
      '127.0.0.1',
      os.hostname(),
      `${os.hostname()}.local`,
    ]),
  ).filter(Boolean);

  const caExists = fs.existsSync(CA_CRT) && fs.existsSync(CA_KEY);
  let ca: { cert: forge.pki.Certificate; privateKey: forge.pki.PrivateKey };

  if (caExists && !forceCa) {
    ca = loadCa();
    console.log('Reusing the existing root certificate (ca.crt).');
    console.log('Devices that already trust it do NOT need to install it again.');
  } else {
    if (caExists) {
      console.log('--force-ca given: creating a BRAND NEW root certificate.');
      console.log('EVERY phone and tablet will have to install ca.crt again.');
    }
    ca = createCa();
    fs.writeFileSync(CA_CRT, forge.pki.certificateToPem(ca.cert));
    fs.writeFileSync(
      CA_KEY,
      forge.pki.privateKeyToPem(ca.privateKey as forge.pki.rsa.PrivateKey),
      { mode: 0o600 },
    );
    console.log('Created a new root certificate.');
  }

  const server = createServerCert(ca, hosts);
  fs.writeFileSync(SERVER_CRT, forge.pki.certificateToPem(server.cert));
  fs.writeFileSync(SERVER_KEY, forge.pki.privateKeyToPem(server.privateKey), {
    mode: 0o600,
  });

  console.log('');
  console.log('Certificates written to: ' + CERT_DIR);
  console.log('Valid for these addresses:');
  hosts.forEach((host) => console.log('  - ' + host));
  console.log('');
  console.log(
    'Server certificate expires: ' +
      server.cert.validity.notAfter.toISOString().slice(0, 10) +
      '  (re-run this script before then, no phone changes needed)',
  );
  console.log(
    'Root certificate expires:   ' +
      ca.cert.validity.notAfter.toISOString().slice(0, 10),
  );
  console.log('');
  console.log('Next: restart the api and web servers, then open');
  console.log('  http://<this computer ip>:3000/setup/certificate');
  console.log('on the phone and follow the steps there.');
}

main();
