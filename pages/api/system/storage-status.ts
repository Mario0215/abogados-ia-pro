import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const provider = String(process.env.STORAGE_PROVIDER || '').toLowerCase();
  const hasToken = typeof process.env.BLOB_READ_WRITE_TOKEN === 'string' && !!process.env.BLOB_READ_WRITE_TOKEN;
  const providerOk = provider === 'vercel-blob' || provider === 'gcs';
  return res.status(200).json({
    provider,
    providerOk,
    hasToken
  });
}
