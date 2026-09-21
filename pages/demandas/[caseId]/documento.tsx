import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import fs from 'fs';
import { bucket } from '../../../lib/gcs';
import { prisma } from '../../../lib/prisma';
import { canAccessLegalCase, getAuthFromCookies } from '../../../lib/auth';
import { useState } from 'react';
import { useRouter } from 'next/router';

type Props = {
  caseId: string;
  text: string;
  attachmentId?: string;
};

export default function Documento({ caseId, text, attachmentId }: Props) {
  const router = useRouter();
  const [docText, setDocText] = useState<string>(text || '');
  const [info, setInfo] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [regen, setRegen] = useState<boolean>(false);

  async function saveVersion() {
    setSaving(true);
    setInfo('');
    try {
      const r = await fetch('/api/cases/document', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, text: docText })
      });
      const data = await r.json();
      if (r.ok) {
        setInfo('Versión guardada');
      } else {
        setInfo(data.error || 'Error guardando versión');
      }
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    setRegen(true);
    setInfo('');
    try {
      const r = await fetch('/api/cases/document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId })
      });
      const data = await r.json();
      if (r.ok) {
        setDocText(String(data.text || ''));
        setInfo('Documento regenerado');
      } else {
        setInfo(data.error || 'Error regenerando');
      }
    } finally {
      setRegen(false);
    }
  }

  return (
    <>
      <Head><title>Documento de Demanda</title></Head>
      <div className="container">
        <header className="header">
          <div className="brand">Cymnova IA</div>
          <Link href="/mis-casos" className="button">Mis Casos</Link>
        </header>
        <div className="card">
          <h2 className="title">Documento de Demanda</h2>
          <textarea
            className="input"
            rows={18}
            value={docText}
            onChange={e => setDocText(e.target.value)}
            placeholder="Documento generado por IA"
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button className="button" onClick={saveVersion} disabled={saving}>Guardar versión</button>
            <button className="button" onClick={regenerate} disabled={regen}>Regenerar con IA</button>
            {attachmentId && (
              <Link href={`/api/cases/download?id=${attachmentId}`} className="button">Descargar</Link>
            )}
          </div>
          {info && <p className="muted" style={{ marginTop: '0.5rem' }}>{info}</p>}
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, params }) => {
  const auth = getAuthFromCookies(req.headers.cookie);
  if (!auth || auth.role !== 'ABOGADO') {
    return { redirect: { destination: '/login', permanent: false } };
  }
  const caseId = String(params?.caseId || '');
  if (!caseId) return { notFound: true };
  const lc = await prisma.legalCase.findUnique({ where: { id: caseId } });
  if (!canAccessLegalCase(auth, lc)) return { notFound: true };
  const att = await prisma.caseAttachment.findFirst({
    where: { caseId },
    orderBy: { createdAt: 'desc' }
  });
  let text = '';
  if (att?.storagePath) {
    const sp = String(att.storagePath);
    if (sp.startsWith('gs://') && bucket) {
      const objectName = sp.replace(`gs://${bucket.name}/`, '');
      try {
        const [buf] = await bucket.file(objectName).download();
        text = buf.toString('utf8');
      } catch {
        text = '';
      }
    } else if (fs.existsSync(sp)) {
      try {
        text = fs.readFileSync(sp, 'utf8');
      } catch {
        text = '';
      }
    }
  }
  return { props: { caseId, text, attachmentId: att?.id || undefined } };
};
