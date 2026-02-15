import { useEffect, useMemo, useRef, useState } from "react";

const COLOR_MATCHED = "#22c55e";
const COLOR_AMBIGUOUS = "#3b82f6";
const COLOR_UNKNOWN = "#ffffff";

const toRgba = (hex, alpha) => {
  const normalized = String(hex || "").replace("#", "");
  if (normalized.length !== 6) {
    return `rgba(255,255,255,${alpha})`;
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getFaceStatus = (face) => {
  if (face?.learningConfirmed) {
    return "matched";
  }

  if (face?.faceMatchStatus === "ambiguous") {
    return "ambiguous";
  }

  if (face?.faceMatchStatus === "matched") {
    return "matched";
  }

  const similarity = Number(face?.similarity || 0);
  const similarityGap = Number(face?.similarityGap || 0);
  const hasKnownName = String(face?.name || "").trim().toLowerCase() !== "unknown";

  if (hasKnownName && similarity >= 0.95 && similarityGap < 0.02) {
    return "ambiguous";
  }

  if (hasKnownName) {
    return "matched";
  }

  return "unknown";
};

const getFaceColor = (face) => {
  const status = getFaceStatus(face);
  if (status === "matched") {
    return COLOR_MATCHED;
  }
  if (status === "ambiguous") {
    return COLOR_AMBIGUOUS;
  }
  return COLOR_UNKNOWN;
};

const FaceOverlayLabeler = ({
  imageSrc,
  faces,
  isBusy,
  onSaveLabel,
  activeFaceId: controlledActiveFaceId = null,
  onActiveFaceChange,
}) => {
  const imageRef = useRef(null);
  const [renderSize, setRenderSize] = useState({ width: 1, height: 1 });
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const [internalActiveFaceId, setInternalActiveFaceId] = useState(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [localError, setLocalError] = useState("");
  const activeFaceId = controlledActiveFaceId ?? internalActiveFaceId;

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

  const onImageLoad = (e) => {
    const img = e.currentTarget;
    setNaturalSize({
      width: Math.max(1, img.naturalWidth || 1),
      height: Math.max(1, img.naturalHeight || 1),
    });
    const rect = img.getBoundingClientRect();
    setRenderSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
  };

  const scaleX = renderSize.width / Math.max(1, naturalSize.width);
  const scaleY = renderSize.height / Math.max(1, naturalSize.height);

  const scaledFaces = useMemo(() => {
    return (Array.isArray(faces) ? faces : []).map((face) => {
      const x = Number(face?.box?.x || 0);
      const y = Number(face?.box?.y || 0);
      const width = Number(face?.box?.width || 1);
      const height = Number(face?.box?.height || 1);

      return {
        ...face,
        rect: {
          left: x * scaleX,
          top: y * scaleY,
          width: Math.max(1, width * scaleX),
          height: Math.max(1, height * scaleY),
        },
      };
    });
  }, [faces, scaleX, scaleY]);

  const activeFace = scaledFaces.find((face) => face.faceId === activeFaceId) || null;

  useEffect(() => {
    if (!activeFaceId) {
      return;
    }
    const focusFace = scaledFaces.find((face) => face.faceId === activeFaceId);
    if (!focusFace) {
      return;
    }
    setDraftLabel((current) => (current.trim().length > 0 ? current : focusFace.name && focusFace.name !== "unknown" ? focusFace.name : ""));
  }, [activeFaceId, scaledFaces]);

  const setActiveFace = (nextFaceId) => {
    if (typeof onActiveFaceChange === "function") {
      onActiveFaceChange(nextFaceId);
      return;
    }
    setInternalActiveFaceId(nextFaceId);
  };

  const onSelectFace = (face) => {
    setLocalError("");
    if (isBusy) {
      return;
    }
    if (activeFaceId && activeFaceId !== face.faceId) {
      return;
    }

    setActiveFace(face.faceId);
    setDraftLabel(face.name && face.name !== "unknown" ? face.name : "");
  };

  const onCancel = () => {
    if (isBusy) {
      return;
    }
    setActiveFace(null);
    setDraftLabel("");
    setLocalError("");
  };

  const onSave = async () => {
    if (!activeFace) {
      return;
    }

    const name = draftLabel.trim();
    if (!name) {
      setLocalError("Please enter a name.");
      return;
    }

    setLocalError("");
    await onSaveLabel(activeFace.faceId, name);
    setActiveFace(null);
    setDraftLabel("");
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const getEditorPosition = (rect) => {
    const editorWidth = 240;
    const editorHeight = 40;
    const gap = 8;

    const left = clamp(rect.left, 0, Math.max(0, renderSize.width - editorWidth));
    const topAbove = rect.top - editorHeight - gap;
    const top =
      topAbove > 0
        ? topAbove
        : clamp(rect.top + rect.height + gap, 0, Math.max(0, renderSize.height - editorHeight));

    return { left, top };
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <img
        ref={imageRef}
        src={imageSrc}
        alt="Uploaded preview"
        className="block w-full object-cover"
        onLoad={onImageLoad}
      />

      <div className="pointer-events-none absolute inset-0">
        {scaledFaces.map((face, index) => {
          const isActive = face.faceId === activeFaceId;
          const disabled = Boolean(activeFaceId && activeFaceId !== face.faceId) || isBusy;
          const color = getFaceColor(face);
          const isUnknown = getFaceStatus(face) === "unknown";

          return (
            <button
              key={face.faceId}
              type="button"
              onClick={() => onSelectFace(face)}
              disabled={disabled}
              className={`pointer-events-auto absolute rounded-md border-2 transition-all duration-200 ${
                disabled ? "opacity-45" : "opacity-100"
              }`}
              style={{
                left: face.rect.left,
                top: face.rect.top,
                width: face.rect.width,
                height: face.rect.height,
                borderColor: color,
                boxShadow: isActive
                  ? `0 0 0 3px ${toRgba(color, 0.35)}`
                  : isUnknown
                    ? "0 0 0 1px rgba(0,0,0,0.3) inset"
                    : "none",
              }}
              aria-label={`Face ${index + 1}`}
            >
              <span
                className={`absolute -top-4 left-0 rounded px-1 py-[1px] text-[9px] font-semibold leading-none ${
                  isUnknown ? "text-black" : "text-white"
                }`}
                style={{ backgroundColor: toRgba(color, 0.78) }}
              >
                {(face.orderIndex ?? index) + 1}
              </span>
            </button>
          );
        })}
      </div>

      {activeFace && (
        <div
          className="absolute z-20 flex items-center gap-2 rounded-lg border border-border bg-background/95 p-2 shadow-lg backdrop-blur transition-all duration-200"
          style={getEditorPosition(activeFace.rect)}
        >
          <input
            className="w-36 rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary"
            placeholder="Enter name"
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            disabled={isBusy}
            autoFocus
          />
          <button
            type="button"
            className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            onClick={() => {
              void onSave();
            }}
            disabled={isBusy}
          >
            {isBusy ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-xs text-foreground disabled:opacity-60"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </button>
        </div>
      )}

      {localError && <p className="absolute bottom-2 left-2 rounded bg-destructive/90 px-2 py-1 text-[10px] text-destructive-foreground">{localError}</p>}
    </div>
  );
};

export default FaceOverlayLabeler;
