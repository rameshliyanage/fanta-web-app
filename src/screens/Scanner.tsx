import { useCallback, useEffect, useRef, useState } from "react";
import { playTick, unlockCues } from "../game/cues";
import { classifyCanvas, classifyImageFile, cropVideoFrame } from "../game/detect";

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

function trackOf(stream: MediaStream | null): MediaStreamTrack | null {
  return stream?.getVideoTracks()[0] ?? null;
}

function torchSupported(track: MediaStreamTrack | null): boolean {
  if (!track || typeof track.getCapabilities !== "function") return false;
  const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
  return Boolean(caps.torch);
}

async function setTorch(track: MediaStreamTrack, on: boolean) {
  await track.applyConstraints({ advanced: [{ torch: on }] } as unknown as MediaTrackConstraints);
}

let scannerMounts = 0;

export function Scanner({
  onAccept,
  onBack,
  error,
  cameraRequest,
}: {
  onAccept: (canvas: HTMLCanvasElement, code: string) => void;
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
  const [miss, setMiss] = useState(false);
  const [locked, setLocked] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [canFlash, setCanFlash] = useState(false);
  const insecure = typeof window !== "undefined" && !window.isSecureContext;

  const attachStream = useCallback(async (stream: MediaStream) => {
    streamRef.current?.getTracks().forEach((track) => {
      if (!stream.getTracks().includes(track)) track.stop();
    });
    streamRef.current = stream;
    setCanFlash(torchSupported(trackOf(stream)));
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
    scannerMounts += 1;
    let cancelled = false;
    setOpening(true);
    const incoming = cameraRequest ?? requestCamera();
    incoming
      .then(async (stream) => {
        if (cancelled || scannerMounts === 0) {
          if (scannerMounts === 0) stream.getTracks().forEach((track) => track.stop());
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

  async function toggleFlash() {
    const track = trackOf(streamRef.current);
    if (!track) return;
    const next = !flashOn;
    try {
      await setTorch(track, next);
      setFlashOn(next);
    } catch {
      setCanFlash(false);
    }
  }

  async function handleCanvas(canvas: HTMLCanvasElement) {
    const result = await classifyCanvas(canvas);
    if (!result.ok && result.reason === "dark") {
      setLowLight(true);
      setMiss(false);
      return;
    }
    setLowLight(false);
    if (result.ok) {
      setMiss(false);
      setLocked(true);
      unlockCues();
      playTick();
      window.setTimeout(() => onAccept(canvas, result.code), 280);
      return;
    }
    setMiss(true);
  }

  async function capture() {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame || busy) return;
    if (!video.videoWidth) {
      setCamError("Camera still warming up — tap Capture again.");
      return;
    }
    setBusy(true);
    setLowLight(false);
    setMiss(false);
    try {
      await handleCanvas(cropVideoFrame(video, frame));
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setLowLight(false);
    setMiss(false);
    try {
      const { canvas, result } = await classifyImageFile(file);
      if (!result.ok && result.reason === "dark") {
        setLowLight(true);
        return;
      }
      if (result.ok) {
        setLocked(true);
        unlockCues();
        playTick();
        window.setTimeout(() => onAccept(canvas, result.code), 280);
        return;
      }
      setMiss(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen scanner">
      <div className="cam-ui">
        <div className="cam-top">
          <button type="button" className="pill" onClick={onBack}>
            <span aria-hidden="true">‹</span> Back to home
          </button>
        </div>
        <h1>SCAN A BADGE</h1>
        {insecure ? (
          <p className="status wait">Live camera needs https:// on a phone. Take a photo works on http.</p>
        ) : null}
        {error ? <p className="status wait">{error}</p> : null}
        {camError ? <p className="status wait">{camError}</p> : null}
        <div className={locked ? "viewfinder is-locked" : "viewfinder"}>
          <p className="live-tag">{live ? "LIVE CAMERA FEED" : opening ? "OPENING CAMERA" : "CAMERA OFF"}</p>
          <video ref={videoRef} className="cam-video" playsInline muted autoPlay />
          <div ref={frameRef} className="frame">
            <div className="ghost-card" aria-hidden="true">
              <div className="ghost-header" />
              <div className="ghost-line" />
              <div className="ghost-line" />
              <div className="ghost-footer" />
              <i className="ghost-mark tl" />
              <i className="ghost-mark tr" />
              <i className="ghost-mark bl" />
              <i className="ghost-mark br" />
            </div>
          </div>
          {lowLight ? (
            <div className="light-warn" role="alert">
              <strong>{canFlash ? "It’s dim — turn on the flash" : "Not enough light"}</strong>
              <p>
                {canFlash
                  ? "Use the flash button, then capture the card again."
                  : "Move somewhere there is light, then scan the card again."}
              </p>
            </div>
          ) : null}
          <p className="fit-hint">Fit the badge QR code in the box</p>
          {miss ? (
            <div className="light-warn" role="status">
              <strong>Hold the card in the guide</strong>
              <p>Fill the frame and hold still so the code can be read.</p>
            </div>
          ) : null}
        </div>
        <div className="cam-dock">
          <button
            type="button"
            className="scan-cta"
            onClick={() => {
              unlockCues();
              void (live ? capture() : openCamera());
            }}
            disabled={busy || opening}
          >
            {busy ? "READING…" : opening ? "OPENING…" : live ? "CAPTURE" : "OPEN CAMERA"}
          </button>
          {canFlash ? (
            <button type="button" className="secondary" onClick={() => void toggleFlash()}>
              {flashOn ? "FLASH ON" : "FLASH"}
            </button>
          ) : null}
          <label className="photo-btn">
            TAKE PHOTO
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(event) => {
                unlockCues();
                const file = event.target.files?.[0];
                event.target.value = "";
                void onFile(file);
              }}
            />
          </label>
        </div>
        <section className="how-scan">
          <h2>HOW TO SCAN</h2>
          <ol>
            <li>Ask a visitor to hold up their event badge.</li>
            <li>Line up the QR code inside the box and tap Capture.</li>
            <li>QR won’t read? Tap Take photo of the whole badge instead.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
