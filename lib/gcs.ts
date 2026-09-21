import { Storage } from '@google-cloud/storage';

const bucketName = process.env.GCS_BUCKET || '';
export const storage = new Storage();
export const bucket = bucketName ? storage.bucket(bucketName) : null as any;

export async function signedRead(objectName: string, minutes = 15): Promise<string> {
  if (!bucket) return '';
  const [url] = await bucket.file(objectName).getSignedUrl({ action: 'read', expires: Date.now() + minutes * 60 * 1000 });
  return url;
}

export async function signedWrite(objectName: string, contentType: string, minutes = 15): Promise<string> {
  if (!bucket) return '';
  const [url] = await bucket.file(objectName).getSignedUrl({ action: 'write', contentType, expires: Date.now() + minutes * 60 * 1000 });
  return url;
}
