import { useEffect, useMemo, useRef, useState } from "react";

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

  const toNaturalRect = (displayRect) => {
    const scaleX = naturalSize.width / Math.max(1, renderSize.width);
    const scaleY = naturalSize.height / Math.max(1, renderSize.height);

    const x = clamp(Math.round(displayRect.x * scaleX), 0, Math.max(0, naturalSize.width - 1));
    const y = clamp(Math.round(displayRect.y * scaleY), 0, Math.max(0, naturalSize.height - 1));
    const width = clamp(
      Math.round(displayRect.width * scaleX),
      1,
      Math.max(1, naturalSize.width - x)
    );
    const height = clamp(
      Math.round(displayRect.height * scaleY),
      1,
      Math.max(1, naturalSize.height - y)
    );

    return { x, y, width, height };
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

  return (
    <div className="space-y-2">
      {autoFacesCount === 0 && (
        <p className="text-xs text-muted-foreground">
          No clear face detected. Draw a box to label manually.
        </p>
      )}

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
            className="pointer-events-none absolute border-2 border-primary/90 bg-primary/15 transition-all duration-75"
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
            className="absolute border-2 border-primary shadow-[0_0_0_2px_rgba(99,102,241,0.25)] transition-all duration-200"
            style={{
              left: manualFace.x,
              top: manualFace.y,
              width: manualFace.width,
              height: manualFace.height,
            }}
          />
        )}

        {manualFace && step === "confirm" && (
          <div
            className="absolute z-20 flex items-center gap-2 rounded-lg border border-border bg-background/95 p-2 shadow-lg backdrop-blur"
            style={{
              left: clamp(manualFace.x, 0, Math.max(0, renderSize.width - 210)),
              top: clamp(manualFace.y - 46, 0, Math.max(0, renderSize.height - 46)),
            }}
          >
            <button
              type="button"
              className="rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
              onClick={onConfirm}
            >
              Confirm Face
            </button>
            <button
              type="button"
              className="rounded border border-border px-3 py-1 text-xs"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        )}

        {manualFace && step === "label" && (
          <div
            className="absolute z-20 flex items-center gap-2 rounded-lg border border-border bg-background/95 p-2 shadow-lg backdrop-blur"
            style={{
              left: clamp(manualFace.x, 0, Math.max(0, renderSize.width - 280)),
              top: clamp(manualFace.y - 46, 0, Math.max(0, renderSize.height - 46)),
            }}
          >
            <input
              className="w-36 rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary"
              placeholder="Enter name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
            <button
              type="button"
              className="rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              onClick={() => {
                void onSave();
              }}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Label"}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          onClick={() => {
            setError("");
            setManualFace(null);
            setStep("idle");
            setIsDrawMode((prev) => !prev);
          }}
          disabled={isSaving}
        >
          {isDrawMode ? "Stop Drawing" : "Start Drawing Face Box"}
        </button>
        {isDrawMode && (
          <span className="text-[10px] text-muted-foreground">
            Drag on image to select missing face
          </span>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default ManualFaceSelector;
