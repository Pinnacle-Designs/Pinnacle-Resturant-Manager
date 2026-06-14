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

export function useBarcodeScanner(onDetected: (code: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const lastCodeRef = useRef("");

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
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

      if (window.BarcodeDetector) {
        detectorRef.current = new window.BarcodeDetector({ formats: BARCODE_FORMATS });
      }

      const tick = async () => {
        const v = videoRef.current;
        const detector = detectorRef.current;
        if (!v || v.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        if (detector) {
          try {
            const codes = await detector.detect(v);
            const code = codes[0]?.rawValue?.replace(/\D/g, "");
            if (code && code.length >= 4 && code !== lastCodeRef.current) {
              lastCodeRef.current = code;
              onDetected(code);
            }
          } catch {
            /* ignore frame errors */
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera unavailable");
      stop();
    }
  }, [onDetected, stop]);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, active, supported, error, start, stop };
}
