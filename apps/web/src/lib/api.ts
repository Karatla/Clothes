const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
const DEFAULT_API_PORT = "3001";
const DEFAULT_API_HTTPS_PORT =
  process.env.NEXT_PUBLIC_API_HTTPS_PORT?.trim() || "3444";

const isLocalHostname = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

/**
 * 后端地址，跟随当前页面的主机名和协议。
 *
 * - 手机/平板用局域网 IP 访问时，配置里的 localhost 指的是手机自己，
 *   请求一定失败，所以自动换成当前页面的主机名。
 * - 页面是 https 时必须调用 https 的后端端口，否则浏览器会拦截混合内容。
 */
export function getApiBase() {
  if (typeof window === "undefined") {
    return CONFIGURED_API_URL || `http://localhost:${DEFAULT_API_PORT}`;
  }

  const pageHost = window.location.hostname;
  const pageProtocol = window.location.protocol;
  const isHttps = pageProtocol === "https:";

  let httpPort = DEFAULT_API_PORT;
  let configuredOrigin = "";
  try {
    if (CONFIGURED_API_URL) {
      const configured = new URL(CONFIGURED_API_URL);
      httpPort = configured.port || DEFAULT_API_PORT;
      configuredOrigin = configured.origin;
      if (!isHttps && !isLocalHostname(configured.hostname)) {
        // 明确配置了一个非 localhost 的后端地址，按配置走
        return configuredOrigin;
      }
    }
  } catch {
    return CONFIGURED_API_URL;
  }

  const port = isHttps ? DEFAULT_API_HTTPS_PORT : httpPort;
  return `${pageProtocol}//${pageHost}:${port}`;
}

/**
 * 后端的 http 地址。
 * 证书下载只能走 http —— 手机还没信任证书，https 根本打不开。
 */
export function getHttpApiBase() {
  if (typeof window === "undefined") {
    return CONFIGURED_API_URL || `http://localhost:${DEFAULT_API_PORT}`;
  }

  let port = DEFAULT_API_PORT;
  try {
    if (CONFIGURED_API_URL) {
      port = new URL(CONFIGURED_API_URL).port || DEFAULT_API_PORT;
    }
  } catch {
    // 配置无法解析时用默认端口
  }

  return `http://${window.location.hostname}:${port}`;
}

/** 当前页面是否处在可以调用摄像头的安全环境 */
export function isSecureContextAvailable() {
  if (typeof window === "undefined") return false;
  return window.isSecureContext === true;
}

/** 同一台机器上对应的 https 地址，用于从 http 页面跳到 https */
export function getHttpsSiteUrl(webHttpsPort: number | string) {
  if (typeof window === "undefined") return "";
  return `https://${window.location.hostname}:${webHttpsPort}${window.location.pathname}`;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "请求失败");
  }

  return response.json() as Promise<T>;
}

export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getApiBase()}/uploads`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "上传失败");
  }

  return response.json() as Promise<{ url: string }>;
}

export function resolveImageUrl(url?: string | null) {
  if (!url) return null;

  const base = getApiBase();

  if (url.startsWith("http://") || url.startsWith("https://")) {
    // 历史数据里存的是 http://localhost:3001/uploads/xxx，
    // 局域网设备打不开，这里换成当前可访问的后端地址。
    try {
      const parsed = new URL(url);
      if (
        isLocalHostname(parsed.hostname) &&
        typeof window !== "undefined" &&
        !isLocalHostname(window.location.hostname)
      ) {
        return `${base}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return url;
    }
    return url;
  }

  if (url.startsWith("/")) {
    return `${base}${url}`;
  }
  return `${base}/${url}`;
}
