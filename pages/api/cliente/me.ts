import type { NextApiRequest, NextApiResponse } from 'next';
import { getClienteFromCookies } from '../../../lib/cliente-auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getClienteFromCookies(req.headers.cookie);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });
  return res.status(200).json({ uid: auth.uid });
}

