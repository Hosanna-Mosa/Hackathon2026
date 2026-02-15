# Face Recognition Pipeline Documentation

## Purpose
This document explains the full flow from image upload to detection, matching, and learning confirmation in the backend.

It answers:
1. Which route is called. 
2. Which controller/service performs each step.
3. Which environment variables control each stage.

## Runtime Entry Points

### Server boot
- File: `backend/src/server.js`
- Responsibilities:
1. Load env from `.env`.
2. Connect MongoDB.
3. Preload face-api models via `preloadFaceApiModels()`.
4. Start Express server on `PORT`.

### API wiring
- File: `backend/src/app.js`
- Mounted routes:
1. `POST /api/upload` -> upload and auto-detect/match.
2. `POST /api/label-face` -> label one face and learn immediately.
3. `POST /api/confirm-photo-labels` -> bulk confirm all labeled faces in a photo.
4. `POST /api/manual-face` -> manually draw/select a face and learn immediately.
5. `POST /api/people` -> create reference person from one clear face photo.
6. `GET /api/people` -> list known people.
7. `POST /api/test-faceapi` -> compare baseline face-api pass vs current pipeline.

## Route -> Controller -> Service Map

### 1) Upload photos for auto detection
- Route: `POST /api/upload`
- Route file: `backend/src/routes/uploadRoutes.js`
- Controller: `uploadPhotos` (`backend/src/controllers/uploadController.js`)
- Services used:
1. `uploadFilesToCloud` (`backend/src/services/cloudUploadService.js`)
2. `runFaceApiDetection` (`backend/src/services/faceApiDetection.js`)
3. `findBestPersonMatch` (`backend/src/services/recognitionService.js`)
4. `runFaceApiTest` optional diagnostic (`backend/src/services/faceApiTestService.js`)

### 2) Confirm one face label
- Route: `POST /api/label-face`
- Route file: `backend/src/routes/labelRoutes.js`
- Controller: `labelFace` (`backend/src/controllers/labelController.js`)
- Model updates:
1. Updates/creates `Person` embeddings.
2. Marks `Face.learningConfirmed = true`.

### 3) Confirm all labels in a photo
- Route: `POST /api/confirm-photo-labels`
- Route file: `backend/src/routes/labelRoutes.js`
- Controller: `confirmPhotoLabels` (`backend/src/controllers/labelController.js`)
- Model updates:
1. Requires all faces in photo to have `personId`.
2. Appends embeddings for each unconfirmed face to its person.
3. Marks those faces as `learningConfirmed = true`.

### 4) Manually add missing face
- Route: `POST /api/manual-face`
- Route file: `backend/src/routes/manualFaceRoutes.js`
- Controller: `manualFaceLabel` (`backend/src/controllers/manualFaceController.js`)
- Service used: `extractManualFaceEmbedding` (`backend/src/services/manualFaceService.js`)
- Model updates:
1. Creates/updates person embedding bank.
2. Creates `Face` with `learningConfirmed = true`.

### 5) Create person from reference photo
- Route: `POST /api/people`
- Route file: `backend/src/routes/peopleRoutes.js`
- Controller: `createPerson` (`backend/src/controllers/peopleController.js`)
- Service used: `runFaceApiDetection`
- Validation:
1. Exactly one face required.
2. Face confidence must be >= `LABEL_MIN_FACE_CONFIDENCE`.

## End-to-End Flow (Upload -> Recognition)

### Step A: Client uploads images
1. Client sends multipart request to `POST /api/upload` with `photos[]`.
2. `multer` keeps files in memory, validates mime type and size.

### Step B: Cloud upload
1. `uploadPhotos` calls `uploadFilesToCloud(files, folder)`.
2. Cloud response returns public URLs.
3. `Photo` document is created per image with `detectionResult` metadata.

### Step C: Face detection (who detects?)
- Detector owner: `runFaceApiDetection` in `backend/src/services/faceApiDetection.js`.

