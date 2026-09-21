import { useEffect, useRef, useState } from "react";
import { HOURLY_CAP } from "../game/constants";
import {
  classifyCanvas,
  classifyImageFile,
  cropVideoFrame,
  selfCheck,
  type DetectResult,
} from "../game/detect";
import {
  cooldownRemaining,
  formatMs,
  scansThisHour,
} from "../game/scoring";
import type { BadgeType, GameState } from "../game/types";
import { useNow } from "../hooks";

function cameraConstraints(): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };
}

export function Scanner({
  state,
  onPick,
  onBack,
  error,
}: {
  state: GameState;
  onPick: (type: BadgeType) => void;
  onBack: () => void;
  error: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lowLight, setLowLight] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [check, setCheck] = useState<string | null>(null);
  const insecure = typeof window !== "undefined" && !window.isSecureContext;

  const wait = cooldownRemaining(state);
  const now = useNow(wait > 0);
  const remaining = cooldownRemaining(state, now);
  const hourCount = scansThisHour(state, now);
  const blocked = remaining > 0 || hourCount >= HOURLY_CAP;

  useEffect(() => {
    void selfCheck().then((result) => setCheck(result.detail));
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError(
        insecure
          ? "Phones block live camera on http. Open the https URL, or tap Take a photo."
          : "This browser has no camera API. Use Take a photo.",
      );
      return;
    }
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints());
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();
      }
      setLive(true);
      setCamError(null);
    } catch {
      setCamError("Allow camera when the phone asks, or tap Take a photo.");
    }
  }

  async function handleResult(canvas: HTMLCanvasElement, result: DetectResult) {
    setPreview(canvas.toDataURL("image/jpeg", 0.7));
    if (result.ok) {
      setLowLight(false);
      onPick(result.type);
      return;
    }
    setLowLight(true);
  }

  async function capture() {
    if (!live) {
      await openCamera();
      return;
    }
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame || blocked || busy) return;
    if (!video.videoWidth) {
      setCamError("Camera still warming up — tap Capture again.");
      return;
    }
    setBusy(true);
    setLowLight(false);
    try {
      const canvas = cropVideoFrame(video, frame);
      const result = await classifyCanvas(canvas);
      await handleResult(canvas, result);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file || blocked || busy) return;
    setBusy(true);
    setLowLight(false);
    try {
      const { canvas, result } = await classifyImageFile(file);
      await handleResult(canvas, result);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen scanner">
      <video
        ref={videoRef}
        className="cam-video"
        playsInline
        muted
        autoPlay
      />
      <div className="cam-ui">
        <div className="cam-top">
          <button type="button" className="text-btn back" onClick={onBack}>
            ← Home
          </button>
          <h1>Scan</h1>
        </div>
        <p className="lede cam-hint">
          {live ? "Line up the front of the lanyard" : "Tap Open camera, then hold the pass in the frame"}
        </p>
        {insecure ? (
          <p className="status wait">
            Live camera needs https:// on a phone. Take a photo works on http.
          </p>
        ) : null}
        {error ? <p className="status wait">{error}</p> : null}
        {camError ? <p className="status wait">{camError}</p> : null}
        {remaining > 0 ? (
          <p className="status wait">Cooldown {formatMs(remaining)}</p>
        ) : null}

        <div className="viewfinder">
          <div ref={frameRef} className="frame" />
          {lowLight ? (
            <div className="light-warn" role="alert">
              <strong>Not enough light</strong>
              <p>Move somewhere there is light, then scan the pass again.</p>
            </div>
          ) : null}
        </div>
        {preview && lowLight ? <img className="scan-preview" src={preview} alt="Last capture" /> : null}

        <button
          type="button"
          className="scan-cta"
          onClick={() => void capture()}
          disabled={blocked || busy}
        >
          {busy ? "Reading pass…" : remaining > 0 ? `Wait ${formatMs(remaining)}` : live ? "Capture" : "Open camera"}
        </button>

        <label className="secondary photo-btn">
          Take a photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void onFile(file);
            }}
          />
        </label>
        {check ? <p className="fine">{check}</p> : null}
      </div>
    </div>
  );
}
