import { useRef, useState } from "react";
import { Upload, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { labelFaceApi, uploadPhotosApi, type UploadedPhoto } from "@/lib/api";
import { resolvePhotoUrl } from "@/lib/utils";
import FaceOverlayLabeler from "@/components/face/FaceOverlayLabeler";
import ManualFaceSelector from "@/components/face/ManualFaceSelector";

const UploadCenter = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLabelSaving, setIsLabelSaving] = useState(false);
  const [faceOrder, setFaceOrder] = useState<"left_to_right" | "right_to_left">("left_to_right");
  const [manualModeByPhoto, setManualModeByPhoto] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

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

  const onUpload = async () => {
    if (import.meta.env.DEV) {
      console.debug("[upload] button clicked", { selectedFiles: selectedFiles.length });
    }

    if (selectedFiles.length === 0) {
      setError("Please select at least one photo.");
      return;
    }

    try {
      setIsUploading(true);
      setError("");
      if (import.meta.env.DEV) {
        console.debug("[upload] upload started");
      }
      const data = await uploadPhotosApi(selectedFiles, faceOrder);
      setUploadedPhotos(data.photos);
      setManualModeByPhoto({});
      setSelectedFiles([]);
      if (import.meta.env.DEV) {
        console.debug("[upload] upload success", {
          message: data.message,
          count: data.count,
          returnedPhotos: data.photos.length,
          faceOrder,
        });
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("[upload] upload failed", err);
      }
      setError(err instanceof Error ? err.message : "Upload failed.");
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
                }
              : face
          ),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save face label.");
    } finally {
      setIsLabelSaving(false);
    }
  };

  const onManualFaceSaved = (photoId: string, manualFace: {
    faceId: string;
    box: { x: number; y: number; width: number; height: number };
    personId: string;
    name: string;
    confidence: number;
    learningConfirmed: boolean;
  }) => {
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

  const progressValue = isUploading ? 65 : uploadedPhotos.length > 0 ? 100 : 0;

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Upload Center</h1>
          <p className="text-sm text-muted-foreground">Add new memories for AI indexing</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground" type="button">
          <Sparkles className="h-4 w-4" />
          AI Stats
        </button>
      </div>

      <div className="rounded-xl border-2 border-dashed border-primary/40 bg-secondary/20 p-12 text-center transition-colors hover:border-primary">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-foreground">Drag and drop your photos here</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Our AI will automatically recognize faces, categorize scenery, and index your images for easy searching.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onSelectFiles}
        />
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            Select Photos from Computer
          </button>
          <button
            className="rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onUpload}
            disabled={isUploading || selectedFiles.length === 0}
          >
            {isUploading ? "Uploading..." : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}`}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Label order:</span>
          <select
            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
            value={faceOrder}
            onChange={(e) => setFaceOrder(e.target.value as "left_to_right" | "right_to_left")}
          >
            <option value="left_to_right">Left to Right</option>
            <option value="right_to_left">Right to Left</option>
          </select>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Supported formats: JPG, PNG, HEIC (Max 10MB per file)
        </p>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Upload className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Upload Session</p>
              <p className="text-xs text-muted-foreground">
                {isUploading
                  ? "Processing with AI..."
                  : uploadedPhotos.length > 0
                    ? `${uploadedPhotos.length} photos uploaded and indexed`
                    : selectedFiles.length > 0
                      ? `${selectedFiles.length} photos selected`
                      : "No active upload"}
              </p>
            </div>
          </div>
          <span className="text-lg font-bold text-primary">{progressValue}%</span>
        </div>
        <Progress value={progressValue} className="mt-3 h-2" />
      </div>

      <div className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Upload Previews</h2>
          <Badge variant="secondary" className="text-xs text-primary">
            {isUploading ? "AI Recognition in Progress" : "Indexed Photos"}
          </Badge>
        </div>

        {uploadedPhotos.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Uploaded photos will appear here with detected person labels.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {uploadedPhotos.map((photo) => (
              <div
                key={photo.photoId}
                className={`group relative overflow-hidden rounded-xl border border-border bg-card p-2 ${
                  manualModeByPhoto[photo.photoId] ? "sm:col-span-2 lg:col-span-3" : ""
                }`}
              >
                <img
                  src={resolvePhotoUrl(photo.imageUrl)}
                  alt="Uploaded photo"
                  className={`w-full object-cover ${manualModeByPhoto[photo.photoId] ? "max-h-[520px]" : "aspect-square"}`}
                />
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {photo.faces.length} detected face{photo.faces.length === 1 ? "" : "s"}
                    </span>
                    {photo.faces.length > 0 && (
                      <button
                        type="button"
                        className="rounded border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-accent"
                        onClick={() =>
                          setManualModeByPhoto((prev) => ({
                            ...prev,
                            [photo.photoId]: !prev[photo.photoId],
                          }))
                        }
                      >
                        {manualModeByPhoto[photo.photoId] ? "Back to Auto Labels" : "Add Missing Face"}
                      </button>
                    )}
                  </div>
                  {photo.faces.length === 0 ? (
                    <ManualFaceSelector
                      imageSrc={resolvePhotoUrl(photo.imageUrl)}
                      photoId={photo.photoId}
                      autoFacesCount={0}
                      onSaved={(face) => onManualFaceSaved(photo.photoId, face)}
                    />
                  ) : manualModeByPhoto[photo.photoId] ? (
                    <ManualFaceSelector
                      imageSrc={resolvePhotoUrl(photo.imageUrl)}
                      photoId={photo.photoId}
                      autoFacesCount={photo.faces.length}
                      onSaved={(face) => onManualFaceSaved(photo.photoId, face)}
                    />
                  ) : (
                  <>
                    <p className="text-[10px] text-muted-foreground">
                      Click face box to label/confirm. Only one editor is active at a time.
                    </p>
                    <FaceOverlayLabeler
                      imageSrc={resolvePhotoUrl(photo.imageUrl)}
                      faces={photo.faces}
                      isBusy={isLabelSaving}
                      onSaveLabel={onLabelFace}
                    />
                    <div className="space-y-1">
                      {photo.faces.map((face, index) => (
                        <p key={face.faceId} className="text-[10px] text-muted-foreground">
                          Person {(face.orderIndex ?? index) + 1}:{" "}
                          {face.learningConfirmed
                            ? `Saved: ${face.name}`
                            : face.name !== "unknown"
                            ? `Matched: ${face.name} (Confirm from box)`
                              : "Unknown"}
                        </p>
                      ))}
                    </div>
                  </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadCenter;