Detection pipeline:
1. Decode image to tensor.
2. Run 3 detector passes in parallel:
   - SSD primary pass.
   - SSD fallback pass.
   - TinyFaceDetector pass.
3. Post-process candidates:
   - Remove unreasonable boxes (size/aspect constraints).
   - Apply tiny-specific confidence rules.
   - Merge duplicates using IoU + center proximity.
   - Keep only consensus/high-confidence results.
4. Return normalized face list with `box`, `embedding`, `confidence`.

### Step D: Face matching/evaluation (who evaluates?)
- Matcher owner: `findBestPersonMatch` in `backend/src/services/recognitionService.js`.
- Called by: `uploadPhotos` controller.

Per detected face:
1. Compare face embedding against all person embeddings using cosine similarity.
2. Compute best and second-best similarity.
3. Decide provisional match based on threshold + margin strategy.
4. Apply upload-controller evaluation gates:
   - `EVALUATED_MIN_SIMILARITY`
   - `EVALUATED_MIN_GAP`
5. Assign status:
   - `matched`
   - `ambiguous`
   - `unknown`

Note:
- Upload-time matches are stored with `learningConfirmed = false`.
- This is intentional to avoid learning from unreviewed auto labels.

### Step E: Persist detected faces
1. `Face` documents are created with `photoId`, `box`, `embedding`, `personId|null`, `orderIndex`.
2. Response returns per-photo faces with status and candidates for UI confirmation.

## Learning Flow (when embedding memory updates)

### Single-face confirmation
- Route: `POST /api/label-face`
- Learns immediately by appending embedding to the selected person (dedupe-aware).
- Sets `Face.learningConfirmed = true`.

### Bulk photo confirmation
- Route: `POST /api/confirm-photo-labels`
- Learns all labeled-but-unconfirmed faces in that photo.
- Sets each confirmed face to `learningConfirmed = true`.

### Manual missing face
- Route: `POST /api/manual-face`
- Learns immediately for that manually selected region.

## Data Models Involved

### `Photo` (`backend/src/models/Photo.js`)
- Stores image URL, folder, face count, detection result summary.

### `Face` (`backend/src/models/Face.js`)
- Stores face box, embedding vector, linked `personId`, `learningConfirmed`, order index.

### `Person` (`backend/src/models/Person.js`)
- Stores canonical person identity and embedding bank (`embeddings`, `averageEmbedding`).

## Environment Variables Reference

### Core runtime
| Variable | Default | Used in | Purpose |
|---|---:|---|---|
| `PORT` | `5000` | `server.js` | HTTP server port |
| `MONGO_URI` | none | `config/db.js` | MongoDB connection string |
| `NODE_ENV` | none | `middleware/errorMiddleware.js` | Controls stack trace exposure |

### Cloud upload
| Variable | Default | Used in | Purpose |
|---|---:|---|---|
| `CLOUD_UPLOAD_URL` | none | `services/cloudUploadService.js` | Upstream file upload endpoint |
| `CLOUD_UPLOAD_FOLDER` | `drishyamitra` fallback | `services/cloudUploadService.js` | Default remote folder |

