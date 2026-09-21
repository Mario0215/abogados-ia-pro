function money(n: number) {
  return `$${Math.round(n).toLocaleString('es-MX')} MXN`;
}

export function buildBienvenidaEmail({
  nombre,
  tipoServicio,
  nombreServicio,
  cotizacion,
  anticipo,
  expediente,
  baseUrl,
}: {
  nombre: string;
  tipoServicio: string;
  nombreServicio: string;
  cotizacion: number;
  anticipo: number;
  expediente: string;
  baseUrl: string;
}) {
  const mensajes: Record<string, string> = {
    DIVORCIO_MUTUO: 'Para el divorcio por mutuo acuerdo necesitaremos que ambas partes firmen. Tu abogado te explicará el proceso.',
    DIVORCIO_CONTENCIOSO: 'Este proceso requiere audiencias y puede extenderse varios meses. Tu abogado te dará el calendario estimado.',
    PENSION_ALIMENTICIA: 'Prepara los datos del obligado y actas de nacimiento de los menores. Tu abogado los solicitará al contactarte.',
    PRESCRIPCION_ADQUISITIVA: 'Reúne cualquier documento que acredite tu posesión del inmueble. Tu abogado evaluará con qué cuentas.',
    NULIDAD_CONTRATO: 'Ten a la mano una copia del contrato que deseas impugnar. Tu abogado lo revisará.',
    ARRENDAMIENTO: 'Reúne el contrato de arrendamiento y comprobantes de pago o adeudo. Tu abogado definirá la estrategia.',
    DANOS_PERJUICIOS: 'Reúne fotos, recibos o cualquier evidencia del daño sufrido. Tu abogado evaluará las pruebas.',
    SUCESION: 'Prepara el acta de defunción y documentos de los herederos. Tu abogado coordinará el proceso.',
  };
  const extra = mensajes[tipoServicio] || '';
  const saldo = Math.max(Math.round(cotizacion - anticipo), 0);
  const dashboardUrl = `${baseUrl.replace(/\/$/, '')}/cliente/dashboard`;

  const body = `
    <p style="font-size:14px;color:#6b6b6b;margin:0 0 18px 0;">Hola <strong style="color:#3d3d3d;">${nombre}</strong>,</p>
    <p style="font-size:14px;color:#4b4b4b;line-height:1.7;margin:0 0 22px 0;">
      Confirmamos que recibimos tu caso y tu anticipo ha sido procesado exitosamente.
    </p>
    <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:18px 18px;margin:0 0 22px 0;">
      <div style="font-size:11px;color:#9b9b9b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Resumen de tu caso</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#3d3d3d;">
        <tr><td style="padding:6px 0;color:#6b6b6b;">Servicio:</td><td style="padding:6px 0;text-align:right;font-weight:700;">${nombreServicio}</td></tr>
        <tr><td style="padding:6px 0;color:#6b6b6b;">Cotización total:</td><td style="padding:6px 0;text-align:right;font-weight:700;">${money(cotizacion)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b6b6b;">Anticipo pagado:</td><td style="padding:6px 0;text-align:right;font-weight:700;">${money(anticipo)} (50%)</td></tr>
        <tr><td style="padding:6px 0;color:#6b6b6b;">Saldo pendiente:</td><td style="padding:6px 0;text-align:right;font-weight:700;">${money(saldo)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b6b6b;">Folio:</td><td style="padding:6px 0;text-align:right;font-weight:700;">${expediente}</td></tr>
      </table>
    </div>
    <div style="background:#f5f5f5;border-radius:12px;padding:18px 18px;margin:0 0 22px 0;">
      <div style="font-size:11px;color:#9b9b9b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Próximos pasos</div>
      <ol style="margin:0;padding-left:18px;font-size:13px;color:#4b4b4b;line-height:1.7;">
        <li>Un abogado revisará tu caso en las próximas 24 horas.</li>
        <li>Te contactaremos para coordinar la entrega de documentos.</li>
        <li>Puedes dar seguimiento en tu portal: <a href="${dashboardUrl}" style="color:#4b4b4b;">${dashboardUrl}</a></li>
      </ol>
    </div>
    ${extra ? `<p style="font-size:13px;color:#4b4b4b;line-height:1.7;margin:0 0 22px 0;">${extra}</p>` : ''}
    <p style="font-size:12px;color:#6b6b6b;margin:0;">Cymnova A.C. | contacto@cymnova.mx</p>
  `;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf9f7;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;max-width:600px;">
        <tr>
          <td style="background:#4b4b4b;padding:24px 32px;">
            <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:1px;">CYMNOVA A.C.</span>
            <span style="color:#aaaaaa;font-size:12px;margin-left:12px;">Portal del Cliente</span>
          </td>
        </tr>
        <tr><td style="padding:32px;">${body}</td></tr>
        <tr>
          <td style="background:#f7f7f8;border-top:1px solid #e5e5e5;padding:16px 32px;font-size:11px;color:#9b9b9b;">
            Este correo es generado automáticamente. Por favor no respondas a este mensaje.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

