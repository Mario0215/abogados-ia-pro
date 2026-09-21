import 'dotenv/config';
import { prisma } from '../lib/prisma';

type SeedItem = { title: string; matter: string; content: string };

const SEED_ITEMS: SeedItem[] = [
  {
    title: 'Demanda Ordinaria Civil — Divorcio',
    matter: 'CIVIL',
    content: `C. JUEZ DE LO CIVIL EN TURNO
PRESENTE.

C. [ACTOR], mexicano(a), mayor de edad, en pleno ejercicio de mis derechos civiles, señalando como domicilio para oír y recibir notificaciones [DOMICILIO_ACTOR], Ciudad de León, Gto.; autorizando en los términos más amplios del Código Civil vigente para el Estado de Guanajuato a los profesionistas que designe.

Ante usted, con el debido respeto, comparezco para exponer:

Que en la VÍA ORDINARIA CIVIL y con fundamento en los artículos 323, 324 y relativos del Código Civil vigente en el Estado de Guanajuato, vengo a entablar formal demanda en contra de mi cónyuge, [DEMANDADO], quien para efectos de emplazamiento tiene su domicilio en [DOMICILIO_EMPLAZAMIENTO], y a quien reclamo lo siguiente:

PRESTACIONES

A). La disolución del vínculo matrimonial que me une con [DEMANDADO].
B). La guarda y custodia de los hijos menores de edad: [COMPLETAR NOMBRES Y EDADES].
C). El pago de alimentos para los hijos menores, equivalente al [COMPLETAR]% de los ingresos del demandado.
D). La liquidación de la sociedad conyugal y adjudicación de bienes.
E). El pago de costas y gastos del juicio.

H E C H O S:

1.- Con fecha [COMPLETAR], el suscrito y [DEMANDADO] contrajeron matrimonio civil ante el Oficial del Registro Civil No. [COMPLETAR], bajo el régimen de [COMPLETAR], acta No. [COMPLETAR].
2.- De dicha unión procreamos [COMPLETAR] hijos de nombres [COMPLETAR], quienes tienen [COMPLETAR] años y viven en [COMPLETAR].
3.- A partir de [COMPLETAR], el demandado(a) incurrió en la causa de divorcio prevista en el artículo 323 fracción [COMPLETAR] del Código Civil, consistente en: [COMPLETAR].
4.- La vida en común se ha vuelto imposible, siendo necesaria la disolución del vínculo matrimonial.
5.- Los bienes de la sociedad conyugal son: [COMPLETAR LISTADO DE BIENES].

DERECHO

I.- Artículos 323 y 324 del Código Civil del Estado de Guanajuato.
II.- Artículos 365 y siguientes del Código Civil, relativos a alimentos.
III.- Artículos del Código de Procedimientos Civiles del Estado de Guanajuato.

Por lo anteriormente expuesto y fundado a Usted, C. Juez, atentamente le solicito:

PRIMERO.- Tenerme por presentado con la presente demanda de DIVORCIO.
SEGUNDO.- Admitir la demanda y ordenar el emplazamiento de [DEMANDADO].
TERCERO.- Dictar sentencia declarando disuelto el vínculo matrimonial.
CUARTO.- Resolver sobre custodia, visitas y alimentos de los menores.
QUINTO.- Condenar al demandado al pago de costas.

PROTESTO LO NECESARIO
LEÓN, GTO., AL DÍA DE SU PRESENTACIÓN.
[ACTOR]`
  },
  {
    title: 'Demanda Ordinaria Civil — Cobro de Pesos',
    matter: 'CIVIL',
    content: `C. JUEZ DE LO CIVIL EN TURNO
PRESENTE.

C. [ACTOR], mexicano(a), mayor de edad, señalando como domicilio para oír y recibir notificaciones [DOMICILIO_ACTOR], Ciudad de León, Gto.

Ante usted, con el debido respeto, comparezco para exponer:

Que en la VÍA ORDINARIA CIVIL y con fundamento en los artículos 1796, 1797, 1839 y relativos del Código Civil vigente en el Estado de Guanajuato, vengo a entablar formal demanda en contra de [DEMANDADO], quien para efectos de emplazamiento tiene su domicilio en [DOMICILIO_EMPLAZAMIENTO], y a quien reclamo lo siguiente:

PRESTACIONES

A). El pago de la cantidad de $[COMPLETAR] ([COMPLETAR EN LETRA] PESOS M.N.) por concepto de [COMPLETAR].
B). El pago de intereses moratorios al [COMPLETAR]% mensual desde la fecha de vencimiento.
C). El pago de gastos y costas del juicio.

H E C H O S:

1.- Con fecha [COMPLETAR], el suscrito celebró con [DEMANDADO] un contrato de [COMPLETAR], mediante el cual [COMPLETAR].
2.- El demandado quedó obligado a pagar $[COMPLETAR] a más tardar el día [COMPLETAR].
3.- No obstante el plazo pactado, el demandado NO ha realizado pago alguno.
4.- He formulado requerimientos verbales y escritos en fechas [COMPLETAR] sin resultado.
5.- Exhibo como documento base de la acción: [COMPLETAR], el cual se adjunta.

DERECHO

I.- Artículos 1796 y 1797 del Código Civil del Estado de Guanajuato.
II.- Artículo 1839 del Código Civil, relativo al incumplimiento de obligaciones.
III.- Artículos del Código de Procedimientos Civiles del Estado de Guanajuato.

Por lo anteriormente expuesto y fundado a Usted, C. Juez, atentamente le solicito:

PRIMERO.- Tenerme por presentado con la presente demanda de COBRO DE PESOS.
SEGUNDO.- Admitir la demanda y ordenar el emplazamiento del demandado.
TERCERO.- Dictar sentencia condenando a [DEMANDADO] al pago de $[COMPLETAR] más intereses.
CUARTO.- Condenar al demandado al pago de gastos y costas.

PROTESTO LO NECESARIO
LEÓN, GTO., AL DÍA DE SU PRESENTACIÓN.
[ACTOR]`
  },
  {
    title: 'Demanda Ordinaria Civil — Nulidad de Contrato',
    matter: 'CIVIL',
    content: `C. JUEZ DE LO CIVIL EN TURNO
PRESENTE.

C. [ACTOR], mexicano(a), mayor de edad, señalando como domicilio para oír y recibir notificaciones [DOMICILIO_ACTOR], Ciudad de León, Gto.

Ante usted, con el debido respeto, comparezco para exponer:

Que en la VÍA ORDINARIA CIVIL y con fundamento en los artículos 1795, 1812, 1813 y relativos del Código Civil vigente en el Estado de Guanajuato, vengo a entablar formal demanda en contra de [DEMANDADO], quien para efectos de emplazamiento tiene su domicilio en [DOMICILIO_EMPLAZAMIENTO], y a quien reclamo lo siguiente:

PRESTACIONES

A). La declaración judicial de NULIDAD del contrato de [COMPLETAR] celebrado con fecha [COMPLETAR].
B). La restitución de las cosas al estado anterior a la celebración del acto nulo.
C). La devolución de $[COMPLETAR] ([COMPLETAR EN LETRA] PESOS M.N.) entregados al demandado.
D). El pago de daños y perjuicios que se cuantificarán en ejecución de sentencia.
E). El pago de gastos y costas del juicio.

H E C H O S:

1.- Con fecha [COMPLETAR], el suscrito y [DEMANDADO] celebraron un contrato de [COMPLETAR], mediante el cual [COMPLETAR].
2.- Al celebrar dicho contrato, mi consentimiento fue viciado por [COMPLETAR: error/dolo/violencia/lesión], toda vez que [COMPLETAR].
3.- El demandado [COMPLETAR: ocultó/falsificó/indujo a error] respecto de [COMPLETAR].
4.- De haber conocido la situación real, NO habría celebrado el contrato.
5.- El contrato adolece de los elementos de validez del artículo 1795 del Código Civil en lo relativo a [COMPLETAR].

DERECHO

I.- Artículo 1795 del Código Civil del Estado de Guanajuato, requisitos de validez del contrato.
II.- Artículos 1812 y 1813 del Código Civil, error y dolo como vicios del consentimiento.
III.- Artículos del Código de Procedimientos Civiles del Estado de Guanajuato.

Por lo anteriormente expuesto y fundado a Usted, C. Juez, atentamente le solicito:

PRIMERO.- Tenerme por presentado con la presente demanda de NULIDAD DE CONTRATO.
SEGUNDO.- Admitir la demanda y ordenar el emplazamiento de [DEMANDADO].
TERCERO.- Dictar sentencia declarando la NULIDAD del contrato de [COMPLETAR].
CUARTO.- Ordenar la restitución de prestaciones y pago de daños y perjuicios.
QUINTO.- Condenar al demandado al pago de gastos y costas.

PROTESTO LO NECESARIO
LEÓN, GTO., AL DÍA DE SU PRESENTACIÓN.
[ACTOR]`
  },
  {
    title: 'Demanda Ordinaria Civil — Prescripción Adquisitiva',
    matter: 'CIVIL',
    content: `C. JUEZ DE LO CIVIL EN TURNO
PRESENTE.

C. [ACTOR], mexicano(a), mayor de edad, señalando como domicilio para oír y recibir notificaciones [DOMICILIO_ACTOR], Ciudad de León, Gto.

Ante usted, con el debido respeto, comparezco para exponer:

Que en la VÍA ORDINARIA CIVIL y con fundamento en los artículos 826, 827, 828 y relativos del Código Civil vigente en el Estado de Guanajuato, vengo a entablar formal demanda en contra de [DEMANDADO], quien para efectos de emplazamiento tiene su domicilio en [DOMICILIO_EMPLAZAMIENTO], y a quien reclamo lo siguiente:

PRESTACIONES

A). La declaración judicial de que el suscrito ha adquirido por PRESCRIPCIÓN ADQUISITIVA la propiedad del inmueble ubicado en [COMPLETAR DIRECCIÓN], superficie [COMPLETAR] m², linderos: Norte [COMPLETAR], Sur [COMPLETAR], Oriente [COMPLETAR], Poniente [COMPLETAR].
B). Que en ejecución de sentencia se gire oficio al Registro Público de la Propiedad para inscripción a favor del suscrito.
C). El pago de gastos y costas del juicio.

H E C H O S:

1.- Desde hace más de [COMPLETAR] años poseo de manera pública, pacífica, continua y a título de propietario el inmueble ubicado en [COMPLETAR DIRECCIÓN], León, Gto.
2.- La posesión inició el día [COMPLETAR] cuando [COMPLETAR ORIGEN DE LA POSESIÓN].
3.- He realizado actos materiales de propietario: [COMPLETAR: construcciones/mejoras/pago predial/servicios].
4.- El inmueble aparece inscrito a nombre de [DEMANDADO], escritura No. [COMPLETAR], notario [COMPLETAR], folio real [COMPLETAR].
5.- No existe acto de perturbación ni reconocimiento de dominio ajeno durante todo el tiempo de posesión.

DERECHO

I.- Artículos 826 y 827 del Código Civil del Estado de Guanajuato, prescripción adquisitiva y sus requisitos.
II.- Artículo 828 del Código Civil, plazo de prescripción adquisitiva para inmuebles.
III.- Artículos del Código de Procedimientos Civiles del Estado de Guanajuato.

Por lo anteriormente expuesto y fundado a Usted, C. Juez, atentamente le solicito:

PRIMERO.- Tenerme por presentado con la presente demanda de PRESCRIPCIÓN ADQUISITIVA.
SEGUNDO.- Admitir la demanda, ordenar emplazamiento y publicación de edictos.
TERCERO.- Dictar sentencia declarando adquirida la propiedad por prescripción adquisitiva.
CUARTO.- Girar oficio al Registro Público de la Propiedad para inscripción.
QUINTO.- Condenar al demandado al pago de gastos y costas.

PROTESTO LO NECESARIO
LEÓN, GTO., AL DÍA DE SU PRESENTACIÓN.
[ACTOR]`
  },
  {
    title: 'Demanda Ordinaria Civil — Daños y Perjuicios',
    matter: 'CIVIL',
    content: `C. JUEZ DE LO CIVIL EN TURNO
PRESENTE.

C. [ACTOR], mexicano(a), mayor de edad, señalando como domicilio para oír y recibir notificaciones [DOMICILIO_ACTOR], Ciudad de León, Gto.

Ante usted, con el debido respeto, comparezco para exponer:

Que en la VÍA ORDINARIA CIVIL y con fundamento en los artículos 1910, 1915 y relativos del Código Civil vigente en el Estado de Guanajuato, vengo a entablar formal demanda en contra de [DEMANDADO], quien para efectos de emplazamiento tiene su domicilio en [DOMICILIO_EMPLAZAMIENTO], y a quien reclamo lo siguiente:

PRESTACIONES

A). El pago de DAÑOS MATERIALES por [COMPLETAR], consistentes en [COMPLETAR], por $[COMPLETAR] ([COMPLETAR EN LETRA] PESOS M.N.).
B). El pago de PERJUICIOS por ganancia lícita dejada de obtener, por $[COMPLETAR] ([COMPLETAR EN LETRA] PESOS M.N.).
C). El pago de DAÑO MORAL cuya cuantificación se determinará en ejecución de sentencia conforme al artículo 1916 del Código Civil.
D). Intereses al tipo legal desde la fecha del hecho hasta total pago.
E). El pago de gastos y costas del juicio.

H E C H O S:

1.- El día [COMPLETAR] a las [COMPLETAR] horas, en [COMPLETAR LUGAR], ocurrió: [COMPLETAR DESCRIPCIÓN DETALLADA].
2.- El hecho fue causado por la conducta [COMPLETAR: negligente/imprudente/dolosa] de [DEMANDADO], quien [COMPLETAR].
3.- Como consecuencia sufrí los siguientes daños: [COMPLETAR LISTADO].
4.- Los daños han sido cuantificados en $[COMPLETAR] según [COMPLETAR: peritaje/presupuesto/factura] adjunto.
5.- El hecho causó afectación en mi [COMPLETAR: integridad/honor/reputación], constitutiva de daño moral.

DERECHO

I.- Artículo 1910 del Código Civil del Estado de Guanajuato, obligación de reparar el daño.
II.- Artículo 1915 del Código Civil, reparación del daño y perjuicios.
III.- Artículo 1916 del Código Civil, daño moral y su reparación pecuniaria.
IV.- Artículos del Código de Procedimientos Civiles del Estado de Guanajuato.

Por lo anteriormente expuesto y fundado a Usted, C. Juez, atentamente le solicito:

PRIMERO.- Tenerme por presentado con la presente demanda de DAÑOS Y PERJUICIOS.
SEGUNDO.- Admitir la demanda y ordenar el emplazamiento del demandado.
TERCERO.- Dictar sentencia condenando a [DEMANDADO] al pago de $[COMPLETAR] por daños y perjuicios más daño moral.
CUARTO.- Condenar al demandado al pago de intereses y costas.

PROTESTO LO NECESARIO
LEÓN, GTO., AL DÍA DE SU PRESENTACIÓN.
[ACTOR]`
  }
];

