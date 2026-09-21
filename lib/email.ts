import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

const ESTATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente de revisión',
  EN_REVISION: 'En revisión',
  DEMANDA_LISTA: 'Demanda lista para revisar',
  EN_REVISION_ABOGADO: 'Comentarios recibidos — en revisión',
  APROBADA: 'Demanda aprobada',
  PRESENTADA: 'Demanda presentada ante el juzgado',
  EN_PROCESO: 'En proceso judicial',
  RESOLUCION_PENDIENTE: 'Resolución pendiente',
  RESUELTA: 'Resuelta',
  CERRADA: 'Cerrada',
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function baseHtml(body: string) {
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
            <span style="color:#aaaaaa;font-size:12px;margin-left:12px;">Asistente Civil · Guanajuato</span>
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

// Correo al cliente cuando el abogado/admin cambia estatusCliente
export async function sendEstatusClienteEmail({
  toEmail,
  toName,
  expediente,
  nuevoEstatus,
}: {
  toEmail: string;
  toName: string;
  expediente: string;
  nuevoEstatus: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const label = ESTATUS_LABEL[nuevoEstatus] || nuevoEstatus;
  const body = `
    <p style="font-size:14px;color:#6b6b6b;margin:0 0 20px 0;">Hola <strong style="color:#3d3d3d;">${escapeHtml(toName)}</strong>,</p>
    <p style="font-size:14px;color:#4b4b4b;line-height:1.7;margin:0 0 24px 0;">
      El estado de tu expediente <strong>${escapeHtml(expediente)}</strong> ha sido actualizado.
    </p>
    <div style="background:#f5f5f5;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:11px;color:#9b9b9b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Estado actual</div>
      <div style="font-size:18px;font-weight:700;color:#3d3d3d;">${escapeHtml(label)}</div>
    </div>
    <p style="font-size:13px;color:#6b6b6b;line-height:1.6;margin:0;">
      Puedes revisar el detalle de tu caso iniciando sesión en el portal del cliente.
      Si tienes alguna pregunta, comunícate con tu abogado directamente.
    </p>`;
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `Actualización de tu expediente ${expediente}`,
    html: baseHtml(body),
  }).catch(() => {/* fallo silencioso — no bloquear la operación */});
}

// Correo al abogado cuando el cliente manda un comentario
export async function sendComentarioAbogadoEmail({
  toEmail,
  toName,
  clientName,
  expediente,
  comentario,
}: {
  toEmail: string;
  toName: string;
  clientName: string;
  expediente: string;
  comentario: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const body = `
    <p style="font-size:14px;color:#6b6b6b;margin:0 0 20px 0;">Hola <strong style="color:#3d3d3d;">${escapeHtml(toName)}</strong>,</p>
    <p style="font-size:14px;color:#4b4b4b;line-height:1.7;margin:0 0 24px 0;">
      Tu cliente <strong>${escapeHtml(clientName)}</strong> dejó un comentario en el expediente <strong>${escapeHtml(expediente)}</strong>.
    </p>
    <div style="background:#f5f5f5;border-radius:8px;padding:20px 24px;margin-bottom:24px;border-left:3px solid #4b4b4b;">
      <div style="font-size:11px;color:#9b9b9b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Comentario del cliente</div>
      <div style="font-size:14px;color:#3d3d3d;line-height:1.7;">${escapeHtml(comentario)}</div>
    </div>
    <p style="font-size:13px;color:#6b6b6b;">Revisa el expediente en tu panel para responder o actualizar el estado.</p>`;
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `Comentario de ${clientName} — Expediente ${expediente}`,
    html: baseHtml(body),
  }).catch(() => {});
}

// Correo al abogado cuando el cliente aprueba la demanda
export async function sendAprobacionAbogadoEmail({
  toEmail,
  toName,
  clientName,
  expediente,
}: {
  toEmail: string;
  toName: string;
  clientName: string;
  expediente: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const body = `
    <p style="font-size:14px;color:#6b6b6b;margin:0 0 20px 0;">Hola <strong style="color:#3d3d3d;">${escapeHtml(toName)}</strong>,</p>
    <p style="font-size:14px;color:#4b4b4b;line-height:1.7;margin:0 0 24px 0;">
      Tu cliente <strong>${escapeHtml(clientName)}</strong> ha <strong>aprobado la demanda</strong> del expediente <strong>${escapeHtml(expediente)}</strong>.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:14px;color:#22a06b;font-weight:600;">Demanda aprobada — lista para presentar</div>
    </div>
    <p style="font-size:13px;color:#6b6b6b;">Accede al panel para continuar con el proceso.</p>`;
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `${clientName} aprobó la demanda — Expediente ${expediente}`,
    html: baseHtml(body),
  }).catch(() => {});
}

export async function sendEmail({
  to,
  subject,
  html,
  cc,
}: {
  to: string;
  subject: string;
  html: string;
  cc?: string | string[] | null;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const ccArr = Array.isArray(cc) ? cc : cc ? [cc] : undefined;
  await resend.emails.send({
    from: FROM,
    to,
    cc: ccArr,
    subject,
    html,
  }).catch(() => {});
}

export async function sendCaseChatEmail({
  toEmail,
  toName,
  ccEmail,
  expediente,
  fromLabel,
  message,
}: {
  toEmail: string;
  toName: string;
  ccEmail?: string | null;
  expediente: string;
  fromLabel: string;
  message: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const body = `
    <p style="font-size:14px;color:#6b6b6b;margin:0 0 20px 0;">Hola <strong style="color:#3d3d3d;">${escapeHtml(toName)}</strong>,</p>
    <p style="font-size:14px;color:#4b4b4b;line-height:1.7;margin:0 0 24px 0;">
      Tienes un nuevo mensaje en el expediente <strong>${escapeHtml(expediente)}</strong>.
    </p>
    <div style="background:#f5f5f5;border-radius:8px;padding:20px 24px;margin-bottom:24px;border-left:3px solid #4b4b4b;">
      <div style="font-size:11px;color:#9b9b9b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Mensaje de ${escapeHtml(fromLabel)}</div>
      <div style="font-size:14px;color:#3d3d3d;line-height:1.7;white-space:pre-wrap;">${escapeHtml(message)}</div>
    </div>
    <p style="font-size:13px;color:#6b6b6b;">Responde desde la plataforma para mantener el historial.</p>`;
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    cc: ccEmail ? [ccEmail] : undefined,
    subject: `Mensaje en expediente ${expediente}`,
    html: baseHtml(body),
  }).catch(() => {});
}
