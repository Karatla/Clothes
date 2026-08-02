import fs from 'fs';
import path from 'path';

export type HttpsFiles = {
  dir: string;
  caPath: string;
  certPath: string;
  keyPath: string;
  available: boolean;
};

/**
 * 证书放在仓库根目录的 certs/ 下，由 scripts/create-cert.ts 生成。
 * 找不到证书时系统照常以 http 运行，只是手机摄像头扫码不可用。
 */
export function resolveHttpsFiles(): HttpsFiles {
  const dir =
    process.env.CERT_DIR ?? path.resolve(process.cwd(), '..', '..', 'certs');
  const caPath = path.join(dir, 'ca.crt');
  const certPath = path.join(dir, 'server.crt');
  const keyPath = path.join(dir, 'server.key');

  return {
    dir,
    caPath,
    certPath,
    keyPath,
    available: fs.existsSync(certPath) && fs.existsSync(keyPath),
  };
}

export function readHttpsOptions(files: HttpsFiles) {
  if (!files.available) {
    return null;
  }

  return {
    cert: fs.readFileSync(files.certPath),
    key: fs.readFileSync(files.keyPath),
  };
}
