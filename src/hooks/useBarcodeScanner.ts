"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BarcodeFormat =
  | "ean_13"
  | "ean_8"
  | "upc_a"
  | "upc_e"
  | "code_128"
  | "code_39"
  | "qr_code";

type CameraPermission = "granted" | "denied" | "prompt" | "unknown";

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement | ImageBitmap): Promise<DetectedBarcode[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: BarcodeFormat[] }) => BarcodeDetectorLike;
  }
}

const BARCODE_FORMATS: BarcodeFormat[] = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
];

const ZXING_THROTTLE_MS = 400;

function parseCameraError(err: unknown): { message: string; permissionDenied: boolean } {
  const name = err instanceof DOMException ? err.name : "";
  const message = err instanceof Error ? err.message : "";

  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    /permission denied/i.test(message)
  ) {
    return {
      message: "Camera access was blocked. Allow camera permission to scan barcodes.",
      permissionDenied: true,
    };
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return { message: "No camera found on this device.", permissionDenied: false };
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      message: "Camera is in use by another app. Close it and try again.",
      permissionDenied: false,
    };
  }

  return {
    message: message || "Camera unavailable",
    permissionDenied: false,
  };
}

function normalizeDetectedCode(raw: string): string | null {
  const code = raw.replace(/\D/g, "");
  return code.length >= 4 ? code : null;
}

export function useBarcodeScanner(onDetected: (code: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [nativeSupported, setNativeSupported] = useState(false);
  const [fallbackSupported, setFallbackSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [permissionState, setPermissionState] = useState<CameraPermission>("unknown");
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const zxingReaderRef = useRef<import("@zxing/browser").BrowserMultiFormatReader | null>(null);
  const zxingLoadingRef = useRef(false);
  const lastZxingAttemptRef = useRef(0);
  const lastCodeRef = useRef("");
  const onDetectedRef = useRef(onDetected);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    setNativeSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;

    navigator.permissions
      .query({ name: "camera" as PermissionName })
      .then((status) => {
        setPermissionState(status.state as CameraPermission);
        status.onchange = () => setPermissionState(status.state as CameraPermission);
      })
      .catch(() => {});
  }, []);

  const emitCode = useCallback((raw: string) => {
    const code = normalizeDetectedCode(raw);
    if (!code || code === lastCodeRef.current) return;
    lastCodeRef.current = code;
    onDetectedRef.current(code);
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const tryZxingDecode = useCallback(async (video: HTMLVideoElement) => {
    if (!zxingReaderRef.current && !zxingLoadingRef.current) {
      zxingLoadingRef.current = true;
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        zxingReaderRef.current = new BrowserMultiFormatReader();
        setFallbackSupported(true);
      } catch {
        setFallbackSupported(false);
        return;
      } finally {
        zxingLoadingRef.current = false;
      }
    }

    const reader = zxingReaderRef.current;
    if (!reader) return;

    try {
      const result = await reader.decodeOnceFromVideoElement(video);
      emitCode(result.getText());
    } catch {
      /* no barcode in frame */
    }
  }, [emitCode]);

  const start = useCallback(async () => {
    setError(null);
    setPermissionDenied(false);
    lastCodeRef.current = "";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("Video element not ready");

      video.srcObject = stream;
      await video.play();
      setActive(true);
      setPermissionState("granted");

      if (window.BarcodeDetector) {
        detectorRef.current = new window.BarcodeDetector({ formats: BARCODE_FORMATS });
      }

      const tick = async () => {
        const v = videoRef.current;
        if (!v || v.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        const detector = detectorRef.current;
        if (detector) {
          try {
            const codes = await detector.detect(v);
            const raw = codes[0]?.rawValue;
            if (raw) emitCode(raw);
          } catch {
            /* ignore frame errors */
          }
        } else if (Date.now() - lastZxingAttemptRef.current >= ZXING_THROTTLE_MS) {
          lastZxingAttemptRef.current = Date.now();
          void tryZxingDecode(v);
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const parsed = parseCameraError(err);
      setError(parsed.message);
      setPermissionDenied(parsed.permissionDenied);
      if (parsed.permissionDenied) setPermissionState("denied");
      stop();
    }
  }, [emitCode, stop, tryZxingDecode]);

  useEffect(() => () => stop(), [stop]);

  const supported = nativeSupported || fallbackSupported;

  return {
    videoRef,
    active,
    supported,
    nativeSupported,
    fallbackSupported,
    error,
    permissionDenied,
    permissionState,
    start,
    stop,
    retry: start,
  };
}
