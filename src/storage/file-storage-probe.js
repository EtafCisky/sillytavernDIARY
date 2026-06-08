const PROBE_FILES = [
  {
    key: 'diary',
    name: 'diary-probe-diary.json',
    content: { diaryEntries: [], probeType: 'diary' },
  },
  {
    key: 'exchangeDiary',
    name: 'diary-probe-exchange-diary.json',
    content: { exchangeDiaryEntries: {}, probeType: 'exchangeDiary' },
  },
  {
    key: 'recycleBin',
    name: 'diary-probe-recycle-bin.json',
    content: { deletedEntries: [], probeType: 'recycleBin' },
  },
];

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function encodeJsonToBase64(data) {
  const json = JSON.stringify(data, null, 2);
  return bytesToBase64(new TextEncoder().encode(json));
}

function normalizeFilePath(path) {
  return String(path || '').replace(/^\/+/, '');
}

async function uploadJsonFile({ getRequestHeaders, fileName, data }) {
  const response = await fetch('/api/files/upload', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      name: fileName,
      data: encodeJsonToBase64(data),
    }),
  });

  if (!response.ok) {
    throw new Error(`Upload failed for ${fileName}: HTTP ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  return normalizeFilePath(result.path);
}

async function verifyUploadedFiles({ getRequestHeaders, paths }) {
  const response = await fetch('/api/files/verify', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({ urls: paths }),
  });

  if (!response.ok) {
    throw new Error(`Verify failed: HTTP ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function readUploadedJson(path) {
  const response = await fetch(`/${normalizeFilePath(path)}?diaryProbe=${Date.now()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Read failed for ${path}: HTTP ${response.status} ${await response.text()}`);
  }

  return response.json();
}

export function createFileStorageProbe({ getRequestHeaders }) {
  async function run() {
    if (typeof getRequestHeaders !== 'function') {
      throw new Error('SillyTavern getRequestHeaders is not available');
    }

    const marker = `diary-file-storage-probe-${Date.now()}`;
    const uploaded = [];

    for (const file of PROBE_FILES) {
      const data = {
        ...file.content,
        marker,
        writtenAt: new Date().toISOString(),
      };
      const path = await uploadJsonFile({ getRequestHeaders, fileName: file.name, data });
      uploaded.push({ ...file, path, expected: data });
    }

    const verification = await verifyUploadedFiles({
      getRequestHeaders,
      paths: uploaded.map(file => file.path),
    });

    const reads = [];
    for (const file of uploaded) {
      const data = await readUploadedJson(file.path);
      reads.push({
        key: file.key,
        name: file.name,
        path: file.path,
        exists: verification[file.path] === true,
        markerMatches: data.marker === marker,
        data,
      });
    }

    const result = {
      ok: reads.every(file => file.exists && file.markerMatches),
      marker,
      files: reads,
    };

    console.log('[Diary File Storage Probe]', result);
    return result;
  }

  return {
    run,
  };
}
