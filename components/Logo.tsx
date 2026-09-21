import Link from 'next/link';
import { useMemo } from 'react';

type Props = {
  size?: number;
  withText?: boolean;
  text?: string;
};

export default function Logo({ withText = true }: Props) {
  const title = useMemo(() => 'ABOGADOS IA', []);
  const subtitle = useMemo(() => 'CYMNOVA A.C', []);
  return (
    <Link href="/" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', textDecoration: 'none' }}>
      {withText && (
        <>
          <span style={{ color: '#b91c1c', fontWeight: 800, fontSize: '1.15rem', letterSpacing: '0.5px' }}>{title}</span>
          <span style={{ color: '#b91c1c', fontWeight: 700, fontSize: '0.9rem' }}>{subtitle}</span>
        </>
      )}
    </Link>
  );
}
