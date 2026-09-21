import { signedRead } from './gcs';

function provider() {
  return (process.env.STORAGE_PROVIDER || '').toLowerCase();
}

function isHttp(url: string) {
  return /^https?:\/\//i.test(url);
}

function isGcsPath(path: string) {
  return /^gs:\/\//i.test(path);
}

export async function saveBuffer(objectPath: string, buffer: Buffer, contentType: string): Promise<{ url: string }> {
  const p = provider();
  if (p === 'vercel-blob') {
    const { put } = await import('@vercel/blob');
    const res = await put(objectPath, buffer, {
      access: 'public',
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN
    } as any);
    return { url: res.url };
  }
  if (p === 'gcs') {
    const { bucket } = await import('./gcs') as any;
    if (!bucket) throw new Error('GCS no configurado');
    await bucket.file(objectPath).save(buffer, { contentType });
    const name = (await import('./gcs') as any).bucket?.name;
    return { url: `gs://${name}/${objectPath}` };
  }
  throw new Error('Proveedor de almacenamiento no configurado');
}

export async function getDownloadUrl(storagePath: string): Promise<string> {
  if (isHttp(storagePath)) return storagePath;
  if (isGcsPath(storagePath)) {
    const name = storagePath.replace(/^gs:\/\//i, '');
    const parts = name.split('/');
    const objectName = parts.slice(1).join('/');
    const url = await signedRead(objectName, 15);
    if (!url) throw new Error('URL no disponible');
    return url;
  }
  throw new Error('Archivo no disponible');
}
