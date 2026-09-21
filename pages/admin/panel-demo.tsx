import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import { useEffect, useState } from 'react'
import { getAuthFromCookies } from '../../lib/auth'
import { OfficialPdfUpload } from '../../components/legal/OfficialPdfUpload'

const NAV_ITEMS = [
  { id: 'casos', icon: '📂', label: 'Casos del sistema' },
  { id: 'afiliados', icon: '👨‍⚖️', label: 'Abogados Comisionistas' },
  { id: 'precios', icon: '💲', label: 'Precios' },
  { id: 'documentos', icon: '⚖️', label: 'Leyes y Documentos' },
  { id: 'materias', icon: '📋', label: 'Materias Activas' },
  { id: 'estados', icon: '🗺️', label: 'Catálogo de Estados' },
  { id: 'jurisprudencias', icon: '📚', label: 'Jurisprudencias' }
]

const FIXED_CODES = [
  { id: 'CC_GTO', title: 'Código Civil de Guanajuato (CC)', tipo: 'Sustantivo', jurisdiccion: 'ESTATAL', estado: 'Guanajuato' },
  { id: 'CPC_GTO', title: 'Código de Proc. Civiles GTO (CPC)', tipo: 'Procesal', jurisdiccion: 'ESTATAL', estado: 'Guanajuato' },
  { id: 'CNPCF', title: 'Código Nacional Proc. Civiles (CNPCF)', tipo: 'Procesal', jurisdiccion: 'FEDERAL', estado: '—', badge: 'Sujeto a transición verificada' }
] as const

// BUG 1 fix: remove static USERS and load from API

const MATTERS = [
  { key: 'CIVIL', label: 'Civil', active: true },
  { key: 'MERCANTIL', label: 'Mercantil', active: false },
  { key: 'PENAL', label: 'Penal', active: false },
  { key: 'LABORAL', label: 'Laboral', active: false }
]

const STATES = [{ id: 1, nombre: 'Guanajuato', docs: 1 }]

type UploadForm = {
  preset: string
  titulo: string
  jurisdiccion: 'ESTATAL' | 'FEDERAL'
  estado: string
  submateria: 'Sustantivo' | 'Procesal/Adjetivo'
  activo: boolean
  texto: string
}

const PRESETS: Array<{ value: string; label: string; jurisdiccion?: 'ESTATAL' | 'FEDERAL'; submateria?: 'Sustantivo' | 'Procesal/Adjetivo' }> = [
  { value: 'cc_gto', label: 'Código Civil de Guanajuato (CC)', jurisdiccion: 'ESTATAL', submateria: 'Sustantivo' },
  { value: 'cpc_gto', label: 'Código de Proc. Civiles GTO (CPC)', jurisdiccion: 'ESTATAL', submateria: 'Procesal/Adjetivo' },
  { value: 'cnpcf', label: 'Código Nacional Proc. Civiles (CNPCF)', jurisdiccion: 'FEDERAL', submateria: 'Procesal/Adjetivo' },
  { value: 'otro', label: 'Otra ley (manual)...' }
]

type Afiliado = { id: string; name: string; email: string; active: boolean; ciudad: string | null; porcentaje: number | null; cedula: string | null; phone: string | null; specialty?: string | null; address?: string | null; caseCounts?: { activos: number; cerrados: number; archivados: number } }
type CasoAdmin = { id: string; expediente: string; expedienteReal?: string | null; intent: string | null; matter: string; status: string; estadoAsignacion: string; estatusCliente?: string; ciudad: string | null; courtNumber?: string | null; courtType?: string | null; notes?: string | null; precioCliente: number | null; honorarioAbogado: number | null; honorarioAbogadoAcordadoAt?: string | null; honorarioAbogadoAcordadoPorId?: string | null; createdAt: string; client: { id: string; name: string } | null; abogado: { id: string; name: string; ciudad?: string | null; specialty?: string | null } | null }
type FinancialSummary = { precioCliente: number | null; anticipoCobrado: number; pagosCliente: number; reembolsosCliente: number; totalCobrado: number; saldoCliente: number; anticipoConfirmado: boolean; honorarioConfirmado: boolean; honorarioAcordado: number | null; honorarioPagado: number; saldoPorLiquidar: number | null; huboPagoConfirmado: boolean }
type LawyerPayment = { id: string; amount: number; paidAt: string; method: string; reference?: string | null; notes?: string | null; status: string; voidReason?: string | null; lawyer?: { name?: string | null }; recordedByAdmin?: { name?: string | null }; voidedByAdmin?: { name?: string | null } }

function matchByCode(lawId: string, d: any) {
  if (lawId === 'CC_GTO') return d.sourceType === 'CC'
  if (lawId === 'CPC_GTO') return d.sourceType === 'CPC'
  if (lawId === 'CNPCF') return d.sourceType === 'CNPCF'
  return false
}

function uniqueCount(docs: Array<any>, lawId: string) {
  const articles = new Set<string>()
  const filtered = docs.filter(d => d.active && matchByCode(lawId, d))
  for (const d of filtered) {
    const match = String(d.title || '').match(/Artículo\s+(\d+)/i)
    if (match?.[1]) articles.add(match[1])
  }
  return articles.size
}

const STATUS_PRO_OPTIONS = ['TODOS', 'NUEVO', 'ASIGNADO', 'EN_REVISION', 'EN_REDACCION', 'DEMANDA_LISTA', 'PRESENTADO', 'SEGUIMIENTO', 'CERRADO', 'ARCHIVADO'] as const
const STATUS_PRO_LABEL: Record<string, string> = {
  NUEVO: 'Nuevo',
  ASIGNADO: 'Asignado',
  EN_REVISION: 'En revisión',
  EN_REDACCION: 'En redacción',
  DEMANDA_LISTA: 'Demanda lista',
  PRESENTADO: 'Presentado',
  SEGUIMIENTO: 'Seguimiento',
  CERRADO: 'Cerrado',
  ARCHIVADO: 'Archivado',
  BORRADOR: 'Borrador'
}
const STATUS_PRO_COLOR: Record<string, string> = {
  NUEVO: '#f87171',
  ASIGNADO: '#c9a84c',
  EN_REVISION: '#60a5fa',
  EN_REDACCION: '#818cf8',
  DEMANDA_LISTA: '#22d3ee',
  PRESENTADO: '#34d399',
  SEGUIMIENTO: '#a78bfa',
  CERRADO: '#10b981',
  ARCHIVADO: '#64748b',
  BORRADOR: '#475569'
}

const SPECIALTY_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  CIVIL:    { label: 'CIVIL',    bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' },
  FAMILIAR: { label: 'FAMILIAR', bg: 'rgba(244,114,182,0.15)', color: '#f472b6' },
  LABORAL:  { label: 'LABORAL',  bg: 'rgba(249,115,22,0.15)',  color: '#f97316' },
};

async function fetchCasos(estadoAsignacion: string, ciudad: string, statusPro: string = 'TODOS', sinAsignar: boolean = false) {
  const params = new URLSearchParams()
  if (estadoAsignacion !== 'TODOS') params.set('estadoAsignacion', estadoAsignacion)
  if (ciudad !== 'TODAS') params.set('ciudad', ciudad)
  if (statusPro !== 'TODOS') params.set('status', statusPro)
  if (sinAsignar) params.set('sinAsignar', '1')
  const response = await fetch(`/api/admin/casos?${params}`)
  const data = await response.json().catch(() => ({}))
  return {
    casos: Array.isArray(data.casos) ? data.casos : [],
    abogados: Array.isArray(data.abogados) ? data.abogados : []
  }
}

const ESTATUS_CLIENTE_LABEL: Record<string, string> = {
  PENDIENTE: 'Recibimos tu caso',
  ASIGNADO: 'Abogado asignado',
  EN_REVISION_ABOGADO: 'Abogado trabajando',
  DEMANDA_LISTA: 'Demanda lista',
  EN_REVISION_CLIENTE: 'En revisión cliente',
  APROBADA: 'Aprobada',
  PENDIENTE_FIRMA: 'Pendiente firma',
  PRESENTADA: 'Presentada',
  EN_PROCESO: 'En juzgado',
  RESUELTO: 'Resuelto',
}
const ESTATUS_CLIENTE_OPTIONS = ['PENDIENTE','ASIGNADO','EN_REVISION_ABOGADO','DEMANDA_LISTA','EN_REVISION_CLIENTE','APROBADA','PENDIENTE_FIRMA','PRESENTADA','EN_PROCESO','RESUELTO']

