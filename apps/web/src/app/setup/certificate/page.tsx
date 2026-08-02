"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/app-header";
import { apiFetch, getHttpApiBase, getHttpsSiteUrl } from "@/lib/api";

type SetupStatus = {
  certificateReady: boolean;
  httpsPort: number;
  webHttpsPort: number;
  hosts: string[];
  expiresAt: string | null;
};

type Platform = "ios" | "android" | "other";

const detectPlatform = (): Platform => {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
};

const stepClass =
  "flex gap-3 rounded-2xl border border-[#eadfce] bg-white px-4 py-3 text-sm text-[#5c544b]";

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-4 space-y-2">
      {items.map((text, index) => (
        <li key={text} className={stepClass}>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1f1811] text-xs font-semibold text-white">
            {index + 1}
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ol>
  );
}

export default function CertificateSetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<Platform>("other");
  const [isSecure, setIsSecure] = useState(false);
  const [host, setHost] = useState("");

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsSecure(window.isSecureContext === true);
    setHost(window.location.hostname);
    apiFetch<SetupStatus>("/setup/status")
      .then(setStatus)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "读取证书状态失败"),
      );
  }, []);

  const [downloadUrl, setDownloadUrl] = useState("");

  useEffect(() => {
    // 证书必须从 http 下载：手机还没信任证书，https 打不开
    setDownloadUrl(`${getHttpApiBase()}/setup/ca.crt`);
  }, []);

  const httpsUrl = useMemo(() => {
    if (!status) return "";
    return getHttpsSiteUrl(status.webHttpsPort).replace(
      "/setup/certificate",
      "/",
    );
  }, [status]);

  const hostCovered = useMemo(() => {
    if (!status?.hosts.length || !host) return true;
    return status.hosts.includes(host);
  }, [status, host]);

  const iosSteps = [
    "点下面的「下载证书」按钮，Safari 会提示「此网站正尝试下载配置描述文件」，选择「允许」。",
    "打开「设置」App，最上方会出现「已下载描述文件」，点进去，右上角点「安装」，按提示输入锁屏密码，再点「安装」。",
    "⚠️ 关键一步：回到「设置 → 通用 → 关于本机」，一直滑到最底部的「证书信任设置」，把「Clothes Local CA」的开关打开。",
    "回到这个页面，点最下面的「打开安全版本」。以后手机上就用那个地址。",
  ];

  const androidSteps = [
    "点下面的「下载证书」按钮，浏览器会把 clothes-ca.crt 下载下来。",
    "打开「设置」，搜索「证书」，进入「安装证书 / 从存储设备安装」。",
    "选择「CA 证书」，系统会弹出安全警告，点「仍然安装」，然后选中刚才下载的 clothes-ca.crt。",
    "回到这个页面，点最下面的「打开安全版本」。以后手机上就用那个地址。",
  ];

  const otherSteps = [
    "点下面的「下载证书」按钮保存 clothes-ca.crt。",
    "把它导入系统或浏览器的「受信任的根证书颁发机构」。",
    "回到这个页面，点最下面的「打开安全版本」。",
  ];

  const steps =
    platform === "ios" ? iosSteps : platform === "android" ? androidSteps : otherSteps;

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <AppHeader
          label="手机扫码设置"
          title="安装安全证书"
          description="装一次就好，以后这台手机都不用再装。"
        />

        <section className="rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          {isSecure ? (
            <div className="rounded-2xl border border-[#c9e2c8] bg-[#f1fff1] px-4 py-3 text-sm text-[#386641]">
              ✅ 这台设备已经可以使用摄像头扫码，不需要再做任何设置。
            </div>
          ) : (
            <div className="rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-3 text-sm text-[#b14d2a]">
              当前是普通连接（http），手机浏览器不允许在这种连接下使用摄像头。
              按下面三步装好证书后就能扫码了。
            </div>
          )}

          <div className="mt-6 space-y-2 text-sm text-[#6b645a]">
            <p>
              为什么要装：手机浏览器规定，只有「安全连接」才能打开摄像头。
              店里是局域网，没有域名，所以要用这台电脑自己签发的证书，
              手机信任它之后就是安全连接了。
            </p>
            <p>这个证书只在你们店的网络里有效，不会影响手机上的其他网站。</p>
          </div>
        </section>

        {status && !status.certificateReady ? (
          <section className="rounded-3xl border border-[#f0c7b3] bg-[#fff1ea] p-6 text-sm text-[#b14d2a]">
            电脑上还没有生成证书。请在收银电脑上双击运行 <b>create-cert.bat</b>，
            然后重启后端和前端，再回到这个页面。
          </section>
        ) : null}

        {status?.certificateReady && !hostCovered ? (
          <section className="rounded-3xl border border-[#f0c7b3] bg-[#fff1ea] p-6 text-sm text-[#b14d2a]">
            证书里没有包含当前地址 <b>{host}</b>
            （证书覆盖：{status.hosts.join("、")}）。
            电脑的 IP 可能变过，请在电脑上重新运行 <b>create-cert.bat</b>，
            重启服务后再试。
          </section>
        ) : null}

        {!isSecure ? (
          <section className="rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-semibold text-[#1f1811]">
                {platform === "ios"
                  ? "iPhone / iPad 安装步骤"
                  : platform === "android"
                    ? "Android 安装步骤"
                    : "安装步骤"}
              </p>
              <div className="flex gap-2 text-xs">
                {(["ios", "android", "other"] as Platform[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPlatform(item)}
                    className={`rounded-full border px-3 py-1 ${
                      platform === item
                        ? "border-[#1f1811] bg-[#1f1811] text-white"
                        : "border-[#e4d7c5] text-[#6b645a]"
                    }`}
                  >
                    {item === "ios"
                      ? "iPhone"
                      : item === "android"
                        ? "Android"
                        : "其他"}
                  </button>
                ))}
              </div>
            </div>

            <Steps items={steps} />

            <a
              href={downloadUrl}
              className="mt-6 block w-full rounded-2xl bg-[#a7652d] px-4 py-4 text-center text-base font-semibold text-white"
            >
              下载证书
            </a>
            <p className="mt-2 break-all text-center text-xs text-[#8a8073]">
              {downloadUrl}
            </p>

            {httpsUrl ? (
              <a
                href={httpsUrl}
                className="mt-4 block w-full rounded-2xl bg-[#1f1811] px-4 py-4 text-center text-base font-semibold text-white"
              >
                打开安全版本（装好证书后点这里）
              </a>
            ) : null}
            <p className="mt-2 break-all text-center text-xs text-[#8a8073]">
              {httpsUrl}
            </p>
          </section>
        ) : null}

        {status?.expiresAt ? (
          <p className="text-center text-xs text-[#8a8073]">
            服务器证书有效期至{" "}
            {new Date(status.expiresAt).toLocaleDateString("zh-CN")}
            ，到期前在电脑上重新运行 create-cert 即可，手机不用重装。
          </p>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-3 text-sm text-[#b14d2a]">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
