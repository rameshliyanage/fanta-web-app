import { useCallback, useEffect, useRef, useState } from "react";
import { BADGES, HOURLY_CAP } from "../game/constants";
import {
  classifyCanvas,
  classifyImageFile,
  cropVideoFrame,
  selfCheck,
  type DetectResult,
  type ScoreRow,
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

export function requestCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error("no-camera"));
  }
  return navigator.mediaDevices.getUserMedia(cameraConstraints());
}

function cameraErrorMessage(insecure: boolean, reason: unknown): string {
  if (insecure) {
    return "Phones block live camera on http. Open the https URL, or tap Take a photo.";
  }
  if (reason instanceof Error && reason.message === "no-camera") {
    return "This browser has no camera API. Use Take a photo.";
  }
  return "Allow camera when the phone asks, or tap Take a photo.";
}

// Survives React StrictMode's mount/unmount/remount so the first cleanup
// does not stop a camera that the remounted screen still needs.
let scannerMounts = 0;

export function Scanner({
  state,
  onPick,
  onBack,
  error,
  cameraRequest,
}: {
  state: GameState;
  onPick: (type: BadgeType) => void;
  onBack: () => void;
  error: string | null;
  cameraRequest: Promise<MediaStream> | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [opening, setOpening] = useState(true);
  const [camError, setCamError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lowLight, setLowLight] = useState(false);
  const [scores, setScores] = useState<ScoreRow[] | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [check, setCheck] = useState<string | null>(null);
  const insecure = typeof window !== "undefined" && !window.isSecureContext;

  const wait = cooldownRemaining(state);
  const now = useNow(wait > 0);
  const remaining = cooldownRemaining(state, now);
  const hourCount = scansThisHour(state, now);
  const blocked = remaining > 0 || hourCount >= HOURLY_CAP;

  const attachStream = useCallback(async (stream: MediaStream) => {
    streamRef.current?.getTracks().forEach((track) => {
      if (!stream.getTracks().includes(track)) track.stop();
    });
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    await video.play();
    setLive(true);
    setOpening(false);
    setCamError(null);
  }, []);

  useEffect(() => {
    void selfCheck().then((result) => setCheck(result.detail));
  }, []);

  useEffect(() => {
    scannerMounts += 1;
    let cancelled = false;
    setOpening(true);
    const incoming = cameraRequest ?? requestCamera();
    incoming
      .then(async (stream) => {
        if (cancelled || scannerMounts === 0) {
          if (scannerMounts === 0) {
            stream.getTracks().forEach((track) => track.stop());
          }
          return;
        }
        await attachStream(stream);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setOpening(false);
        setLive(false);
        setCamError(cameraErrorMessage(insecure, reason));
      });
    return () => {
      cancelled = true;
      scannerMounts -= 1;
      if (scannerMounts === 0) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [attachStream, cameraRequest, insecure]);

  async function openCamera() {
    setOpening(true);
    setCamError(null);
    try {
      await attachStream(await requestCamera());
    } catch (reason) {
      setOpening(false);
      setLive(false);
      setCamError(cameraErrorMessage(insecure, reason));
    }
  }

  async function handleResult(canvas: HTMLCanvasElement, result: DetectResult) {
    setPreview(canvas.toDataURL("image/jpeg", 0.7));
    if (!result.ok && result.reason === "dark") {
      setScores(null);
      setLowLight(true);
      return;
    }
    setLowLight(false);
    if (result.ok) {
      setScores(null);
      onPick(result.type);
      return;
    }
    setScores(result.scores);
  }

  async function capture() {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame || blocked || busy) return;
    if (!video.videoWidth) {
      setCamError("Camera still warming up — tap Capture again.");
      return;
    }
    setBusy(true);
    setLowLight(false);
    setScores(null);
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
    setScores(null);
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
          {live
            ? "Line up the front of the participant badge"
            : opening
              ? "Opening the camera…"
              : "Allow the camera, then hold the badge in the frame"}
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
          {scores && scores.length > 0 ? (
            <div className="score-overlay" role="status" aria-label="Match scores">
              <strong>Match scores</strong>
              <ul>
                {scores.map((row) => {
                  const badge = BADGES.find((item) => item.id === row.type);
                  const width = Math.round(Math.max(0, Math.min(1, row.score)) * 100);
                  return (
                    <li key={row.type}>
                      <span>{badge?.label ?? row.type}</span>
                      <span className="score-track">
                        <span className="score-fill" style={{ width: `${width}%` }} />
                      </span>
                      <span className="score-num">{row.score.toFixed(2)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {preview && (lowLight || scores) ? (
            <img className="scan-preview" src={preview} alt="Last capture" />
          ) : null}
        </div>

        <button
          type="button"
          className="scan-cta"
          onClick={() => void (live ? capture() : openCamera())}
          disabled={blocked || busy || opening}
        >
          {busy
            ? "Reading pass…"
            : remaining > 0
              ? `Wait ${formatMs(remaining)}`
              : opening
                ? "Opening camera…"
                : live
                  ? "Capture"
                  : "Open camera"}
        </button>

        {/* Testing only — remove file upload in the final build. */}
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
