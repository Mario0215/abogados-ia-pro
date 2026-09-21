import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const servicios = [
    { servicioId: 'DIVORCIO_MUTUO', nombre: 'Divorcio por mutuo acuerdo', precioBase: 8500, precioDesde: false, activo: true },
    { servicioId: 'DIVORCIO_CONTENCIOSO', nombre: 'Divorcio contencioso', precioBase: 8500, precioDesde: true, activo: true },
    { servicioId: 'PENSION_ALIMENTICIA', nombre: 'Pensión alimenticia', precioBase: 5000, precioDesde: true, activo: true },
    { servicioId: 'PRESCRIPCION_ADQUISITIVA', nombre: 'Prescripción adquisitiva', precioBase: 12000, precioDesde: false, activo: true },
    { servicioId: 'NULIDAD_CONTRATO', nombre: 'Nulidad de contrato', precioBase: 7000, precioDesde: true, activo: true },
    { servicioId: 'ARRENDAMIENTO', nombre: 'Arrendamiento', precioBase: 6000, precioDesde: true, activo: true },
    { servicioId: 'DANOS_PERJUICIOS', nombre: 'Daños y perjuicios', precioBase: 8000, precioDesde: true, activo: true },
    { servicioId: 'SUCESION', nombre: 'Sucesión', precioBase: 10000, precioDesde: true, activo: true },
  ];

  const modificadores = [
    { key: 'EXTRA_HIJO', valor: 3000 },
    { key: 'EXTRA_BIENES', valor: 5000 },
    { key: 'EXTRA_CONTENCIOSO', valor: 8000 },
  ];

  for (const s of servicios) {
    await (prisma as any).servicioConfig.upsert({
      where: { servicioId: s.servicioId },
      update: { nombre: s.nombre, precioBase: s.precioBase, precioDesde: s.precioDesde, activo: s.activo },
      create: s,
    });
  }

  for (const m of modificadores) {
    await (prisma as any).precioModificador.upsert({
      where: { key: m.key },
      update: { valor: m.valor },
      create: m,
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    await prisma.$disconnect();
    throw e;
  });

