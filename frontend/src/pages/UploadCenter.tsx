import { useRef, useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Sparkles, Upload, UserRoundPlus, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { confirmPhotoLabelsApi, labelFaceApi, uploadPhotosApi, type UploadedPhoto } from "@/lib/api";
import { resolvePhotoUrl } from "@/lib/utils";
import FaceOverlayLabeler from "@/components/face/FaceOverlayLabeler";
import ManualFaceSelector from "@/components/face/ManualFaceSelector";

const FACE_MATCH_MIN_SIMILARITY = 0.95;
const FACE_AMBIGUOUS_MAX_GAP = 0.02;
const INVALID_LABELS = new Set(["unknown", "unknown_person", "unknown person"]);

const getFaceStatus = (face: UploadedPhoto["faces"][number]) => {
  if (face.learningConfirmed) {
    return "matched";
  }

  if (face.faceMatchStatus === "ambiguous") {
    return "ambiguous";
  }

  if (face.faceMatchStatus === "matched") {
    return "matched";
  }

  const similarity = Number(face.similarity || 0);
  const similarityGap = Number(face.similarityGap || 0);
  const hasKnownName = String(face.name || "").trim().toLowerCase() !== "unknown";
  if (hasKnownName && similarity >= FACE_MATCH_MIN_SIMILARITY && similarityGap < FACE_AMBIGUOUS_MAX_GAP) {
    return "ambiguous";
  }
  if (hasKnownName) {
    return "matched";
  }
  return "unknown";
};

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
};

