import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Pencil, SquareDashedMousePointer } from "lucide-react";

const MIN_BOX_SIZE = 24;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const ManualFaceSelector = ({
  imageSrc,
  photoId,
  autoFacesCount = 0,
  apiBaseUrl = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "http://localhost:8000",
  onSaved,
}) => {
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const [renderSize, setRenderSize] = useState({ width: 1, height: 1 });

  const [isDragging, setIsDragging] = useState(false);
  const [isDrawMode, setIsDrawMode] = useState(autoFacesCount === 0);
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);

  const [manualFace, setManualFace] = useState(null);
  const [step, setStep] = useState("idle"); // idle | confirm | label
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!imageRef.current) {
      return;
    }

    const sync = () => {
      const rect = imageRef.current.getBoundingClientRect();
      setRenderSize({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      });
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(imageRef.current);
    window.addEventListener("resize", sync);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  const toLocalPoint = (event) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }

    return {
      x: clamp(event.clientX - rect.left, 0, renderSize.width),
      y: clamp(event.clientY - rect.top, 0, renderSize.height),
    };
  };

  const buildRect = (start, end) => {
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    return { x: left, y: top, width, height };
  };

  const liveRect = useMemo(() => {
    if (!isDragging || !dragStart || !dragCurrent) {
      return null;
    }
    return buildRect(dragStart, dragCurrent);
  }, [isDragging, dragStart, dragCurrent]);

  const toNaturalRect = (displayRect) => {
    const scaleX = naturalSize.width / Math.max(1, renderSize.width);
    const scaleY = naturalSize.height / Math.max(1, renderSize.height);

    const x = clamp(Math.round(displayRect.x * scaleX), 0, Math.max(0, naturalSize.width - 1));
    const y = clamp(Math.round(displayRect.y * scaleY), 0, Math.max(0, naturalSize.height - 1));
    const width = clamp(Math.round(displayRect.width * scaleX), 1, Math.max(1, naturalSize.width - x));
    const height = clamp(Math.round(displayRect.height * scaleY), 1, Math.max(1, naturalSize.height - y));

    return { x, y, width, height };
  };

  const onMouseDown = (event) => {
    if (isSaving || !isDrawMode) {
      return;
    }

    setError("");
    const point = toLocalPoint(event);
    setDragStart(point);
    setDragCurrent(point);
    setIsDragging(true);
    setManualFace(null);
    setStep("idle");
    setName("");
  };

  const onMouseMove = (event) => {
    if (!isDragging) {
      return;
    }
    setDragCurrent(toLocalPoint(event));
  };

  const onMouseUp = () => {
    if (!isDragging || !dragStart || !dragCurrent) {
      setIsDragging(false);
      return;
    }

    const rect = buildRect(dragStart, dragCurrent);
    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);

    if (rect.width < MIN_BOX_SIZE || rect.height < MIN_BOX_SIZE) {
      setError(`Box is too small. Minimum size is ${MIN_BOX_SIZE}px.`);
      setManualFace(null);
      setStep("idle");
      return;
    }

    setManualFace(rect);
    setStep("confirm");
    setIsDrawMode(false);
  };

  const onConfirm = () => {
    if (!manualFace) {
      return;
    }
    setStep("label");
    setError("");
  };

  const onCancel = () => {
    if (isSaving) {
      return;
    }
    setManualFace(null);
    setStep("idle");
    setName("");
    setError("");
  };

  const onSave = async () => {
    if (!manualFace) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");

      const payload = {
        photoId,
        box: toNaturalRect(manualFace),
        name: trimmedName,
      };

      const response = await fetch(`${String(apiBaseUrl).replace(/\/$/, "")}/api/manual-face`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || "Failed to save manual face label.");
      }

      if (result?.face) {
        onSaved?.(result.face);
      }

      setManualFace(null);
      setStep("idle");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save manual label.");
    } finally {
      setIsSaving(false);
    }
  };

  const activeStep = step === "idle" ? 1 : step === "confirm" ? 2 : 3;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Manual Face Add</p>
          <p className="text-xs text-muted-foreground">
            Draw a box around the missing face, then save a label.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          onClick={() => {
            setError("");
            setManualFace(null);
            setStep("idle");
            setIsDrawMode((prev) => !prev);
          }}
          disabled={isSaving}
        >
          <SquareDashedMousePointer className="h-3.5 w-3.5" />
          {isDrawMode ? "Drawing Enabled" : "Enable Drawing"}
        </button>
      </div>

      {autoFacesCount === 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          No clear face was auto-detected. Use manual mode to create the first face box.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div
          ref={containerRef}
          className={`relative overflow-hidden rounded-xl border border-border bg-card ${isDrawMode ? "cursor-crosshair" : "cursor-default"}`}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => {
            if (isDragging) {
              onMouseUp();
            }
          }}
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Manual face selection"
            className="block max-h-[560px] min-h-[420px] w-full select-none object-contain"
            onLoad={(e) => {
              const img = e.currentTarget;
              setNaturalSize({
                width: Math.max(1, img.naturalWidth || 1),
                height: Math.max(1, img.naturalHeight || 1),
              });

              const rect = img.getBoundingClientRect();
              setRenderSize({
                width: Math.max(1, rect.width),
                height: Math.max(1, rect.height),
              });
            }}
            draggable={false}
          />

          {liveRect && (
            <div
              className="pointer-events-none absolute border-2 border-primary/90 bg-primary/10"
              style={{
                left: liveRect.x,
                top: liveRect.y,
                width: liveRect.width,
                height: liveRect.height,
              }}
            />
          )}

          {manualFace && (
            <div
              className="absolute border-2 border-primary shadow-[0_0_0_2px_rgba(16,185,129,0.22)]"
              style={{
                left: manualFace.x,
                top: manualFace.y,
                width: manualFace.width,
                height: manualFace.height,
              }}
            />
          )}
        </div>

        <aside className="space-y-3 rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Steps</p>
          <div className="space-y-2">
            <div className={`rounded-md border px-3 py-2 text-xs ${activeStep >= 1 ? "border-primary/30 bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
              1. Enable drawing and drag a box over the face.
            </div>
            <div className={`rounded-md border px-3 py-2 text-xs ${activeStep >= 2 ? "border-primary/30 bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
              2. Confirm selected region.
            </div>
            <div className={`rounded-md border px-3 py-2 text-xs ${activeStep >= 3 ? "border-primary/30 bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
              3. Enter the label and save.
            </div>
          </div>

          {step === "confirm" && manualFace && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-foreground">Confirm Selected Face</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  onClick={onConfirm}
                >
                  <Check className="h-3.5 w-3.5" />
                  Confirm
                </button>
                <button
                  type="button"
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground"
                  onClick={onCancel}
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {step === "label" && manualFace && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-foreground">Save Label</p>
              <div className="relative">
                <Pencil className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-xs text-foreground outline-none focus:border-primary"
                  placeholder="Enter person name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSaving}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  onClick={() => {
                    void onSave();
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Label"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground"
                  onClick={onCancel}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default ManualFaceSelector;
