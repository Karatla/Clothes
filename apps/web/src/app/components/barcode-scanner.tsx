"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  /** 连续扫码模式：扫到一个后不关闭，可以接着扫下一个 */
  continuous?: boolean;
  title?: string;
};

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

/** 同一个码在这个时间内不重复触发，避免一次扫码加了好几件 */
const REPEAT_GUARD_MS = 1500;

export default function BarcodeScanner({
  open,
  onClose,
  onScan,
  continuous = true,
  title = "扫码",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const emit = useCallback(
    (code: string) => {
      const value = code.trim();
      if (!value) return;

      const now = Date.now();
      const last = lastCodeRef.current;
      if (last && last.code === value && now - last.at < REPEAT_GUARD_MS) {
        return;
      }
      lastCodeRef.current = { code: value, at: now };
      setLastScanned(value);

      if (navigator.vibrate) {
        navigator.vibrate(60);
      }

      onScan(value);
      if (!continuous) {
        onClose();
      }
    },
    [onScan, onClose, continuous],
  );

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }

    setError(null);
    setLastScanned(null);

    if (!window.isSecureContext) {
      setError(
        "当前是普通连接（http），手机浏览器不允许使用摄像头。请先安装安全证书。",
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("这个浏览器不支持调用摄像头，请改用扫码枪或手动输入。");
      return;
    }

    let cancelled = false;

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const width = video.videoWidth;
      const height = video.videoHeight;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      context.drawImage(video, 0, 0, width, height);

      if (detectorRef.current) {
        // 浏览器原生解码，性能更好（Android Chrome）
        void detectorRef.current
          .detect(canvas)
          .then((results) => {
            if (results[0]?.rawValue) emit(results[0].rawValue);
          })
          .catch(() => null);
      } else {
        const image = context.getImageData(0, 0, width, height);
        const result = jsQR(image.data, width, height, {
          inversionAttempts: "dontInvert",
        });
        if (result?.data) emit(result.data);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    const start = async () => {
      try {
        const globalWindow = window as unknown as {
          BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
        };
        if (globalWindow.BarcodeDetector) {
          detectorRef.current = new globalWindow.BarcodeDetector({
            formats: ["qr_code"],
          });
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          await video.play();
        }
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        const name = (err as { name?: string })?.name;
        if (name === "NotAllowedError") {
          setError("摄像头权限被拒绝。请在浏览器设置里允许本站使用摄像头。");
        } else if (name === "NotFoundError") {
          setError("没有找到摄像头。");
        } else {
          setError(err instanceof Error ? err.message : "无法打开摄像头");
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, emit, stop]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 md:items-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-[#1f1811]">{title}</p>
          <button
            type="button"
            onClick={() => {
              stop();
              onClose();
            }}
            className="rounded-full border border-[#e4d7c5] px-4 py-1 text-sm text-[#6b645a]"
          >
            关闭
          </button>
        </div>

        {error ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-3 text-sm text-[#b14d2a]">
              {error}
            </div>
            <a
              href="/setup/certificate"
              className="block rounded-2xl bg-[#a7652d] px-4 py-3 text-center text-sm font-semibold text-white"
            >
              去设置手机扫码
            </a>
          </div>
        ) : (
          <div className="relative mt-4 overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              className="h-64 w-full object-cover"
              muted
              playsInline
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-40 w-40 rounded-2xl border-4 border-white/80" />
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />

        {lastScanned ? (
          <p className="mt-3 text-center text-sm text-[#386641]">
            已扫描：{lastScanned}
          </p>
        ) : (
          <p className="mt-3 text-center text-xs text-[#8a8073]">
            把商品标签上的二维码对准取景框
          </p>
        )}

        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            emit(manual);
            setManual("");
          }}
        >
          <input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            className="flex-1 rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
            placeholder="扫不出来时手动输入编号"
            inputMode="numeric"
            autoFocus
          />
          <button
            type="submit"
            className="rounded-2xl bg-[#1f1811] px-5 text-sm font-semibold text-white"
          >
            确定
          </button>
        </form>
      </div>
    </div>
  );
}