### Face detection (face-api)
| Variable | Default | Used in | Purpose |
|---|---:|---|---|
| `FACEAPI_MODEL_DIR` | auto-detected local path | `services/faceApiLoader.js` | Model weights directory |
| `FACEAPI_MIN_CONFIDENCE` | `0.5` | `services/faceApiDetection.js` | SSD primary min confidence |
| `FACEAPI_SSD_FALLBACK_MIN_CONFIDENCE` | `0.35` | `services/faceApiDetection.js` | SSD fallback min confidence |
| `FACEAPI_TINY_INPUT_SIZE` | `608` | `services/faceApiDetection.js` | Tiny detector input size |
| `FACEAPI_TINY_SCORE_THRESHOLD` | `0.25` | `services/faceApiDetection.js` | Tiny detector raw score cutoff |
| `FACEAPI_DEDUP_IOU` | `0.4` | `services/faceApiDetection.js` | IoU threshold for dedupe |
| `FACEAPI_TINY_MIN_KEEP_CONFIDENCE` | `0.42` | `services/faceApiDetection.js` | Tiny confidence when SSD support exists |
| `FACEAPI_TINY_ISOLATED_MIN_CONFIDENCE` | `0.58` | `services/faceApiDetection.js` | Tiny confidence when no SSD overlap |
| `FACEAPI_MIN_FACE_BOX_SIZE_PX` | `24` | `services/faceApiDetection.js` | Minimum detected face box size |
| `FACEAPI_MAX_FACE_ASPECT_RATIO` | `1.9` | `services/faceApiDetection.js` | Max width/height face ratio |
| `FACEAPI_MIN_FACE_ASPECT_RATIO` | `0.5` | `services/faceApiDetection.js` | Min width/height face ratio |
| `FACEAPI_MIN_SINGLE_DETECTOR_CONFIDENCE` | `0.72` | `services/faceApiDetection.js` | Keep single-detector boxes only if highly confident |
| `FACEAPI_COMPARE_ON_UPLOAD` | `false` | `controllers/uploadController.js` | Enable diagnostic compare call during upload |

### Face matching and evaluation
| Variable | Default | Used in | Purpose |
|---|---:|---|---|
| `FACE_SIMILARITY_THRESHOLD` | `0.95` | `services/recognitionService.js` | Multi-person similarity threshold |
| `FACE_SIMILARITY_MARGIN` | `0.08` | `services/recognitionService.js` | Required gap from second-best |
| `FACE_SIMILARITY_SINGLE_PERSON_THRESHOLD` | `0.42` | `services/recognitionService.js` | Threshold when only one person exists |
| `EVALUATED_MIN_SIMILARITY` | `0.95` | `controllers/uploadController.js` | Final acceptance gate after matching |
| `EVALUATED_MIN_GAP` | `0.02` | `controllers/uploadController.js` | Final similarity gap gate |
| `SINGLE_REFERENCE_MIN_SIMILARITY` | `0.55` | `controllers/uploadController.js` | Special single-reference candidate gate |
| `SINGLE_REFERENCE_BEST_MARGIN` | `0.03` | `controllers/uploadController.js` | Margin in single-reference disambiguation |
| `LABEL_MIN_FACE_CONFIDENCE` | `0.9` | `controllers/peopleController.js` | Minimum confidence for person reference photo |

### Learning/dedupe controls
| Variable | Default | Used in | Purpose |
|---|---:|---|---|
| `EMBEDDING_DUPLICATE_SIMILARITY_THRESHOLD` | `0.9995` | `controllers/labelController.js`, `controllers/manualFaceController.js` | Avoid near-duplicate embedding inserts |
| `MANUAL_FACE_MIN_BOX_SIZE` | `24` | `services/manualFaceService.js` | Minimum manual selection size |

### AI assistant / vision providers (non-face-pipeline core)
| Variable | Default | Used in | Purpose |
|---|---:|---|---|
| `GROQ_API_KEY` | none | `services/groqService.js` | Groq chat API |
| `HF_API_KEY` | none | `services/huggingfaceService.js` | Hugging Face API |
| `HF_MODEL_ID` | internal default | `services/huggingfaceService.js` | Primary HF model |
| `HF_FALLBACK_MODEL_IDS` | empty | `services/huggingfaceService.js` | Fallback HF models |
| `VISION_PROVIDER` | `huggingface` | `services/huggingfaceService.js` | Vision provider selection |

## Practical Rule of Thumb
1. Detection confidence vars decide if a box is considered a face.
2. Similarity vars decide if a face can be matched to a person.
3. Learning only happens on confirmation routes (`/label-face`, `/manual-face`, `/confirm-photo-labels`).

## Recommended Operational Notes
1. Do not commit real API keys or DB passwords to git.
2. Keep production `.env` secrets rotated and managed in secret storage.
3. Tune detection vars and similarity vars separately because they solve different problems (recall vs identity precision).