export default function AdminPanelDemo() {
  const [section, setSection] = useState<string>('casos')
  const [showUpload, setShowUpload] = useState<boolean>(false)
  const [laws, setLaws] = useState<Array<{ id: string; title: string; tipo: string; jurisdiccion: string; estado: string; activo: boolean; articulos: number; badge?: string }>>([])
  const [matters, setMatters] = useState(MATTERS)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: 'ADMIN' | 'ABOGADO'; active: boolean }>>([])
  const [editUser, setEditUser] = useState<{ id: string; name: string; email: string; role: 'ADMIN' | 'ABOGADO'; active: boolean } | null>(null)
  const [showNewUserModal, setShowNewUserModal] = useState<boolean>(false)
  const [newUserData, setNewUserData] = useState({ name: '', email: '', password: '', phone: '', specialty: '' })
  const [newUserError, setNewUserError] = useState<string>('')
  const [newUserSuccess, setNewUserSuccess] = useState<string>('')
  // Afiliados
  const [afiliados, setAfiliados] = useState<Afiliado[]>([])
  const [showNuevoAfiliado, setShowNuevoAfiliado] = useState(false)
  const [afiliadoForm, setAfiliadoForm] = useState({ name: '', email: '', password: '', phone: '', ciudad: '', cedula: '', porcentaje: '', specialty: '', domCalle: '', domColonia: '', domCp: '', domMunicipio: '', domEstado: '' })
  const [afiliadoError, setAfiliadoError] = useState('')
  const [afiliadoSuccess, setAfiliadoSuccess] = useState('')
  const [editAfiliado, setEditAfiliado] = useState<Afiliado | null>(null)
  // Casos marketplace
  const [casos, setCasos] = useState<CasoAdmin[]>([])
  const [casosAbogados, setCasosAbogados] = useState<{ id: string; name: string; ciudad: string | null; specialty?: string | null; phone?: string | null; activosAsignados?: number }[]>([])
  const [filtroEstado, setFiltroEstado] = useState('TODOS')
  const [filtroCiudad, setFiltroCiudad] = useState('TODAS')
  const [filtroStatusPro, setFiltroStatusPro] = useState('TODOS')
  const [filtroSinAsignar, setFiltroSinAsignar] = useState(false)
  const [todasLasCiudades, setTodasLasCiudades] = useState<string[]>([])
  const [asignandoId, setAsignandoId] = useState<string | null>(null)
  // Panel Gestionar: estado controlado (11 campos)
  const [gestAbogado, setGestAbogado] = useState('')
  const [gestStatusPro, setGestStatusPro] = useState('')
  const [gestEstado, setGestEstado] = useState('PENDIENTE')
  const [gestPrecio, setGestPrecio] = useState('')
  const [gestHonorario, setGestHonorario] = useState('')
  const [gestCiudad, setGestCiudad] = useState('')
  const [gestCourtType, setGestCourtType] = useState('')
  const [gestCourtNumber, setGestCourtNumber] = useState('')
  const [gestExpedienteReal, setGestExpedienteReal] = useState('')
  const [gestEstatusCliente, setGestEstatusCliente] = useState('PENDIENTE')
  const [gestNotes, setGestNotes] = useState('')
  const [casosMsg, setCasosMsg] = useState('')
  const [casosMsgTipo, setCasosMsgTipo] = useState<'ok' | 'err'>('ok')
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null)
  const [lawyerPayments, setLawyerPayments] = useState<LawyerPayment[]>([])
  const [financialLoading, setFinancialLoading] = useState(false)
  const [showLawyerPayment, setShowLawyerPayment] = useState(false)
  const [lawyerPaymentForm, setLawyerPaymentForm] = useState({ amount: '', paidAt: '', method: 'TRANSFERENCIA', reference: '', notes: '' })
  const [lawyerPaymentSaving, setLawyerPaymentSaving] = useState(false)
  const [serviciosCfg, setServiciosCfg] = useState<any[]>([])
  const [modsCfg, setModsCfg] = useState<any[]>([])
  const [preciosMsg, setPreciosMsg] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const [lawTexts, setLawTexts] = useState<Record<string, string>>({})
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [modalMode, setModalMode] = useState<'menu' | 'update' | 'delete' | 'revisar'>('menu')
  const [editingLawId, setEditingLawId] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState<string>('')
  const [uploadForm, setUploadForm] = useState<UploadForm>({
    preset: '',
    titulo: '',
    jurisdiccion: 'ESTATAL',
    estado: 'Guanajuato',
    submateria: 'Sustantivo',
    activo: false,
    texto: ''
  })
  const [reviewDocs, setReviewDocs] = useState<Array<{ id: string; title: string; content?: string }>>([])
  const [reviewQuery, setReviewQuery] = useState('')
  const [reviewPage, setReviewPage] = useState(1)
  const pageSize = 20

  // BUG 3 fix: refreshCounts based on uniqueCount and sourceType
  async function refreshCounts() {
    try {
      const r = await fetch('/api/admin/documents')
      const data = await r.json().catch(() => ({}))
      const docs: Array<any> = Array.isArray(data.documents) ? data.documents : []
      const ccCount = uniqueCount(docs, 'CC_GTO')
      const cpcCount = uniqueCount(docs, 'CPC_GTO')
      const cnpcfCount = uniqueCount(docs, 'CNPCF')
      const rows = FIXED_CODES.map(fc => ({
        id: fc.id,
        title: fc.title,
        tipo: fc.tipo,
        jurisdiccion: fc.jurisdiccion,
        estado: fc.estado,
        activo: (fc.id === 'CC_GTO' ? ccCount : fc.id === 'CPC_GTO' ? cpcCount : cnpcfCount) > 0,
        articulos: fc.id === 'CC_GTO' ? ccCount : fc.id === 'CPC_GTO' ? cpcCount : cnpcfCount,
        badge: (fc as any).badge
      }))
      setLaws(rows)
    } catch {
      setLaws(FIXED_CODES.map(fc => ({ id: fc.id, title: fc.title, tipo: fc.tipo, jurisdiccion: fc.jurisdiccion, estado: fc.estado, activo: false, articulos: 0, badge: (fc as any).badge })))
    }
  }

  function paramsForPreset(preset: string) {
    if (preset === 'cc_gto') return { matter: 'CIVIL', submatter: 'Sustantivo', jurisdiccion: 'ESTATAL' }
    if (preset === 'cpc_gto') return { matter: 'CIVIL', submatter: 'Procesal/Adjetivo', jurisdiccion: 'ESTATAL' }
    if (preset === 'cnpcf') return { matter: 'CIVIL', submatter: 'Procesal/Adjetivo', jurisdiccion: 'FEDERAL' }
    return null
  }

  async function importAndActivate() {
    if (!uploadForm.preset) return
    const p = paramsForPreset(uploadForm.preset)
    if (!p) return
    const res = await fetch('/api/admin/import-pasted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: uploadForm.texto, matter: p.matter, submatter: p.submatter, jurisdiccion: p.jurisdiccion, active: uploadForm.activo })
    })
    if (res.ok) {
      await refreshCounts()
      setShowUpload(false)
      setUploadForm({ preset: '', titulo: '', jurisdiccion: 'ESTATAL', estado: 'Guanajuato', submateria: 'Sustantivo', activo: false, texto: '' })
      setPasteText('')
    }
  }

  const handlePreset = (val: string) => {
    const p = PRESETS.find(x => x.value === val)
    if (!p) return
    setUploadForm(f => ({
      ...f,
      preset: val,
      titulo: p.label !== 'Otra ley (manual)...' ? p.label : '',
      jurisdiccion: p.jurisdiccion || 'ESTATAL',
      submateria: p.submateria || 'Sustantivo'
    }))
  }

  const toggleLaw = (id: string) => setLaws(ls => ls.map(l => (l.id === id ? { ...l, activo: !l.activo } : l)))
  const toggleMatter = (key: string) => setMatters(ms => ms.map(m => (m.key === key ? { ...m, active: !m.active } : m)))
  async function openView(id: string) {
    setEditingLawId(id)
    setModalMode('revisar')
    setModalOpen(true)
    await loadDocsFor(id)
    setReviewPage(1)
    setReviewQuery('')
  }
  const startUpdate = () => setModalMode('update')
  const startDelete = () => setModalMode('delete')
  function sortByArticleNumber(a: { title: string }, b: { title: string }) {
    const na = Number((a.title.match(/Artículo\s+(\d+)/i) || [])[1] || 0)
    const nb = Number((b.title.match(/Artículo\s+(\d+)/i) || [])[1] || 0)
    return na - nb
  }
  async function loadDocsFor(lawId: string) {
    try {
      const r = await fetch('/api/admin/documents')
      const data = await r.json().catch(() => ({}))
      const docs: Array<any> = Array.isArray(data.documents) ? data.documents : []
      const filtered = docs.filter(d => d.active && matchByCode(lawId, d)).map(d => ({ id: d.id, title: d.title, content: d.content || '' })).sort(sortByArticleNumber)
      setReviewDocs(filtered)
    } catch {
      setReviewDocs([])
    }
  }

  const saveUpdatedText = async () => {
    if (!editingLawId) return
    const preset = editingLawId === 'CC_GTO' ? 'cc_gto' : editingLawId === 'CPC_GTO' ? 'cpc_gto' : editingLawId === 'CNPCF' ? 'cnpcf' : ''
    const p = paramsForPreset(preset)
    if (!p) return
    const res = await fetch('/api/admin/import-pasted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: pasteText || lawTexts[editingLawId || ''] || '', matter: p.matter, submatter: p.submatter, jurisdiccion: p.jurisdiccion })
    })
    if (res.ok) {
      await refreshCounts()
      setModalOpen(false)
      setModalMode('menu')
      setEditingLawId(null)
      setPasteText('')
    }
  }
  const confirmDelete = () => {
    if (!editingLawId) return
    ;(async () => {
      try {
        const r = await fetch('/api/admin/documents')
        const data = await r.json().catch(() => ({}))
        const docs: Array<any> = Array.isArray(data.documents) ? data.documents : []
        const match = (d: any) => {
          if (editingLawId === 'CC_GTO') {
            return d.sourceType === 'CC' ||
              (d.jurisdiccion === 'ESTATAL' && d.state?.name === 'Guanajuato' && String(d.submatter || '').toLowerCase().includes('sustantivo'))
          }
          if (editingLawId === 'CPC_GTO') {
            return d.sourceType === 'CPC' ||
              (d.jurisdiccion === 'ESTATAL' && d.state?.name === 'Guanajuato' && String(d.submatter || '').toLowerCase().includes('procesal'))
          }
          if (editingLawId === 'CNPCF') {
            return d.sourceType === 'CNPCF' ||
              (d.jurisdiccion === 'FEDERAL' && String(d.submatter || '').toLowerCase().includes('procesal'))
          }
          return false
        }
        const targets = docs.filter(match)
        for (const t of targets) {
          await fetch('/api/admin/documents', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, active: false }) })
        }
      } catch {}
      await refreshCounts()
      setModalOpen(false)
      setModalMode('menu')
      setEditingLawId(null)
      setPasteText('')
    })()
  }
  const cancelModal = () => {
    setModalOpen(false)
    setModalMode('menu')
    setEditingLawId(null)
    setPasteText('')
  }

  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch('/api/admin/documents')
        const data = await r.json().catch(() => ({}))
        const docs: Array<any> = Array.isArray(data.documents) ? data.documents : []
        const ccCount = uniqueCount(docs, 'CC_GTO')
        const cpcCount = uniqueCount(docs, 'CPC_GTO')
        const cnpcfCount = uniqueCount(docs, 'CNPCF')
        const rows = FIXED_CODES.map(fc => ({
          id: fc.id,
          title: fc.title,
          tipo: fc.tipo,
          jurisdiccion: fc.jurisdiccion,
          estado: fc.estado,
          activo: (fc.id === 'CC_GTO' ? ccCount > 0 : fc.id === 'CPC_GTO' ? cpcCount > 0 : cnpcfCount > 0),
          articulos: (fc.id === 'CC_GTO' ? ccCount : fc.id === 'CPC_GTO' ? cpcCount : cnpcfCount),
          badge: (fc as any).badge
        }))
        setLaws(rows)
      } catch {
        const rows = FIXED_CODES.map(fc => ({ id: fc.id, title: fc.title, tipo: fc.tipo, jurisdiccion: fc.jurisdiccion, estado: fc.estado, activo: false, articulos: 0, badge: (fc as any).badge }))
        setLaws(rows)
      }
    })()
    // BUG 1 fix: load users from API
    ;(async () => {
      try {
        const r = await fetch('/api/admin/users')
        const data = await r.json().catch(() => ({}))
        const arr = Array.isArray(data.users) ? data.users : []
        setUsers(arr)
      } catch {
        setUsers([])
      }
    })()
    // Cargar afiliados y casos marketplace
    loadAfiliados()
    ;(async () => {
      try {
        const data = await fetchCasos('TODOS', 'TODAS', 'TODOS', false)
        setCasos(data.casos)
        setCasosAbogados(data.abogados)
      } catch { setCasos([]) }
    })()
  }, [])

  useEffect(() => {
    if (section !== 'precios') return
    loadPrecios()
  }, [section])

  async function loadFinancials(caseId: string) {
    setFinancialLoading(true)
    try {
      const [summaryResponse, paymentsResponse] = await Promise.all([
        fetch(`/api/admin/casos/${caseId}/finanzas`),
        fetch(`/api/admin/casos/${caseId}/lawyer-payments`),
      ])
      const summaryData = await summaryResponse.json().catch(() => ({}))
      const paymentsData = await paymentsResponse.json().catch(() => ({}))
      setFinancialSummary(summaryResponse.ok ? (summaryData.summary || null) : null)
      setLawyerPayments(paymentsResponse.ok && Array.isArray(paymentsData.payments) ? paymentsData.payments : [])
    } catch {
      setFinancialSummary(null)
      setLawyerPayments([])
    } finally {
      setFinancialLoading(false)
    }
  }

  useEffect(() => {
    if (!asignandoId) {
      setGestAbogado(''); setGestStatusPro(''); setGestEstado('PENDIENTE'); setGestPrecio(''); setGestHonorario('')
      setGestCiudad(''); setGestCourtType(''); setGestCourtNumber(''); setGestExpedienteReal('')
      setGestEstatusCliente('PENDIENTE'); setGestNotes('')
      setFinancialSummary(null); setLawyerPayments([]); setShowLawyerPayment(false)
      return
    }
    const caso = casos.find(c => c.id === asignandoId)
    if (!caso) return
    setGestAbogado(caso.abogado?.id || '')
    setGestStatusPro(caso.status || '')
    setGestEstado(caso.estadoAsignacion || 'PENDIENTE')
    setGestPrecio(caso.precioCliente ? String(caso.precioCliente) : '')
    setGestHonorario(caso.honorarioAbogado ? String(caso.honorarioAbogado) : '')
    setGestCiudad(caso.ciudad || '')
    setGestCourtType(caso.courtType || '')
    setGestCourtNumber(caso.courtNumber || '')
    setGestExpedienteReal(caso.expedienteReal || '')
    setGestEstatusCliente(caso.estatusCliente || 'PENDIENTE')
    setGestNotes(caso.notes || '')
    setLawyerPaymentForm({ amount: '', paidAt: new Date().toISOString().slice(0, 16), method: 'TRANSFERENCIA', reference: '', notes: '' })
    loadFinancials(asignandoId)
  }, [asignandoId, casos])

  async function loadPrecios() {
    try {
      const r = await fetch('/api/admin/precios')
      const data = await r.json().catch(() => ({}))
      setServiciosCfg(Array.isArray(data.servicios) ? data.servicios : [])
      setModsCfg(Array.isArray(data.modificadores) ? data.modificadores : [])
      setPreciosMsg('')
    } catch {
      setServiciosCfg([])
      setModsCfg([])
      setPreciosMsg('No se pudieron cargar los precios')
    }
  }

  async function saveServicio(servicioId: string, precioBase: number) {
    setSavingKey(`svc:${servicioId}`)
    try {
      const r = await fetch('/api/admin/precios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ servicioId, precioBase }) })
      const data = await r.json().catch(() => ({}))
      if (r.ok && data.servicio) {
        setServiciosCfg(prev => prev.map((s: any) => s.servicioId === servicioId ? data.servicio : s))
        setPreciosMsg('Precio actualizado')
      } else setPreciosMsg(data.error || 'No se pudo guardar')
    } catch {
      setPreciosMsg('No se pudo guardar')
    } finally {
      setSavingKey(null)
      setTimeout(() => setPreciosMsg(''), 1500)
    }
  }

  async function saveMod(modificadorKey: string, valor: number) {
    setSavingKey(`mod:${modificadorKey}`)
    try {
      const r = await fetch('/api/admin/precios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modificadorKey, valor }) })
      const data = await r.json().catch(() => ({}))
      if (r.ok && data.modificador) {
        setModsCfg(prev => prev.map((m: any) => m.key === modificadorKey ? data.modificador : m))
        setPreciosMsg('Modificador actualizado')
      } else setPreciosMsg(data.error || 'No se pudo guardar')
    } catch {
      setPreciosMsg('No se pudo guardar')
    } finally {
      setSavingKey(null)
      setTimeout(() => setPreciosMsg(''), 1500)
    }
  }

  async function loadAfiliados() {
    try {
      const r = await fetch('/api/admin/users?role=ABOGADO&take=100')
      const data = await r.json().catch(() => ({}))
      setAfiliados(Array.isArray(data.users) ? data.users : [])
    } catch { setAfiliados([]) }
  }

  async function loadCasos(override?: { estadoAsignacion?: string; ciudad?: string; statusPro?: string; sinAsignar?: boolean }) {
    const estadoAsignacion = override?.estadoAsignacion ?? filtroEstado
    const ciudad = override?.ciudad ?? filtroCiudad
    const statusPro = override?.statusPro ?? filtroStatusPro
    const sinAsignar = override?.sinAsignar ?? filtroSinAsignar
    try {
      const data = await fetchCasos(estadoAsignacion, ciudad, statusPro, sinAsignar)
      setCasos(data.casos)
      setCasosAbogados(data.abogados)
      const ciudadesNuevas = data.casos.map((c: any) => c.ciudad).filter(Boolean) as string[]
      if (ciudadesNuevas.length) {
        setTodasLasCiudades(prev => Array.from(new Set([...prev, ...ciudadesNuevas])).sort())
      }
    } catch { setCasos([]) }
  }

  async function crearAfiliado() {
    setAfiliadoError(''); setAfiliadoSuccess('')
    if (!afiliadoForm.name || !afiliadoForm.email || !afiliadoForm.password) { setAfiliadoError('Nombre, correo y contraseña son obligatorios'); return }
    if (afiliadoForm.password.length < 8) { setAfiliadoError('Contraseña mínimo 8 caracteres'); return }
    const address = [
      afiliadoForm.domCalle,
      afiliadoForm.domColonia ? `Col. ${afiliadoForm.domColonia}` : '',
      afiliadoForm.domCp ? `C.P. ${afiliadoForm.domCp}` : '',
      afiliadoForm.domMunicipio,
      afiliadoForm.domEstado,
    ].filter(Boolean).join(', ')
    try {
      const r = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: afiliadoForm.name, email: afiliadoForm.email, password: afiliadoForm.password, phone: afiliadoForm.phone, ciudad: afiliadoForm.ciudad, cedula: afiliadoForm.cedula, porcentaje: afiliadoForm.porcentaje === '' ? null : Number(afiliadoForm.porcentaje), specialty: afiliadoForm.specialty || null, address: address || null }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { setAfiliadoSuccess('Comisionista registrado'); setTimeout(() => { setShowNuevoAfiliado(false); setAfiliadoForm({ name: '', email: '', password: '', phone: '', ciudad: '', cedula: '', porcentaje: '', specialty: '', domCalle: '', domColonia: '', domCp: '', domMunicipio: '', domEstado: '' }); loadAfiliados() }, 1200) }
      else setAfiliadoError(d.error || 'Error al crear')
    } catch { setAfiliadoError('Error de red') }
  }

  async function toggleAfiliado(id: string, active: boolean) {
    await fetch('/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, active }) })
    loadAfiliados()
  }

  async function guardarAfiliado() {
    if (!editAfiliado) return
    const rawPct = (editAfiliado as any).porcentaje
    const body: any = {
      id: editAfiliado.id,
      ciudad: editAfiliado.ciudad ?? null,
      porcentaje: rawPct == null || String(rawPct).trim() === '' ? null : Number(rawPct),
      cedula: editAfiliado.cedula ?? null,
      phone: (editAfiliado as any).phone ?? null,
      specialty: (editAfiliado as any).specialty ?? null,
      address: editAfiliado.address || null,
    }
    try {
      const r = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        setEditAfiliado(null)
        setAfiliadoError('')
        loadAfiliados()
      } else {
        setAfiliadoError(d.error || 'Error al actualizar el comisionista')
      }
    } catch {
      setAfiliadoError('Error de red al guardar cambios')
    }
  }

  async function asignarCaso(
    caseId: string,
    abogadoId: string,
    precioCliente: string,
    honorarioAbogado: string,
    estatusCliente: string,
    estadoAsignacion: string,
    statusPro: string,
    ciudadCaso: string,
    courtType: string,
    courtNumber: string,
    expedienteReal: string,
    notes: string,
  ) {
    setCasosMsg('')
    setCasosMsgTipo('ok')
    try {
      const currentCase = casos.find(c => c.id === caseId)
      const reassignment = !!currentCase?.abogado?.id && currentCase.abogado.id !== (abogadoId || null)
      const body: Record<string, unknown> = {
        caseId,
        abogadoId: abogadoId || null,
        precioCliente: precioCliente ? Number(precioCliente) : null,
        estatusCliente,
        estadoAsignacion,
        status: statusPro || undefined,
        ciudad: ciudadCaso || null,
        courtType: courtType || null,
        courtNumber: courtNumber || null,
        expedienteReal: expedienteReal || null,
        notes: notes || null,
      }
      // Una reasignación limpia el acuerdo anterior; el nuevo honorario se captura en una acción posterior.
      if (!reassignment) body.honorarioAbogado = honorarioAbogado ? Number(honorarioAbogado) : null
      const r = await fetch('/api/admin/casos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        setCasosMsg(reassignment
          ? 'Caso reasignado. Capture y confirme un nuevo honorario para el abogado asignado.'
          : `Caso actualizado${d?.caso?.status ? ` · Estado: ${STATUS_PRO_LABEL[d.caso.status] || d.caso.status}` : ''}`)
        setCasosMsgTipo('ok')
        setAsignandoId(null)
        loadCasos()
      } else {
        setCasosMsg(d?.error || 'Error al actualizar')
        setCasosMsgTipo('err')
        return
      }
    } catch {
      setCasosMsg('Error de red')
      setCasosMsgTipo('err')
    }
    setTimeout(() => setCasosMsg(''), 4500)
  }

  async function registrarPagoAbogado(caseId: string) {
    setCasosMsg('')
    setCasosMsgTipo('ok')
    const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
    setLawyerPaymentSaving(true)
    try {
      const r = await fetch(`/api/admin/casos/${caseId}/lawyer-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lawyerPaymentForm, amount: Number(lawyerPaymentForm.amount), idempotencyKey: key }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setCasosMsg(data.error || 'No se pudo registrar el pago al abogado.')
        setCasosMsgTipo('err')
        return
      }
      setCasosMsg(data.idempotent ? 'El pago ya estaba registrado.' : 'Pago al abogado registrado.')
      setCasosMsgTipo('ok')
      setShowLawyerPayment(false)
      setLawyerPaymentForm({ amount: '', paidAt: new Date().toISOString().slice(0, 16), method: 'TRANSFERENCIA', reference: '', notes: '' })
      await loadFinancials(caseId)
    } catch {
      setCasosMsg('Error de red al registrar el pago.')
      setCasosMsgTipo('err')
    } finally {
      setLawyerPaymentSaving(false)
    }
  }

  async function anularPagoAbogado(caseId: string, paymentId: string) {
    const reason = window.prompt('Motivo de anulación del pago al abogado:')?.trim()
    if (!reason) return
    setCasosMsg('')
    try {
      const r = await fetch(`/api/admin/casos/${caseId}/lawyer-payments/${paymentId}/anular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setCasosMsg(data.error || 'No se pudo anular el pago.')
        setCasosMsgTipo('err')
        return
      }
      setCasosMsg(data.idempotent ? 'El pago ya estaba anulado.' : 'Pago al abogado anulado con trazabilidad.')
      setCasosMsgTipo('ok')
      await loadFinancials(caseId)
    } catch {
      setCasosMsg('Error de red al anular el pago.')
      setCasosMsgTipo('err')
    }
  }

  return (
    <>
      <Head><title>Panel Admin – Demo</title></Head>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0d1117', fontFamily: "'Georgia', serif", color: '#e2e8f0' }}>
        <aside style={{ width: 240, background: '#111827', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', padding: '0', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 10 }}>
          <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid #1e293b' }}>
            <div style={{ fontSize: 13, color: '#64748b', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>Panel de</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#c9a84c', letterSpacing: 1 }}>Administración</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Abogados IA Pro</div>
          </div>
          <nav style={{ flex: 1, padding: '16px 12px' }}>
            {NAV_ITEMS.filter(i => i.id !== 'usuarios').map(item => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '12px 14px',
                  marginBottom: 4,
                  borderRadius: 8,
                  border: 'none',
                  background: section === item.id ? 'rgba(201,168,76,0.12)' : 'transparent',
                  color: section === item.id ? '#c9a84c' : '#94a3b8',
                  fontSize: 14,
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderLeft: section === item.id ? '3px solid #c9a84c' : '3px solid transparent',
                  transition: 'all 0.15s'
                }}
              >
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
            <Link
              href="/admin/legal"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                marginTop: 8,
                borderRadius: 8,
                color: '#94a3b8',
                fontSize: 14,
                textDecoration: 'none',
                borderLeft: '3px solid transparent'
              }}
            >
              <span style={{ fontSize: 18 }}>🏛️</span>
              Gobierno normativo
            </Link>
          </nav>
          <div style={{ padding: '16px 24px', borderTop: '1px solid #1e293b', fontSize: 12, color: '#475569' }}>
            <div>CYMNOVA A.C.</div>
            <div style={{ marginTop: 2, color: '#c9a84c' }}>● Superadmin</div>
          </div>
        </aside>
        <main style={{ marginLeft: 240, flex: 1, padding: '36px 40px' }}>

          {/* ── SECCIÓN: CASOS MARKETPLACE ── */}
          {section === 'casos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Casos del sistema</h1>
                  <p style={{ color: '#64748b', marginTop: 6, fontSize: 14 }}>Bandeja operativa: asigna abogados comisionistas, gestiona estados y datos judiciales</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: filtroSinAsignar ? '#c9a84c' : '#94a3b8' }}>
                    <input type="checkbox" id="sinAsgChk" checked={filtroSinAsignar} onChange={e => { const next = e.target.checked; setFiltroSinAsignar(next); loadCasos({ sinAsignar: next }); }} style={{ accentColor: '#c9a84c' }} />
                    <label htmlFor="sinAsgChk" style={{ cursor: 'pointer' }}>Solo sin asignar</label>
                  </div>
                  <button onClick={() => loadCasos()} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}>Actualizar</button>
                </div>
              </div>

              {casosMsg && <div style={{ background: casosMsgTipo === 'ok' ? 'rgba(201,168,76,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${casosMsgTipo === "ok" ? 'rgba(201,168,76,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: casosMsgTipo === 'ok' ? '#c9a84c' : '#f87171' }}>{casosMsg}</div>}

              {/* Filtros */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {[
                  { label: 'Estado operativo PRO', value: filtroStatusPro, setter: setFiltroStatusPro, options: STATUS_PRO_OPTIONS as unknown as string[], overrideKey: 'statusPro' as const },
                  { label: 'Estado asignación', value: filtroEstado, setter: setFiltroEstado, options: ['TODOS', 'PENDIENTE', 'ASIGNADO', 'EN_PROCESO', 'CERRADO'], overrideKey: 'estadoAsignacion' as const },
                  { label: 'Ciudad', value: filtroCiudad, setter: setFiltroCiudad, options: ['TODAS', ...todasLasCiudades], overrideKey: 'ciudad' as const },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{f.label}</div>
                    <select value={f.value} onChange={e => { const next = e.target.value; f.setter(next); loadCasos({ [f.overrideKey]: next } as any); }} style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 13 }}>
                      {f.options.map(o => <option key={o} value={o}>{o === 'TODOS' || o === 'TODAS' ? o : (STATUS_PRO_LABEL[o] || o)}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Tabla de casos */}
              <div style={{ background: '#111827', borderRadius: 12, border: '1px solid #1e293b', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      {['Expediente', 'Cliente', 'Estado PRO', 'Ciudad / Juzgado', 'Estado asignación', 'Abogado asignado', 'Precio / Honorario', 'Acciones'].map(h => (
                        <th key={h} style={{ padding: '13px 16px', textAlign: 'left', fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {casos.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: '28px 20px', color: '#475569', fontSize: 14, textAlign: 'center' }}>{filtroSinAsignar ? 'Sin casos pendientes de asignación' : 'Sin casos registrados'}</td></tr>
                    )}
                    {casos.map((c, i) => {
                      const isAsignando = asignandoId === c.id
                      const estadoColor: Record<string, string> = { PENDIENTE: '#f87171', ASIGNADO: '#c9a84c', EN_PROCESO: '#60a5fa', CERRADO: '#34d399' }
                      const proColor = STATUS_PRO_COLOR[c.status] || '#94a3b8'
                      const juzgadoText = [c.courtType, c.courtNumber].filter(Boolean).join(' ')
                      return (
                        <tr key={c.id} style={{ borderBottom: i < casos.length - 1 ? '1px solid #0d1117' : 'none', background: isAsignando ? 'rgba(201,168,76,0.04)' : 'transparent' }}>
                          <td style={{ padding: '14px 16px', fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>
                            <div>{c.expediente}</div>
                            {c.expedienteReal && <div style={{ fontSize: 11, color: '#a78bfa', marginTop: 2 }}>Exp. real: {c.expedienteReal}</div>}
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{c.intent || c.matter}</div>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: 13, color: '#94a3b8' }}>{c.client?.name || '—'}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: `${proColor}25`, color: proColor, fontWeight: 600 }}>
                              {STATUS_PRO_LABEL[c.status] || c.status || 'Nuevo'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: 12, color: '#94a3b8' }}>
                            <div style={{ color: '#cbd5e1' }}>{c.ciudad || '—'}</div>
                            {juzgadoText && <div style={{ color: '#64748b', marginTop: 2 }}>{juzgadoText}</div>}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: `${estadoColor[c.estadoAsignacion] || '#94a3b8'}20`, color: estadoColor[c.estadoAsignacion] || '#94a3b8' }}>
                              {c.estadoAsignacion}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: 13, color: c.abogado ? '#c9a84c' : '#475569' }}>
                            <div>{c.abogado?.name || 'Sin asignar'}</div>
                            {c.abogado?.specialty && <div style={{ fontSize: 11, color: '#64748b' }}>{STATUS_PRO_LABEL[c.abogado.specialty] || c.abogado.specialty}</div>}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: 12, color: '#94a3b8' }}>
                            <div>Cliente: {c.precioCliente ? `$${c.precioCliente.toLocaleString()}` : '—'}</div>
                            <div>Abogado: {c.honorarioAbogado ? `$${c.honorarioAbogado.toLocaleString()}` : '—'}</div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <button onClick={() => setAsignandoId(isAsignando ? null : c.id)} style={{ background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 6, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              {isAsignando ? 'Cerrar' : 'Gestionar'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Panel de gestión inline — ESTADO CONTROLADO (sin defaultValue ni let locales) */}
              {asignandoId && (() => {
                const caso = casos.find(c => c.id === asignandoId)
                if (!caso) return null
                const statusOptions = STATUS_PRO_OPTIONS.filter(s => s !== 'TODOS') as unknown as string[]
                return (
                  <div style={{ background: '#111827', border: '1px solid #c9a84c40', borderRadius: 12, padding: 24, marginTop: 16 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>Gestionar expediente</div>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                      <span style={{ color: '#c9a84c', fontWeight: 700 }}>{caso.expediente}</span>
                      {caso.client?.name && <> · Cliente: <span style={{ color: '#e2e8f0' }}>{caso.client.name}</span></>}
                      {caso.expedienteReal && <> · Exp. real: <span style={{ color: '#a78bfa' }}>{caso.expedienteReal}</span></>}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', margin: '10px 0 8px', textTransform: 'uppercase', letterSpacing: 1, borderTop: '1px solid #1e293b', paddingTop: 12 }}>Asignación y operación</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Abogado comisionista</div>
                        <select
                          value={gestAbogado}
                          disabled={!!financialSummary?.huboPagoConfirmado}
                          onChange={e => {
                            const next = e.target.value
                            if (caso.abogado?.id && next !== caso.abogado.id) setGestHonorario('')
                            setGestAbogado(next)
                          }}
                          style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, opacity: financialSummary?.huboPagoConfirmado ? 0.6 : 1 }}
                        >
                          <option value="">Sin asignar</option>
                          {casosAbogados.map(a => {
                            const parts: string[] = [a.name];
                            if (a.specialty) parts.push(STATUS_PRO_LABEL[a.specialty] || a.specialty);
                            if (a.ciudad) parts.push(a.ciudad);
                            const act = typeof a.activosAsignados === 'number' ? a.activosAsignados : 0;
                            parts.push(`${act} activo${act === 1 ? '' : 's'}`);
                            return <option key={a.id} value={a.id}>{parts.join(' · ')}</option>;
                          })}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Estado operativo PRO</div>
                        <select value={gestStatusPro} onChange={e => setGestStatusPro(e.target.value)} style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13 }}>
                          <option value="">(sin cambiar)</option>
                          {statusOptions.map(s => <option key={s} value={s}>{STATUS_PRO_LABEL[s] || s}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Estado asignación</div>
                        <select value={gestEstado} onChange={e => setGestEstado(e.target.value)} style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13 }}>
                          {['PENDIENTE', 'ASIGNADO', 'EN_PROCESO', 'CERRADO'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Precio cliente ($)</div>
                        <input type="number" value={gestPrecio} onChange={e => setGestPrecio(e.target.value)} style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Honorario acordado ($)</div>
                        <input type="number" value={gestHonorario} disabled={!!financialSummary?.huboPagoConfirmado} onChange={e => setGestHonorario(e.target.value)} style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, opacity: financialSummary?.huboPagoConfirmado ? 0.6 : 1 }} />
                        {financialSummary?.huboPagoConfirmado && <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 5 }}>Bloqueado: existe historial de pago al abogado.</div>}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', margin: '10px 0 8px', textTransform: 'uppercase', letterSpacing: 1, borderTop: '1px solid #1e293b', paddingTop: 12 }}>Control financiero del expediente</div>
                    {financialLoading ? (
                      <div style={{ color: '#94a3b8', fontSize: 13, padding: '8px 0 16px' }}>Cargando movimientos financieros…</div>
                    ) : financialSummary ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
                          {[
                            ['Precio pactado', financialSummary.precioCliente == null ? '—' : `$${Number(financialSummary.precioCliente).toLocaleString('es-MX')}`, '#e2e8f0'],
                            ['Anticipo cobrado', `$${Number(financialSummary.anticipoCobrado).toLocaleString('es-MX')}`, '#34d399'],
                            ['Total cobrado', `$${Number(financialSummary.totalCobrado).toLocaleString('es-MX')}`, '#34d399'],
                            ['Saldo cliente', `$${Number(financialSummary.saldoCliente).toLocaleString('es-MX')}`, '#fbbf24'],
                            ['Honorario acordado', financialSummary.honorarioAcordado == null ? 'Pendiente' : `$${Number(financialSummary.honorarioAcordado).toLocaleString('es-MX')}`, '#c9a84c'],
                            ['Pagado al abogado', `$${Number(financialSummary.honorarioPagado).toLocaleString('es-MX')}`, '#60a5fa'],
                            ['Saldo por liquidar', financialSummary.saldoPorLiquidar == null ? '—' : `$${Number(financialSummary.saldoPorLiquidar).toLocaleString('es-MX')}`, '#fbbf24'],
                          ].map(([label, value, color]) => (
                            <div key={label} style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 12px' }}>
                              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
                              <div style={{ marginTop: 4, color, fontSize: 15, fontWeight: 700 }}>{value}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: financialSummary.honorarioConfirmado ? '#34d399' : '#fbbf24' }}>
                            {financialSummary.honorarioConfirmado ? 'Honorario confirmado por ADMIN.' : 'Honorario pendiente de confirmación manual.'}
                          </span>
                          <button
                            disabled={!financialSummary.anticipoConfirmado || !financialSummary.honorarioConfirmado || financialSummary.saldoPorLiquidar === null || financialSummary.saldoPorLiquidar <= 0}
                            onClick={() => setShowLawyerPayment(v => !v)}
                            style={{ background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 7, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: !financialSummary.anticipoConfirmado || !financialSummary.honorarioConfirmado || !financialSummary.saldoPorLiquidar ? 0.5 : 1 }}
                          >
                            {showLawyerPayment ? 'Cerrar pago' : 'Registrar pago al abogado'}
                          </button>
                          {!financialSummary.anticipoConfirmado && <span style={{ fontSize: 11, color: '#f87171' }}>Requiere anticipo confirmado.</span>}
                        </div>
                        {showLawyerPayment && (
                          <div style={{ background: '#0d1117', border: '1px solid #c9a84c40', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                              <input type="number" min="0.01" step="0.01" placeholder="Importe pagado" value={lawyerPaymentForm.amount} onChange={e => setLawyerPaymentForm(f => ({ ...f, amount: e.target.value }))} style={{ background: '#111827', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', padding: '8px 10px' }} />
                              <input type="datetime-local" value={lawyerPaymentForm.paidAt} onChange={e => setLawyerPaymentForm(f => ({ ...f, paidAt: e.target.value }))} style={{ background: '#111827', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', padding: '8px 10px' }} />
                              <select value={lawyerPaymentForm.method} onChange={e => setLawyerPaymentForm(f => ({ ...f, method: e.target.value }))} style={{ background: '#111827', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', padding: '8px 10px' }}>
                                <option value="TRANSFERENCIA">Transferencia</option>
                                <option value="EFECTIVO">Efectivo</option>
                                <option value="OTRO">Otro</option>
                              </select>
                              <input placeholder="Referencia (opcional)" value={lawyerPaymentForm.reference} onChange={e => setLawyerPaymentForm(f => ({ ...f, reference: e.target.value }))} style={{ background: '#111827', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', padding: '8px 10px' }} />
                            </div>
                            <textarea rows={2} placeholder="Notas (opcional)" value={lawyerPaymentForm.notes} onChange={e => setLawyerPaymentForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, background: '#111827', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', padding: '8px 10px', resize: 'vertical' }} />
                            <button onClick={() => registrarPagoAbogado(asignandoId)} disabled={lawyerPaymentSaving} style={{ marginTop: 10, background: '#34d399', color: '#06251a', border: 'none', borderRadius: 7, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: lawyerPaymentSaving ? 0.7 : 1 }}>
                              {lawyerPaymentSaving ? 'Registrando…' : 'Confirmar pago efectuado'}
                            </button>
                          </div>
                        )}
                        <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                          <div style={{ padding: '9px 12px', color: '#94a3b8', fontSize: 12, borderBottom: '1px solid #1e293b' }}>Pagos de PRO al abogado</div>
                          {lawyerPayments.length === 0 ? <div style={{ padding: '11px 12px', color: '#64748b', fontSize: 12 }}>Sin pagos registrados.</div> : lawyerPayments.map(payment => (
                            <div key={payment.id} style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #1e293b', fontSize: 12, flexWrap: 'wrap' }}>
                              <span style={{ color: payment.status === 'ANULADO' ? '#f87171' : '#34d399', fontWeight: 700 }}>${Number(payment.amount).toLocaleString('es-MX')} · {payment.status}</span>
                              <span style={{ color: '#94a3b8' }}>{new Date(payment.paidAt).toLocaleDateString('es-MX')} · {payment.method}{payment.reference ? ` · ${payment.reference}` : ''}</span>
                              {payment.status === 'CONFIRMADO' && <button onClick={() => anularPagoAbogado(asignandoId, payment.id)} style={{ background: 'transparent', border: '1px solid #7f1d1d', color: '#f87171', borderRadius: 5, padding: '4px 7px', fontSize: 11, cursor: 'pointer' }}>Anular</button>}
                              {payment.status === 'ANULADO' && payment.voidReason && <span style={{ color: '#fbbf24' }}>Motivo: {payment.voidReason}</span>}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ color: '#f87171', fontSize: 12, padding: '8px 0 16px' }}>No se pudo cargar el resumen financiero.</div>
                    )}
                    <div style={{ fontSize: 11, color: '#64748b', margin: '10px 0 8px', textTransform: 'uppercase', letterSpacing: 1, borderTop: '1px solid #1e293b', paddingTop: 12 }}>Datos judiciales</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Ciudad / Municipio</div>
                        <input value={gestCiudad} onChange={e => setGestCiudad(e.target.value)} placeholder="Guanajuato" style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Juzgado / Tribunal</div>
                        <input value={gestCourtType} onChange={e => setGestCourtType(e.target.value)} placeholder="Juzgado 1er Civil" style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Número juzgado</div>
                        <input value={gestCourtNumber} onChange={e => setGestCourtNumber(e.target.value)} placeholder="12" style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>N° expediente judicial</div>
                        <input value={gestExpedienteReal} onChange={e => setGestExpedienteReal(e.target.value)} placeholder="345/2025" style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Estado cliente (portal)</div>
                        <select value={gestEstatusCliente} onChange={e => setGestEstatusCliente(e.target.value)} style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13 }}>
                          {ESTATUS_CLIENTE_OPTIONS.map(s => <option key={s} value={s}>{ESTATUS_CLIENTE_LABEL[s]}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', margin: '10px 0 8px', textTransform: 'uppercase', letterSpacing: 1, borderTop: '1px solid #1e293b', paddingTop: 12 }}>Observaciones operativas</div>
                    <textarea
                      value={gestNotes}
                      onChange={e => setGestNotes(e.target.value)}
                      rows={3}
                      placeholder="Notas internas, datos de presentación, adjuntos, etc."
                      style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 13, resize: 'vertical', marginBottom: 16, fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button onClick={() => asignarCaso(asignandoId, gestAbogado, gestPrecio, gestHonorario, gestEstatusCliente, gestEstado, gestStatusPro, gestCiudad, gestCourtType, gestCourtNumber, gestExpedienteReal, gestNotes)} style={{ background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Guardar cambios</button>
                      <button onClick={() => setAsignandoId(null)} style={{ background: 'transparent', color: '#64748b', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>Cerrar</button>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── SECCIÓN: PRECIOS ── */}
          {section === 'precios' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Precios de servicios</h1>
                  <p style={{ color: '#64748b', marginTop: 6, fontSize: 14 }}>Edita precios base y modificadores usados en la cotización del portal</p>
                </div>
                <button onClick={loadPrecios} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}>Actualizar</button>
              </div>

              {preciosMsg && <div style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#c9a84c' }}>{preciosMsg}</div>}

              <div style={{ background: '#111827', borderRadius: 12, border: '1px solid #1e293b', overflow: 'hidden', marginBottom: 18 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      {['Servicio', 'Precio base', 'Desde', 'Acción'].map(h => (
                        <th key={h} style={{ padding: '13px 16px', textAlign: 'left', fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {serviciosCfg.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: '28px 20px', color: '#475569', fontSize: 14, textAlign: 'center' }}>Sin precios configurados</td></tr>
                    )}
                    {serviciosCfg.map((s: any, i: number) => (
                      <tr key={s.servicioId} style={{ borderBottom: i < serviciosCfg.length - 1 ? '1px solid #0d1117' : 'none' }}>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{s.nombre}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <input
                            type="number"
                            value={String(s.precioBase ?? '')}
                            onChange={e => setServiciosCfg(prev => prev.map((x: any) => x.servicioId === s.servicioId ? { ...x, precioBase: e.target.value } : x))}
                            style={{ width: 160, background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#94a3b8' }}>{s.precioDesde ? 'Sí' : 'No'}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <button
                            onClick={() => saveServicio(s.servicioId, Number(s.precioBase))}
                            disabled={savingKey === `svc:${s.servicioId}`}
                            style={{ background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 6, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: savingKey === `svc:${s.servicioId}` ? 0.7 : 1 }}
                          >
                            Guardar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ background: '#111827', borderRadius: 12, border: '1px solid #1e293b', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      {['Modificador', 'Valor', 'Acción'].map(h => (
                        <th key={h} style={{ padding: '13px 16px', textAlign: 'left', fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modsCfg.length === 0 && (
                      <tr><td colSpan={3} style={{ padding: '28px 20px', color: '#475569', fontSize: 14, textAlign: 'center' }}>Sin modificadores configurados</td></tr>
                    )}
                    {modsCfg.map((m: any, i: number) => (
                      <tr key={m.key} style={{ borderBottom: i < modsCfg.length - 1 ? '1px solid #0d1117' : 'none' }}>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{m.key}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <input
                            type="number"
                            value={String(m.valor ?? '')}
                            onChange={e => setModsCfg(prev => prev.map((x: any) => x.key === m.key ? { ...x, valor: e.target.value } : x))}
                            style={{ width: 160, background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <button
                            onClick={() => saveMod(m.key, Number(m.valor))}
                            disabled={savingKey === `mod:${m.key}`}
                            style={{ background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 6, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: savingKey === `mod:${m.key}` ? 0.7 : 1 }}
                          >
                            Guardar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SECCIÓN: ABOGADOS COMISIONISTAS ── */}
          {section === 'afiliados' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Abogados Comisionistas</h1>
                  <p style={{ color: '#64748b', marginTop: 6, fontSize: 14 }}>Abogados comisionistas autorizados por Abogados IA Pro para atender asuntos</p>
                  <p style={{ color: '#475569', marginTop: 4, fontSize: 12 }}>
                    <span style={{ color: '#64748b' }}>Nota:</span> cobertura multi-municipio por abogado, capacidad máxima configurable y flag de disponibilidad para nuevos asuntos requieren actualización Prisma pendiente; estos ítems se muestran como Ciudad base y conteo objetivo de casos asignados.
                  </p>
                </div>
                <button onClick={() => { setShowNuevoAfiliado(true); setAfiliadoError(''); setAfiliadoSuccess('') }} style={{ background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  + Registrar comisionista
                </button>
              </div>

              <div style={{ background: '#111827', borderRadius: 12, border: '1px solid #1e293b', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1080 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      {['Nombre', 'Especialidad', 'Ciudad base', 'Correo', 'Cédula', 'Comisión %', 'Carga / Casos', 'Estado', 'Acciones'].map(h => (
                        <th key={h} style={{ padding: '13px 16px', textAlign: 'left', fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {afiliados.length === 0 && (
                      <tr><td colSpan={9} style={{ padding: '28px 20px', color: '#475569', fontSize: 14, textAlign: 'center' }}>Sin comisionistas registrados</td></tr>
                    )}
                    {afiliados.map((a, i) => {
                      const sp = a.specialty ? SPECIALTY_BADGE[a.specialty] : null;
                      const activosAsignados = (a.caseCounts && typeof a.caseCounts.activos === 'number') ? a.caseCounts.activos : 0;
                      const cerrados = (a.caseCounts && typeof a.caseCounts.cerrados === 'number') ? a.caseCounts.cerrados : 0;
                      const archivados = (a.caseCounts && typeof a.caseCounts.archivados === 'number') ? a.caseCounts.archivados : 0;
                      return (
                        <tr key={a.id} style={{ borderBottom: i < afiliados.length - 1 ? '1px solid #0d1117' : 'none' }}>
                          <td style={{ padding: '15px 16px', fontSize: 14, color: '#e2e8f0', fontWeight: 500, whiteSpace: 'nowrap' }}>{a.name}</td>
                          <td style={{ padding: '15px 16px' }}>
                            {sp ? (
                              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: sp.bg, color: sp.color, fontWeight: 700 }}>{sp.label}</span>
                            ) : (
                              <span style={{ fontSize: 12, color: '#475569' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '15px 16px', fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap' }}>{a.ciudad || '—'}</td>
                          <td style={{ padding: '15px 16px', fontSize: 13, color: '#64748b' }}>{a.email}</td>
                          <td style={{ padding: '15px 16px', fontSize: 13, color: '#94a3b8' }}>{a.cedula || '—'}</td>
                          <td style={{ padding: '15px 16px', fontSize: 13, color: a.porcentaje != null ? '#c9a84c' : '#475569' }}>
                            {a.porcentaje != null ? `${a.porcentaje}%` : '—'}
                          </td>
                          <td style={{ padding: '15px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(100,116,139,0.14)', color: '#cbd5e1', fontWeight: 700, display: 'inline-block', width: 'max-content' }}>
                                {activosAsignados} activo{activosAsignados === 1 ? '' : 's'}
                              </span>
                              {(cerrados > 0 || archivados > 0) && (
                                <span title={`Cerrados ${cerrados} · Archivados ${archivados}`} style={{ fontSize: 11, color: '#475569' }}>
                                  Histórico: {cerrados} cerr. · {archivados} arch.
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '15px 16px' }}>
                            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: a.active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: a.active ? '#34d399' : '#ef4444', fontWeight: 700 }}>
                              {a.active ? 'ACTIVO' : 'BAJA'}
                            </span>
                          </td>
                          <td style={{ padding: '15px 16px', display: 'flex', gap: 8 }}>
                            <button onClick={() => { setAfiliadoError(''); setEditAfiliado({ ...a }); }} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>Editar</button>
                            <button onClick={() => toggleAfiliado(a.id, !a.active)} style={{ background: a.active ? '#7f1d1d' : '#065f46', color: a.active ? '#fca5a5' : '#34d399', border: 'none', borderRadius: 6, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
                              {a.active ? 'Dar de baja' : 'Activar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Modal editar comisionista */}
              {editAfiliado && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                  <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 16, padding: 32, width: 'min(480px, 96vw)' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 20 }}>Editar comisionista</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>{editAfiliado.name} · {editAfiliado.email}</div>
                    {afiliadoError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{afiliadoError}</div>}
                    {[
                      { label: 'Teléfono', key: 'phone', type: 'tel', placeholder: 'Ej: 477 123 4567' },
                      { label: 'Ciudad', key: 'ciudad', type: 'text', placeholder: 'Ej: León' },
                      { label: 'Cédula profesional', key: 'cedula', type: 'text', placeholder: 'Número de cédula' },
                      { label: 'Domicilio completo', key: 'address', type: 'text', placeholder: 'Calle, Col., C.P., Municipio, Estado' },
                    ].map(f => (
                      <div key={f.key} style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>{f.label}</label>
                        <input type={f.type} placeholder={f.placeholder} value={(editAfiliado as any)[f.key] || ''} onChange={e => setEditAfiliado({ ...editAfiliado, [f.key]: e.target.value })} style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 13 }} />
                      </div>
                    ))}
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Especialidad</label>
                      <select value={(editAfiliado as any).specialty || ''} onChange={e => setEditAfiliado({ ...editAfiliado, specialty: e.target.value || null })} style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 13 }}>
                        <option value="">— Sin asignar —</option>
                        <option value="CIVIL">CIVIL</option>
                        <option value="FAMILIAR">FAMILIAR</option>
                        <option value="LABORAL">LABORAL</option>
                      </select>
                    </div>
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Comisión % (ej: 32.5)</label>
                      <input type="number" step="0.01" min="0" max="100" placeholder="32.5" value={editAfiliado.porcentaje ?? ''} onChange={e => setEditAfiliado({ ...editAfiliado, porcentaje: e.target.value === '' ? null : Number(e.target.value) })} style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={guardarAfiliado} style={{ background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Guardar</button>
                      <button onClick={() => { setEditAfiliado(null); setAfiliadoError('') }} style={{ background: 'transparent', color: '#64748b', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal nuevo comisionista */}
              {showNuevoAfiliado && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                  <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 16, padding: 32, width: 'min(520px, 96vw)' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Registrar nuevo comisionista</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 22 }}>El abogado comisionista podrá iniciar sesión con estas credenciales</div>
                    {afiliadoError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{afiliadoError}</div>}
                    {afiliadoSuccess && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#34d399', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{afiliadoSuccess}</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      {[
                        { label: 'Nombre completo *', key: 'name', type: 'text', col: '1/-1' },
                        { label: 'Correo electrónico *', key: 'email', type: 'email', col: '1/-1' },
                        { label: 'Contraseña temporal *', key: 'password', type: 'password', col: '1/-1' },
                        { label: 'Ciudad', key: 'ciudad', type: 'text', col: '' },
                        { label: 'Teléfono', key: 'phone', type: 'tel', col: '' },
                        { label: 'Cédula profesional', key: 'cedula', type: 'text', col: '' },
                      ].map(f => (
                        <div key={f.key} style={{ gridColumn: f.col || 'auto' }}>
                          <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>{f.label}</label>
                          <input type={f.type} value={(afiliadoForm as any)[f.key]} onChange={e => setAfiliadoForm({ ...afiliadoForm, [f.key]: e.target.value })} style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 13 }} />
                        </div>
                      ))}
                      <div style={{ gridColumn: '1 / 1' }}>
                        <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Especialidad</label>
                        <select value={(afiliadoForm as any).specialty || ''} onChange={e => setAfiliadoForm({ ...afiliadoForm, specialty: e.target.value })} style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 13 }}>
                          <option value="">— Sin asignar —</option>
                          <option value="CIVIL">CIVIL</option>
                          <option value="FAMILIAR">FAMILIAR</option>
                          <option value="LABORAL">LABORAL</option>
                        </select>
                      </div>
                      <div style={{ gridColumn: '2 / 3' }}>
                        <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Comisión % (ej: 32.5)</label>
                        <input type="number" step="0.01" min="0" max="100" placeholder="32.5" value={(afiliadoForm as any).porcentaje} onChange={e => setAfiliadoForm({ ...afiliadoForm, porcentaje: e.target.value })} style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 13 }} />
                      </div>
                      {/* Domicilio completo */}
                      <div style={{ gridColumn: '1/-1', borderTop: '1px solid #1e293b', paddingTop: 14, marginTop: 4 }}>
                        <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Domicilio completo</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          {[
                            { label: 'Calle y número', key: 'domCalle', col: '1/-1', placeholder: 'Ej: Blvd. Torres Landa 1234' },
                            { label: 'Colonia', key: 'domColonia', col: '', placeholder: 'Ej: Col. Centro' },
                            { label: 'C.P.', key: 'domCp', col: '', placeholder: 'Ej: 37000' },
                            { label: 'Municipio', key: 'domMunicipio', col: '', placeholder: 'Ej: León' },
                            { label: 'Estado', key: 'domEstado', col: '', placeholder: 'Ej: Guanajuato' },
                          ].map(f => (
                            <div key={f.key} style={{ gridColumn: f.col || 'auto' }}>
                              <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>{f.label}</label>
                              <input type="text" placeholder={f.placeholder} value={(afiliadoForm as any)[f.key]} onChange={e => setAfiliadoForm({ ...afiliadoForm, [f.key]: e.target.value })} style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 13 }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
                      <button onClick={crearAfiliado} style={{ background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 8, padding: '11px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Registrar</button>
                      <button onClick={() => { setAfiliadoError(''); setShowNuevoAfiliado(false) }} style={{ background: 'transparent', color: '#64748b', border: '1px solid #1e293b', borderRadius: 8, padding: '11px 20px', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {section === 'documentos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Leyes y Documentos</h1>
                  <p style={{ color: '#64748b', marginTop: 6, fontSize: 14 }}>Gestiona el corpus jurídico del sistema RAG</p>
                </div>
                <button
                  onClick={() => setShowUpload(!showUpload)}
                  style={{ background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  {showUpload ? '✕ Cancelar' : '+ Cargar ley'}
                </button>
              </div>
              {showUpload && (
                <div style={{ background: '#111827', border: '1px solid #1e3a5f', borderRadius: 12, padding: 28, marginBottom: 28 }}>
                  <OfficialPdfUpload />
                  <p style={{ margin: '14px 0 0', color: '#64748b', fontSize: 12, lineHeight: 1.5 }}>
                    Las cargas históricas de texto se conservan para compatibilidad, pero los nuevos documentos jurídicos deben entrar por este flujo gobernado.
                  </p>
                </div>
              )}
              <div style={{ background: '#111827', borderRadius: 12, border: '1px solid #1e293b', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      {['Código', 'Tipo', 'Jurisdicción', 'Estado', 'Artículos', 'Estado de carga', 'Acciones'].map(h => (
                        <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {laws.map((l, i) => (
                      <tr key={l.id} style={{ borderBottom: i < laws.length - 1 ? '1px solid #0d1117' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '16px 20px', fontSize: 14, color: '#e2e8f0', fontWeight: 500 }}>
                          {l.title}
                          {l.badge && <span style={{ marginLeft: 10, fontSize: 11, color: '#c9a84c', border: '1px solid #c9a84c', borderRadius: 14, padding: '2px 8px' }}>{l.badge}</span>}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: l.tipo === 'Sustantivo' ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)', color: l.tipo === 'Sustantivo' ? '#60a5fa' : '#c084fc' }}>{l.tipo}</span>
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: 13, color: '#94a3b8' }}>{l.jurisdiccion}</td>
                        <td style={{ padding: '16px 20px', fontSize: 13, color: '#94a3b8' }}>{l.estado}</td>
                        <td style={{ padding: '16px 20px', fontSize: 13, color: l.articulos > 0 ? '#34d399' : '#475569' }}>{l.articulos > 0 ? l.articulos.toLocaleString() : '—'}</td>
                        <td style={{ padding: '16px 20px', fontSize: 13, color: l.articulos > 0 ? '#34d399' : '#ef4444' }}>{l.articulos > 0 ? 'Cargado' : 'Sin cargar'}</td>
                        <td style={{ padding: '16px 20px' }}>
                          <button
                            onClick={() => openView(l.id)}
                            style={{ background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 6, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 24, fontSize: 13, color: '#475569' }}>
                <span>Total: <strong style={{ color: '#94a3b8' }}>{laws.length} documentos</strong></span>
                <span>Activos: <strong style={{ color: '#c9a84c' }}>{laws.filter(l => l.activo).length}</strong></span>
                <span>Pendientes: <strong style={{ color: '#f87171' }}>{laws.filter(l => !l.activo).length}</strong></span>
              </div>
            </div>
          )}
          {modalOpen && section === 'documentos' && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
              <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24, width: 'min(600px, 94vw)' }}>
                {modalMode === 'menu' && (
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Acciones</div>
                    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                      <button onClick={startUpdate} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 14, cursor: 'pointer' }}>Actualizar ley</button>
                      <button onClick={startDelete} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 14, cursor: 'pointer' }}>Eliminar ley</button>
                      <button onClick={cancelModal} style={{ background: '#0d1117', color: '#94a3b8', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                )}
                {modalMode === 'revisar' && (
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Revisar código</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, marginBottom: 12 }}>
                      <input value={reviewQuery} onChange={e => { setReviewQuery(e.target.value); setReviewPage(1); }} placeholder="Buscar en artículos..." className="input" style={{ flex: 1 }} />
                      <span className="muted">Total: {reviewDocs.length}</span>
                    </div>
                    <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid #1e293b', borderRadius: 8 }}>
                      {(reviewDocs.filter(d => (reviewQuery ? (d.title + ' ' + (d.content || '')).toLowerCase().includes(reviewQuery.toLowerCase()) : true)))
                        .slice((reviewPage - 1) * pageSize, reviewPage * pageSize)
                        .map(d => (
                          <div key={d.id} style={{ padding: '12px 14px', borderBottom: '1px solid #0d1117' }}>
                            <div style={{ color: '#c9a84c', fontSize: 13, marginBottom: 6 }}>{d.title}</div>
                            <div style={{ color: '#e2e8f0', fontSize: 13, whiteSpace: 'pre-wrap' }}>{d.content || 'Sin contenido'}</div>
                          </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="button" onClick={startUpdate}>Actualizar código</button>
                        <button className="button" style={{ background: '#ef4444' }} onClick={startDelete}>Eliminar contenido</button>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="button" disabled={reviewPage === 1} onClick={() => setReviewPage(p => Math.max(1, p - 1))}>Anterior</button>
                        <button className="button" disabled={reviewPage * pageSize >= reviewDocs.filter(d => (reviewQuery ? (d.title + ' ' + (d.content || '')).toLowerCase().includes(reviewQuery.toLowerCase()) : true)).length} onClick={() => setReviewPage(p => p + 1)}>Siguiente</button>
                        <button className="button" onClick={cancelModal}>Cerrar</button>
                      </div>
                    </div>
                  </div>
                )}
                {modalMode === 'update' && (
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Actualizar ley</div>
                    <div style={{ marginTop: 12 }}>
                      <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder="Pega el texto completo del código (todas las secciones y artículos)..." style={{ width: '100%', height: 200, background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '12px 14px', color: '#e2e8f0', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => { setModalOpen(false); setShowUpload(true); }} style={{ background: '#0d1117', color: '#c9a84c', border: '1px solid #c9a84c', borderRadius: 8, padding: '10px 14px', fontSize: 14, cursor: 'pointer' }}>
                          Usar carga PDF gobernada
                        </button>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Una actualización mediante PDF siempre crea una versión DRAFT; no reemplaza una versión publicada.</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                      <button onClick={saveUpdatedText} style={{ background: '#22c55e', color: '#0d1117', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Guardar cambios</button>
                      <button onClick={cancelModal} style={{ background: '#0d1117', color: '#94a3b8', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                )}
                {modalMode === 'delete' && (
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Eliminar ley</div>
                    <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 14 }}>¿Confirmas eliminar todo el contenido de este código? Esta acción no se puede deshacer.</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                      <button onClick={confirmDelete} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 14, cursor: 'pointer' }}>Eliminar</button>
                      <button onClick={cancelModal} style={{ background: '#0d1117', color: '#94a3b8', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {section === 'materias' && (
            <div>
              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Materias Activas</h1>
                <p style={{ color: '#64748b', marginTop: 6, fontSize: 14 }}>Controla qué materias aparecen disponibles en el Dashboard de los abogados</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {matters.map(m => (
                  <div
                    key={m.key}
                    style={{ background: '#111827', border: `1px solid ${m.active ? 'rgba(201,168,76,0.3)' : '#1e293b'}`, borderRadius: 12, padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.2s' }}
                  >
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: m.active ? '#f1f5f9' : '#475569' }}>{m.label}</div>
                      <div style={{ fontSize: 12, color: m.active ? '#c9a84c' : '#334155', marginTop: 4 }}>{m.active ? '● Disponible en Dashboard' : '○ No disponible'}</div>
                    </div>
                    <div
                      style={{ width: 52, height: 28, background: m.active ? '#c9a84c' : '#1e293b', borderRadius: 14, cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                      onClick={() => toggleMatter(m.key)}
                    >
                      <div style={{ width: 22, height: 22, background: '#fff', borderRadius: 11, position: 'absolute', top: 3, left: m.active ? 27 : 3, transition: 'left 0.2s' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 20, background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: '14px 20px', fontSize: 13, color: '#64748b' }}>
                ⚠️ Una materia solo se habilita si tiene al menos un documento activo cargado en Leyes y Documentos. Activar aquí sin documentos no tendrá efecto.
              </div>
            </div>
          )}
          {section === 'jurisprudencias' && (
            <div>
              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Jurisprudencias</h1>
                <p style={{ color: '#64748b', marginTop: 6, fontSize: 14 }}>Gestión de criterios y tesis (vista demo)</p>
              </div>
              <div style={{ background: '#111827', borderRadius: 12, border: '1px solid #1e293b', padding: 24 }}>
                <div style={{ color: '#94a3b8', fontSize: 14 }}>Sin contenidos cargados en esta demo. Usa Leyes y Documentos para el corpus principal; conectaremos esta sección en siguiente iteración.</div>
              </div>
            </div>
          )}
          {section === 'usuarios' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Usuarios</h1>
                  <p style={{ color: '#64748b', marginTop: 6, fontSize: 14 }}>Gestión de accesos al sistema</p>
                </div>
                <button
                  onClick={() => {
                    setShowNewUserModal(true);
                    setNewUserError('');
                    setNewUserSuccess('');
                    setNewUserData({ name: '', email: '', password: '', phone: '', specialty: '' });
                  }}
                  style={{ background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  + Nuevo Abogado
                </button>
              </div>
              <div style={{ background: '#111827', borderRadius: 12, border: '1px solid #1e293b', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      {['Nombre', 'Correo', 'Rol', 'Estado', 'Acciones'].map(h => (
                        <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #0d1117' : 'none' }}>
                        <td style={{ padding: '16px 20px', fontSize: 14, color: '#e2e8f0', fontWeight: 500 }}>{u.name}</td>
                        <td style={{ padding: '16px 20px', fontSize: 13, color: '#94a3b8' }}>{u.email}</td>
                        <td style={{ padding: '16px 20px', fontSize: 13, color: u.role === 'ADMIN' ? '#c9a84c' : '#94a3b8' }}>{u.role}</td>
                        <td style={{ padding: '16px 20px', fontSize: 13 }}>{u.active ? 'Activo' : 'Inactivo'}</td>
                        <td style={{ padding: '16px 20px', fontSize: 13 }}>
                          <button onClick={() => setEditUser(u)} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>Editar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {editUser && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                  <div className="card" style={{ width: 'min(520px, 96vw)', background: '#111827', border: '1px solid #1e293b' }}>
                    <div className="title">Editar usuario</div>
                    <div className="muted" style={{ marginBottom: 8 }}>{editUser.name} · {editUser.email}</div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <label style={{ color: '#94a3b8' }}>Rol</label>
                      <select className="select" value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value as 'ADMIN' | 'ABOGADO' })}>
                        <option value="ADMIN">ADMIN</option>
                        <option value="ABOGADO">ABOGADO</option>
                      </select>
                      <label style={{ color: '#94a3b8' }}>Activo</label>
                      <div style={{ width: 52, height: 28, background: editUser.active ? '#c9a84c' : '#1e293b', borderRadius: 14, cursor: 'pointer', position: 'relative' }} onClick={() => setEditUser({ ...editUser, active: !editUser.active })}>
                        <div style={{ width: 22, height: 22, background: '#fff', borderRadius: 11, position: 'absolute', top: 3, left: editUser.active ? 27 : 3, transition: 'left 0.2s' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                        <button
                          className="button"
                          onClick={async () => {
                            const headers = { 'Content-Type': 'application/json' };
                            const resActive = await fetch('/api/admin/users', {
                              method: 'PUT',
                              headers,
                              body: JSON.stringify({ id: editUser.id, active: editUser.active })
                            });
                            let ok = resActive.ok;
                            const resRole = await fetch('/api/admin/users', {
                              method: 'PATCH',
                              headers,
                              body: JSON.stringify({ id: editUser.id, role: editUser.role })
                            });
                            ok = ok && resRole.ok;
                            if (ok) {
                              setEditUser(null);
                              const r = await fetch('/api/admin/users');
                              const data = await r.json().catch(() => ({}));
                              setUsers(Array.isArray(data.users) ? data.users : []);
                            }
                          }}
                        >
                          Guardar
                        </button>
                        <button className="button" onClick={() => setEditUser(null)}>Cancelar</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {showNewUserModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                  <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 16, padding: '32px', width: 'min(500px, 96vw)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Registrar Nuevo Abogado</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Ingresa los datos para crear la cuenta del profesional</div>

                    {newUserError && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                        {newUserError}
                      </div>
                    )}
                    {newUserSuccess && (
                      <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#22c55e', padding: '12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                        {newUserSuccess}
                      </div>
                    )}

                    <div style={{ display: 'grid', gap: 16 }}>
                      <div>
                        <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>Nombre completo *</label>
                        <input
                          style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 13 }}
                          value={newUserData.name}
                          onChange={e => setNewUserData({ ...newUserData, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>Correo electrónico *</label>
                        <input
                          type="email"
                          style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 13 }}
                          value={newUserData.email}
                          onChange={e => setNewUserData({ ...newUserData, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>Contraseña temporal * (mín. 8 chars)</label>
                        <input
                          type="password"
                          style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 13 }}
                          value={newUserData.password}
                          onChange={e => setNewUserData({ ...newUserData, password: e.target.value })}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>Teléfono</label>
                          <input
                            style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 13 }}
                            value={newUserData.phone}
                            onChange={e => setNewUserData({ ...newUserData, phone: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>Especialidad</label>
                          <input
                            style={{ width: '100%', background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 13 }}
                            value={newUserData.specialty}
                            onChange={e => setNewUserData({ ...newUserData, specialty: e.target.value })}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                        <button
                          style={{ background: '#c9a84c', color: '#0d1117', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                          onClick={async () => {
                            setNewUserError('');
                            setNewUserSuccess('');
                            if (!newUserData.name || !newUserData.email || !newUserData.password) {
                              setNewUserError('Nombre, correo y contraseña son obligatorios.');
                              return;
                            }
                            if (newUserData.password.length < 8) {
                              setNewUserError('La contraseña debe tener al menos 8 caracteres.');
                              return;
                            }
                            try {
                              const res = await fetch('/api/auth/register', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ...newUserData, role: 'ABOGADO' })
                              });
                              const data = await res.json();
                              if (res.ok) {
                                setNewUserSuccess('Abogado creado correctamente');
                                setTimeout(async () => {
                                  setShowNewUserModal(false);
                                  const r = await fetch('/api/admin/users');
                                  const udata = await r.json().catch(() => ({}));
                                  setUsers(Array.isArray(udata.users) ? udata.users : []);
                                }, 1500);
                              } else {
                                setNewUserError(data.error || 'Error al registrar abogado');
                              }
                            } catch {
                              setNewUserError('Error de red');
                            }
                          }}
                        >
                          Guardar
                        </button>
                        <button
                          style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 24px', fontSize: 14, cursor: 'pointer' }}
                          onClick={() => setShowNewUserModal(false)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {section === 'estados' && (
            <div>
              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Catálogo de Estados</h1>
                <p style={{ color: '#64748b', marginTop: 6, fontSize: 14 }}>Estados disponibles para documentos estatales</p>
              </div>
              <div style={{ background: '#111827', borderRadius: 12, border: '1px solid #1e293b', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      {['Estado', 'Documentos asociados'].map(h => (
                        <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {STATES.map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: i < STATES.length - 1 ? '1px solid #0d1117' : 'none' }}>
                        <td style={{ padding: '16px 20px', fontSize: 14, color: '#e2e8f0', fontWeight: 500 }}>{s.nombre}</td>
                        <td style={{ padding: '16px 20px', fontSize: 13, color: s.docs > 0 ? '#c9a84c' : '#94a3b8' }}>{s.docs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const auth = getAuthFromCookies(req.headers.cookie)
  if (!auth || auth.role !== 'ADMIN') {
    return { redirect: { destination: '/login', permanent: false } }
  }
  return { props: {} }
}
