const axios = require('axios');
const FormData = require('form-data');

const DEFAULT_FOLDER = 'drishyamitra';
const ALLOWED_FOLDER_REGEX = /^[a-z0-9_-]+$/;
const logUpload = (message, payload) => {
  if (payload === undefined) {
    console.log(`[cloud-upload] ${message}`);
    return;
  }
  console.log(`[cloud-upload] ${message}`, payload);
};

const normalizeFolderName = (value) => {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  // Convert unsupported characters to "_" so upstream folder validation always passes.
  const sanitized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');

  return ALLOWED_FOLDER_REGEX.test(sanitized) ? sanitized : '';
};

const resolveUploadUrls = (payload) => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload) && payload.every((item) => typeof item === 'string')) {
    return payload;
  }

  if (Array.isArray(payload?.urls)) {
    return payload.urls.filter((item) => typeof item === 'string');
  }

  if (Array.isArray(payload?.data?.urls)) {
    return payload.data.urls.filter((item) => typeof item === 'string');
  }

  if (Array.isArray(payload?.files)) {
    if (payload.files.every((item) => typeof item === 'string')) {
      return payload.files;
    }

    return payload.files
      .map((item) => item?.url || item?.location || item?.publicUrl)
      .filter((item) => typeof item === 'string');
  }

  return [];
};

const createCloudUploadError = (message, statusCode = 502) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const uploadFilesToCloud = async (files, folderFromRequest) => {
  const uploadUrl = process.env.CLOUD_UPLOAD_URL;
  const resolvedFolder =
    normalizeFolderName(folderFromRequest) ||
    normalizeFolderName(process.env.CLOUD_UPLOAD_FOLDER) ||
    DEFAULT_FOLDER;
  const folder = ALLOWED_FOLDER_REGEX.test(resolvedFolder) ? resolvedFolder : DEFAULT_FOLDER;

  logUpload('preparing cloud upload', {
    uploadUrl,
    filesCount: Array.isArray(files) ? files.length : 0,
    folderFromRequest: folderFromRequest || null,
    envFolderRaw: process.env.CLOUD_UPLOAD_FOLDER || null,
    resolvedFolder,
    finalFolder: folder
  });

  if (!uploadUrl) {
    logUpload('missing CLOUD_UPLOAD_URL');
    throw createCloudUploadError('CLOUD_UPLOAD_URL is not configured.', 500);
  }

  if (!Array.isArray(files) || files.length === 0) {
    logUpload('no files provided to cloud upload');
    throw createCloudUploadError('No files received for cloud upload.', 400);
  }

  const form = new FormData();

  // Send text field exactly as required by upstream API contract.
  form.append('folder', folder);

  for (const file of files) {
    form.append('images[]', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
      knownLength: file.size
    });
  }

  try {
    const response = await axios.post(uploadUrl, form, {
      headers: form.getHeaders(),
      timeout: 30000,
      maxBodyLength: Infinity
    });
    logUpload('cloud provider response', {
      status: response.status,
      hasData: Boolean(response.data)
    });

    const urls = resolveUploadUrls(response.data);
    logUpload('parsed cloud urls', { count: urls.length });

    if (urls.length === 0) {
      throw createCloudUploadError('Cloud upload response did not include public URLs.', 502);
    }

    return { urls, folder };
  } catch (error) {
    if (error.statusCode) {
      logUpload('known cloud upload error', {
        message: error.message,
        statusCode: error.statusCode
      });
      throw error;
    }

    const upstreamStatus = error?.response?.status;
    const upstreamMessage =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'Cloud upload failed.';

    logUpload('cloud provider rejected upload', {
      upstreamStatus,
      upstreamMessage,
      upstreamBody: error?.response?.data || null
    });

    throw createCloudUploadError(
      `Cloud upload failed: ${upstreamMessage}`,
      upstreamStatus && upstreamStatus >= 400 && upstreamStatus < 600 ? upstreamStatus : 502
    );
  }
};

module.exports = {
  uploadFilesToCloud
};
