"use client";

// TryItUploader — drag-and-drop, calls /api/remove-bg, shows a
// draggable before/after slider, then offers the email-capture waitlist.
//
// Lives as a client island on the landing page; intentionally simple.
// Mock mode is auto-detected server-side and the result is flagged.

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      inputUrl: string;
      outputUrl: string;
      mocked: boolean;
      email: string;
      saved: boolean;
    };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function fileToBase64Only(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/[a-z]+;base64,/i, "");
}

export default function TryItUploader() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [drag, setDrag] = useState(false);
  const [email, setEmail] = useState("");
  const [signUpBusy, setSignUpBusy] = useState(false);
  const [signUpMsg, setSignUpMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(50);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setPhase({ kind: "error", message: "Please drop an image file." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setPhase({ kind: "error", message: "Image too large (10 MB max)." });
      return;
    }
    setPhase({ kind: "loading" });
    try {
      const dataUrl = await fileToDataUrl(file);
      const base64 = fileToBase64Only(dataUrl);
      const r = await fetch("/api/remove-bg", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const json = await r.json();
      if (!r.ok) {
        throw new Error(json?.error ?? `HTTP ${r.status}`);
      }
      setPhase({
        kind: "ready",
        inputUrl: dataUrl,
        outputUrl: json.outputBase64,
        mocked: !!json.mocked,
        email: "",
        saved: false,
      });
      setSplit(50);
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  // drag-drop wiring
  useEffect(() => {
    if (phase.kind !== "idle") return;
    const el = inputRef.current?.closest("[data-dropzone]") as HTMLElement | null;
    if (!el) return;
    const onOver = (e: DragEvent) => {
      e.preventDefault();
      setDrag(true);
    };
    const onLeave = () => setDrag(false);
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) void handleFile(f);
    };
    el.addEventListener("dragover", onOver);
    el.addEventListener("dragleave", onLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onOver);
      el.removeEventListener("dragleave", onLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, [phase.kind, handleFile]);

  // before/after slider (pointer-based)
  useEffect(() => {
    if (phase.kind !== "ready") return;
    const el = sliderContainerRef.current;
    if (!el) return;
    const onMove = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      setSplit(Math.round((x / rect.width) * 100));
    };
    const onPointerDown = (e: PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onMove(e.clientX);
    };
    const onPointerMove = (e: PointerEvent) => {
      if ((e.buttons & 1) === 0) return;
      onMove(e.clientX);
    };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
    };
  }, [phase.kind]);

  const submitWaitlist = useCallback(async () => {
    if (phase.kind !== "ready" || !email) return;
    setSignUpBusy(true);
    setSignUpMsg(null);
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "try-it" }),
      });
      const json = await r.json();
      if (!r.ok) {
        throw new Error(json?.error ?? `HTTP ${r.status}`);
      }
      setPhase({ ...phase, saved: true });
      setSignUpMsg("Saved! Check your inbox soon.");
    } catch (err) {
      setSignUpMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSignUpBusy(false);
    }
  }, [phase, email]);

  const reset = useCallback(() => {
    setPhase({ kind: "idle" });
    setSignUpMsg(null);
    setEmail("");
  }, []);

  return (
    <div className="w-full max-w-xl mx-auto">
      {phase.kind === "idle" && (
        <div
          data-dropzone
          className={
            "rounded-2xl border-2 border-dashed p-10 text-center transition-colors " +
            (drag
              ? "border-pink-500 bg-pink-50"
              : "border-zinc-300 bg-white hover:border-zinc-400")
          }
        >
          <p className="text-lg font-medium text-zinc-900">
            Drop a product photo here
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            JPG, PNG, HEIC up to 10 MB. Nothing leaves the page.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-5 inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Pick a photo
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </div>
      )}

      {phase.kind === "loading" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-pink-500" />
          <p className="mt-4 text-sm text-zinc-600">
            Removing the background…
          </p>
        </div>
      )}

      {phase.kind === "error" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{phase.message}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 text-sm font-medium text-red-700 underline"
          >
            Try again
          </button>
        </div>
      )}

      {phase.kind === "ready" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div
            ref={sliderContainerRef}
            className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-100 select-none touch-none"
          >
            <img
              src={phase.inputUrl}
              alt="Original"
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
            <div
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${split}%` }}
            >
              <img
                src={phase.outputUrl}
                alt="Background removed"
                className="absolute inset-0 h-full w-full object-contain"
                style={{
                  width: `${100 / (split / 100 || 1)}%`,
                  maxWidth: "none",
                }}
                draggable={false}
              />
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
              style={{ left: `${split}%` }}
            >
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full bg-white text-zinc-700 shadow">
                ⇆
              </div>
            </div>
            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
              Before
            </span>
            <span className="absolute right-2 top-2 rounded-full bg-pink-600/90 px-2 py-0.5 text-xs text-white">
              After
            </span>
            {phase.mocked && (
              <span
                className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-500/90 px-2 py-0.5 text-xs text-white"
                title="REMOVE_BG_API_KEY is not set; the server echoed the input."
              >
                Mock output (no remove.bg key)
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={reset}
              className="text-sm font-medium text-zinc-700 underline"
            >
              Upload another
            </button>
            <a
              href={phase.outputUrl}
              download="productpop-after.png"
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Download result
            </a>
          </div>

          <div
            id="waitlist"
            className="mt-6 rounded-xl border border-pink-100 bg-pink-50/60 p-4"
          >
            {phase.saved ? (
              <p className="text-sm text-pink-900">
                You&apos;re on the list. We&apos;ll email you when we ship the
                next feature.
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-pink-900">
                  Sign up to save your edits
                </p>
                <p className="mt-1 text-xs text-pink-900/70">
                  Be the first to know when we launch. No spam.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitWaitlist();
                  }}
                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                >
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@brand.com"
                    className="flex-1 rounded-full border border-pink-200 bg-white px-4 py-2 text-sm focus:border-pink-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={signUpBusy || !email}
                    className="rounded-full bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50"
                  >
                    {signUpBusy ? "Saving…" : "Sign up"}
                  </button>
                </form>
                {signUpMsg && (
                  <p className="mt-2 text-xs text-pink-900">{signUpMsg}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
