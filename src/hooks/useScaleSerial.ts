"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseScaleWeightLine } from "@/lib/inventory-scale";

type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
};

interface SerialNavigator extends Navigator {
  serial: {
    requestPort(): Promise<SerialPortLike>;
  };
}

export function useScaleSerial(onWeight: (value: number, unit: string) => void) {
  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const [connected, setConnected] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bufferRef = useRef("");

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "serial" in navigator);
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await readerRef.current?.cancel();
    } catch {
      /* ignore */
    }
    readerRef.current = null;
    try {
      await portRef.current?.close();
    } catch {
      /* ignore */
    }
    portRef.current = null;
    setConnected(false);
  }, []);

  const readLoop = useCallback(
    async (port: SerialPortLike) => {
      const reader = port.readable?.getReader();
      if (!reader) return;
      readerRef.current = reader;
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;

          bufferRef.current += decoder.decode(value, { stream: true });
          const lines = bufferRef.current.split(/\r?\n/);
          bufferRef.current = lines.pop() ?? "";

          for (const line of lines) {
            const parsed = parseScaleWeightLine(line);
            if (parsed && parsed.value > 0) {
              onWeight(parsed.value, parsed.unit);
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "NetworkError") {
          setError(err instanceof Error ? err.message : "Scale read failed");
        }
      } finally {
        reader.releaseLock();
        setConnected(false);
      }
    },
    [onWeight]
  );

  const connect = useCallback(async () => {
    setError(null);
    if (!supported) {
      setError("Web Serial not supported — use Chrome or Edge on desktop");
      return;
    }

    try {
      const port = await (navigator as SerialNavigator).serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setConnected(true);
      void readLoop(port);
    } catch (err) {
      if ((err as Error).name !== "NotFoundError") {
        setError(err instanceof Error ? err.message : "Could not connect to scale");
      }
    }
  }, [readLoop, supported]);

  useEffect(() => () => {
    void disconnect();
  }, [disconnect]);

  return { supported, connected, error, connect, disconnect };
}