async function upsertTemplate(item: SeedItem) {
  const existing = await prisma.document.findFirst({
    where: { title: item.title, jurisdiccion: 'FORMATO' },
    select: { id: true }
  });
  if (existing) {
    await prisma.document.update({
      where: { id: existing.id },
      data: {
        matter: item.matter,
        submatter: 'PLANTILLA',
        active: true,
        content: item.content
      }
    });
    console.log(`Actualizada plantilla: ${item.title}`);
    return existing.id;
  } else {
    const created = await prisma.document.create({
      data: {
        title: item.title,
        matter: item.matter,
        jurisdiccion: 'FORMATO',
        submatter: 'PLANTILLA',
        active: true,
        content: item.content,
      },
      select: { id: true }
    });
    console.log(`Creada plantilla: ${item.title}`);
    return created.id;
  }
}

async function main() {
  console.log('Seed de plantillas (Document: FORMATO) iniciado...');
  for (const it of SEED_ITEMS) {
    await upsertTemplate(it);
  }
  console.log('Seed completado.');
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; jurisdiccion: string; submatter: string | null; active: boolean }>>(
    `SELECT "id","title","jurisdiccion","submatter","active" FROM "Document" WHERE "jurisdiccion"='FORMATO' ORDER BY "title"`
  );
  console.log('BEGIN_LIST');
  if (!rows || rows.length === 0) {
    console.log('Sin registros en FORMATO.');
  } else {
    rows.forEach(r => {
      console.log(`${r.id} | ${r.title} | ${r.jurisdiccion} | ${r.submatter || ''} | ${r.active ? 'true' : 'false'}`);
    });
  }
  console.log('END_LIST');
}

main()
  .catch((e) => {
    console.error('Seed error:', e?.message || e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

