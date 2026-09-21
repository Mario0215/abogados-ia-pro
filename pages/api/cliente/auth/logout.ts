import type { NextApiRequest, NextApiResponse } from 'next';
import { clearClienteCookie } from '../../../../lib/cliente-auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Set-Cookie', clearClienteCookie());
  res.redirect(302, '/cliente/login');
}