const UploadCenter = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLabelSaving, setIsLabelSaving] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [confirmingPhotoId, setConfirmingPhotoId] = useState<string | null>(null);
  const [faceOrder, setFaceOrder] = useState<"left_to_right" | "right_to_left">("left_to_right");
  const [manualModeByPhoto, setManualModeByPhoto] = useState<Record<string, boolean>>({});
  const [focusedFaceIdByPhoto, setFocusedFaceIdByPhoto] = useState<Record<string, string | null>>({});
  const [selectedCandidateByFace, setSelectedCandidateByFace] = useState<Record<string, string>>({});
  const [customLabelByFace, setCustomLabelByFace] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [scanningPhotoIds, setScanningPhotoIds] = useState<Set<string>>(new Set());

  const onSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    setError("");
    if (import.meta.env.DEV) {
      console.debug(
        "[upload] selected files",
        files.map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
        }))
      );
    }
  };

  // Effect to trigger scanning animation for new photos and scroll to them
  useEffect(() => {
    if (uploadedPhotos.length > 0) {
      // Scroll to results
      if (resultsRef.current) {
        // slight delay to allow rendering
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 500);
      }

      const newIds = uploadedPhotos
        .filter(p => !p.faces.every(f => f.learningConfirmed)) // heuristic: treat as "new" if not fully confirmed? Or just track seen IDs.
        .map(p => p.photoId);
    }
  }, [uploadedPhotos.length]);

  // Implementation strategy change:
  // Modify `onUpload` to add IDs to `scanningPhotoIds`.
  // Add a `useEffect` that watches `scanningPhotoIds` and sets timeouts to remove them.

  useEffect(() => {
    if (scanningPhotoIds.size > 0) {
      const timers: NodeJS.Timeout[] = [];
      scanningPhotoIds.forEach(id => {
        const timer = setTimeout(() => {
          setScanningPhotoIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 7000); // 7 seconds = approx 3.5 scanner loops (2s duration)
        timers.push(timer);
      });
      return () => timers.forEach(t => clearTimeout(t));
    }
  }, [scanningPhotoIds]);

  const onUpload = async () => {
    if (import.meta.env.DEV) {
      console.debug("[upload] button clicked", { selectedFiles: selectedFiles.length });
    }

    if (selectedFiles.length === 0) {
      setError("Please select at least one photo.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError("");
    setManualModeByPhoto({});
    setFocusedFaceIdByPhoto({});
    setSelectedCandidateByFace({});
    setCustomLabelByFace({});

    setUploadedPhotos([]);

    // We will add to scanning set as they arrive
    const totalFiles = selectedFiles.length;
    let successCount = 0;
    let failCount = 0;

    try {
      // Process files one by one to show progress
      for (let i = 0; i < totalFiles; i++) {
        const file = selectedFiles[i];

        let fileSimulatedProgress = 0;
        const progressInterval = setInterval(() => {
          fileSimulatedProgress = Math.min(fileSimulatedProgress + (Math.random() * 10 + 5), 90);
          const currentTotal = ((i * 100) + fileSimulatedProgress) / totalFiles;
          setUploadProgress(Math.round(currentTotal));
        }, 500);

        try {
          const data = await uploadPhotosApi([file], faceOrder);

          if (data.photos && data.photos.length > 0) {
            // Trigger Scan Animation for new photos
            const newIds = data.photos.map(p => p.photoId);
            setScanningPhotoIds(prev => {
              const next = new Set(prev);
              newIds.forEach(id => next.add(id));
              return next;
            });

            setUploadedPhotos((prev) => [...prev, ...data.photos]);
          }
          successCount++;
        } catch (err) {
          console.error(`Failed to upload file ${file.name}:`, err);
          failCount++;
        } finally {
          clearInterval(progressInterval);
          setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
        }
      }

      if (failCount > 0) {
        setError(`Completed with issues: ${successCount} uploaded, ${failCount} failed.`);
      }

      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload process failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const onLabelFace = async (faceId: string, nameFromOverlay?: string) => {
    const name = (nameFromOverlay || "").trim();
    if (!name) {
      setError("Please enter a name before saving a face label.");
      return;
    }
    if (INVALID_LABELS.has(name.toLowerCase())) {
      setError('Please enter a real person name. "unknown" is not allowed as a saved label.');
      return;
    }

    try {
      setIsLabelSaving(true);
      setError("");
      const result = await labelFaceApi(faceId, name);
      setUploadedPhotos((prev) =>
        prev.map((photo) => ({
          ...photo,
          faces: photo.faces.map((face) =>
            face.faceId === faceId
              ? {
                ...face,
                name: result.name,
                personId: result.personId,
                learningConfirmed: result.learningConfirmed ?? true,
                faceMatchStatus: "matched",
              }
              : face
          ),
        }))
      );
      setSelectedCandidateByFace((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, faceId)) {
          return prev;
        }
        const next = { ...prev };
        delete next[faceId];
        return next;
      });
      setCustomLabelByFace((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, faceId)) {
          return prev;
        }
        const next = { ...prev };
        delete next[faceId];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save face label.");
    } finally {
      setIsLabelSaving(false);
    }
  };

  const onManualFaceSaved = (
    photoId: string,
    manualFace: {
      faceId: string;
      box: { x: number; y: number; width: number; height: number };
      personId: string;
      name: string;
      confidence: number;
      learningConfirmed: boolean;
    }
  ) => {
    setUploadedPhotos((prev) =>
      prev.map((photo) =>
        photo.photoId !== photoId
          ? photo
          : {
            ...photo,
            faces: [...photo.faces, manualFace],
          }
      )
    );
    setManualModeByPhoto((prev) => ({ ...prev, [photoId]: false }));
  };

  const onConfirmAllLabels = async (photoId: string) => {
    try {
      setError("");
      setConfirmingPhotoId(photoId);
      const result = await confirmPhotoLabelsApi(photoId);
      const confirmedFaceIdSet = new Set(result.confirmedFaceIds || []);

      setUploadedPhotos((prev) =>
        prev.map((photo) =>
          photo.photoId !== photoId
            ? photo
            : {
              ...photo,
              faces: photo.faces.map((face) =>
                confirmedFaceIdSet.has(face.faceId) || (face.personId && face.learningConfirmed !== true)
                  ? { ...face, learningConfirmed: true, faceMatchStatus: "matched" }
                  : face
              ),
            }
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm photo labels.");
    } finally {
      setConfirmingPhotoId(null);
    }
  };

  const progressValue = isUploading ? uploadProgress : uploadedPhotos.length > 0 ? 100 : 0;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Upload Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload photos, review detected faces, and correct labels with a clean workflow.
          </p>
        </div>
        <div className="hidden items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-medium text-primary md:flex">
          <Sparkles className="h-4 w-4" />
          AI Assisted Labeling
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/40 p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-foreground">Upload New Photos</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Supported formats: JPG, PNG, HEIC, WEBP. Max file size: 10MB per image.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onSelectFiles}
            />

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Photos
              </button>
              <button
                className="rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={onUpload}
                disabled={isUploading || selectedFiles.length === 0}
              >
                {isUploading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Uploading...</span>
                  </div>
                ) : (
                  `Start Upload${selectedFiles.length ? ` (${selectedFiles.length})` : ""}`
                )}
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Face order:</span>
              <select
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                value={faceOrder}
                onChange={(e) => setFaceOrder(e.target.value as "left_to_right" | "right_to_left")}
              >
                <option value="left_to_right">Left to Right</option>
                <option value="right_to_left">Right to Left</option>
              </select>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Session Status</p>
                {isUploading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
              <span className="text-lg font-bold text-primary">{progressValue}%</span>
            </div>
            <Progress value={progressValue} className="mt-3 h-2" />

            <p className="mt-3 text-xs text-muted-foreground">
              {isUploading
                ? `Processing photo ${Math.min(uploadedPhotos.length + 1, selectedFiles.length)} of ${selectedFiles.length}...`
                : uploadedPhotos.length > 0
                  ? `${uploadedPhotos.length} photo${uploadedPhotos.length === 1 ? "" : "s"} indexed`
                  : selectedFiles.length > 0
                    ? `${selectedFiles.length} photo${selectedFiles.length === 1 ? "" : "s"} ready to upload`
                    : "No active upload"}
            </p>

            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-foreground">Queued Files</p>
                <div className="max-h-36 space-y-1 overflow-auto pr-1">
                  {selectedFiles.slice(0, 6).map((file) => (
                    <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between rounded-md border border-border/70 bg-muted/40 px-2 py-1.5 text-xs">
                      <span className="max-w-[180px] truncate text-foreground">{file.name}</span>
                      <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                    </div>
                  ))}
                  {selectedFiles.length > 6 && (
                    <p className="text-xs text-muted-foreground">+ {selectedFiles.length - 6} more file(s)</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section ref={resultsRef} className="min-h-screen scroll-mt-4 pb-24">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Upload Preview</h2>
          <Badge variant="secondary" className="text-xs">
            {isUploading ? "Analyzing" : "Ready for Review"}
          </Badge>
        </div>

        {uploadedPhotos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Uploaded photos will appear here with face boxes and labeling actions.
          </div>
        ) : (
          <div className="space-y-8">
            {uploadedPhotos.map((photo, photoIndex) => {
              const isManualMode = Boolean(manualModeByPhoto[photo.photoId]);
              const unresolvedCount = photo.faces.filter((face) => !face.personId).length;
              const pendingConfirmCount = photo.faces.filter((face) => face.personId && !face.learningConfirmed).length;
              const isConfirmingThisPhoto = confirmingPhotoId === photo.photoId;
              return (
                <article key={photo.photoId} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 transition-all duration-500 ease-in-out hover:shadow-md">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Photo {photoIndex + 1}</h3>
                      <p className="text-xs text-muted-foreground">
                        {photo.faces.length} detected face{photo.faces.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {photo.faces.length > 0 && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                          onClick={() =>
                            setManualModeByPhoto((prev) => ({
                              ...prev,
                              [photo.photoId]: !prev[photo.photoId],
                            }))
                          }
                        >
                          <UserRoundPlus className="h-3.5 w-3.5" />
                          {isManualMode ? "Back to Auto View" : "Add Missing Face"}
                        </button>
                      )}
                    </div>
                  </div>

                  {photo.faces.length === 0 || isManualMode ? (
                    <ManualFaceSelector
                      imageSrc={resolvePhotoUrl(photo.imageUrl)}
                      photoId={photo.photoId}
                      autoFacesCount={photo.faces.length}
                      onSaved={(face) => onManualFaceSaved(photo.photoId, face)}
                    />
                  ) : (
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="space-y-3">
                        <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-xl border border-border bg-muted/30 shadow-sm">
                          <FaceOverlayLabeler
                            imageSrc={resolvePhotoUrl(photo.imageUrl)}
                            faces={photo.faces}
                            isBusy={isLabelSaving}
                            onSaveLabel={onLabelFace}
                            activeFaceId={focusedFaceIdByPhoto[photo.photoId] || null}
                            onActiveFaceChange={(faceId) =>
                              setFocusedFaceIdByPhoto((prev) => ({
                                ...prev,
                                [photo.photoId]: faceId,
                              }))
                            }
                          />
                          {/* Scanner Effect */}
                          {scanningPhotoIds.has(photo.photoId) && (
                            <>
                              <div className="pointer-events-none absolute inset-x-0 -top-1 h-1 bg-primary/80 shadow-[0_0_20px_2px_theme(colors.primary.DEFAULT)] animate-scan z-20 opacity-60"></div>
                              <div className="pointer-events-none absolute inset-0 bg-primary/5 z-10 animate-pulse-soft"></div>
                            </>
                          )}
                        </div>
                        <p className="flex justify-center items-center gap-2 text-xs text-muted-foreground">
                          <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                          <span>
                            {scanningPhotoIds.has(photo.photoId)
                              ? "Scanning for faces..."
                              : "AI Analysis complete. Click a box to edit."}
                          </span>
                        </p>
                      </div>

                      <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
                        <p className="text-sm font-semibold text-foreground">Detected People</p>

                        {scanningPhotoIds.has(photo.photoId) ? (
                          <div className="space-y-3 py-4">
                            <div className="h-12 w-full animate-pulse rounded-lg bg-muted/50"></div>
                            <div className="h-12 w-full animate-pulse rounded-lg bg-muted/50"></div>
                            <p className="text-center text-xs text-muted-foreground animate-pulse">Identifying...</p>
                          </div>
                        ) : (
                          photo.faces.map((face, index) => {
                            const status = getFaceStatus(face);
                            const personLabel = `Person ${(face.orderIndex ?? index) + 1}`;
                            const candidates =
                              Array.isArray(face.candidateNames) && face.candidateNames.length > 0
                                ? face.candidateNames
                                : face.name && face.name !== "unknown"
                                  ? [{ name: face.name, similarity: Number(face.similarity || 0) }]
                                  : [];
                            const selectedName = selectedCandidateByFace[face.faceId] || candidates[0]?.name || "";
                            const customLabel = customLabelByFace[face.faceId] || "";
                            const isFocused = (focusedFaceIdByPhoto[photo.photoId] || null) === face.faceId;

                            return (
                              <div
                                key={face.faceId}
                                className={`rounded-lg border bg-card p-3 transition-all ${isFocused
                                  ? "border-primary shadow-[0_0_0_2px_rgba(59,130,246,0.18)]"
                                  : "border-border"
                                  }`}
                                onClick={() =>
                                  setFocusedFaceIdByPhoto((prev) => ({
                                    ...prev,
                                    [photo.photoId]: face.faceId,
                                  }))
                                }
                              >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium text-foreground">{personLabel}</p>
                                  {status === "matched" ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                      <CheckCircle2 className="h-3 w-3" /> Matched
                                    </span>
                                  ) : status === "ambiguous" ? (
                                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                                      Needs confirmation
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                      Unknown
                                    </span>
                                  )}
                                </div>

                                {status === "matched" ? (
                                  <p className="text-xs text-muted-foreground">
                                    {face.learningConfirmed ? (
                                      <>
                                        Saved as{" "}
                                        <span className={isFocused ? "rounded bg-primary/15 px-1 text-foreground" : "text-foreground"}>
                                          {face.name}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        Matched as{" "}
                                        <span className={isFocused ? "rounded bg-primary/15 px-1 text-foreground" : "text-foreground"}>
                                          {face.name}
                                        </span>
                                        . Confirm from box if needed.
                                      </>
                                    )}
                                  </p>
                                ) : status === "ambiguous" ? (
                                  <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground">Choose existing candidate or save a new label.</p>
                                    {candidates.slice(0, 3).length > 0 && (
                                      <div className="flex flex-col gap-2 sm:flex-row">
                                        <select
                                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
                                          value={selectedName}
                                          onChange={(e) =>
                                            setSelectedCandidateByFace((prev) => ({
                                              ...prev,
                                              [face.faceId]: e.target.value,
                                            }))
                                          }
                                          disabled={isLabelSaving}
                                        >
                                          {candidates.slice(0, 3).map((candidate) => (
                                            <option key={`${face.faceId}-${candidate.name}`} value={candidate.name}>
                                              {candidate.name} ({Number(candidate.similarity || 0).toFixed(3)})
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          className="rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                                          disabled={isLabelSaving || !selectedName}
                                          onClick={() => {
                                            void onLabelFace(face.faceId, selectedName);
                                          }}
                                        >
                                          {isLabelSaving ? "Saving..." : "Confirm"}
                                        </button>
                                      </div>
                                    )}

                                    <div className="flex flex-col gap-2 sm:flex-row">
                                      <input
                                        type="text"
                                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
                                        placeholder="Enter new label"
                                        value={customLabel}
                                        onChange={(e) =>
                                          setCustomLabelByFace((prev) => ({
                                            ...prev,
                                            [face.faceId]: e.target.value,
                                          }))
                                        }
                                        disabled={isLabelSaving}
                                      />
                                      <button
                                        type="button"
                                        className="rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={isLabelSaving || !customLabel.trim()}
                                        onClick={() => {
                                          void onLabelFace(face.faceId, customLabel.trim());
                                        }}
                                      >
                                        {isLabelSaving ? "Saving..." : "Save Label"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">No confident match yet. Use the face box to assign a name.</p>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {!scanningPhotoIds.has(photo.photoId) && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 animate-fade-in">
                      <p className="text-xs text-muted-foreground">
                        {unresolvedCount > 0
                          ? `${unresolvedCount} face${unresolvedCount === 1 ? "" : "s"} still need a label before confirmation.`
                          : pendingConfirmCount > 0
                            ? `${pendingConfirmCount} matched face${pendingConfirmCount === 1 ? "" : "s"} ready to be learned.`
                            : "All labels for this photo are already confirmed and learned."}
                      </p>
                      <button
                        type="button"
                        className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isConfirmingThisPhoto || unresolvedCount > 0 || pendingConfirmCount === 0}
                        onClick={() => {
                          void onConfirmAllLabels(photo.photoId);
                        }}
                      >
                        {isConfirmingThisPhoto ? "Confirming..." : "Confirm All Labels"}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default UploadCenter;
