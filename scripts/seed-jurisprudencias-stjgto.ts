import 'dotenv/config';
import { prisma } from '../lib/prisma';

const JURISPRUDENCIAS = [
  {
    numero: '0001/2000',
    title: 'AUTO QUE DESECHA LA CONTESTACIÓN DE DEMANDA NO ES APELABLE',
    content: `Contradicción de Tesis número 1/2000 entre las sustentadas por la Segunda y Cuarta Salas Civiles.
EL AUTO QUE DESECHA LA CONTESTACIÓN DE DEMANDA NO ES APELABLE.
El auto que desecha la contestación de demanda no es apelable dado que no decidió un incidente ni existe precepto alguno en el Libro Primero, Titulo Sexto, Capítulo II, que autorice la procedencia del recurso de apelación en su contra.
Resuelta en sesión del día 14 de junio del 2000. Magistrado Ponente Lic. Héctor Manuel Ramírez Sánchez.`
  },
  {
    numero: '0001/2001',
    title: 'PLAZO PREVISTO EN EL ARTÍCULO 511 DEL CÓDIGO DE PROCEDIMIENTOS CIVILES DEBE COMPUTARSE EN DÍAS HÁBILES',
    content: `Contradicción de Tesis número 1/2001 entre las sustentadas por la Tercera y Octava Salas Civiles.
EL PLAZO PREVISTO EN EL ARTÍCULO 511 DEL CÓDIGO DE PROCEDIMIENTOS CIVILES DEBE COMPUTARSE EN DÍAS HÁBILES.
Conforme a lo sostenido en la jurisprudencia de la Primera Sala de la honorable Suprema Corte de justicia de la Nación 72/2002, este Tribunal Pleno estima que una interpretación sistemática y armónica de los artículos 1064 y 1076 del Código de Comercio permite colegir que por regla general los plazos se contarán en días hábiles, siendo estos todos los del año, excepto los domingos o los días en los que no laboren los tribunales competentes, y que sólo excepcionalmente se contarán en los plazos, los días naturales, y ello ocurrirá cuando la ley así lo señale en forma expresa. Por lo tanto, si el artículo 511 del Código de Procedimientos Civiles en vigor nada dice respecto a la forma de computar el plazo que mediará entre la última publicación del edicto y la fecha del remate, es inconcuso que se debe estar a la regla general del artículo 1076 del Código de Comercio, en el sentido que en ningún término se contarán los días que no puedan tener lugar las actuaciones judiciales.
Aprobada en sesión del día 18 de junio del 2003. Magistrado Ponente Lic. María Raquel Barajas Monjarás.`
  },
  {
    numero: '0002/2002',
    title: 'EMPLAZAMIENTO EN JUICIO EJECUTIVO MERCANTIL. CÓMPUTO DEL TÉRMINO',
    content: `Contradicción de Tesis número 2/2002 entre las sustentadas por la Segunda y Cuarta Salas Civiles.
EMPLAZAMIENTO EN JUICIO EJECUTIVO MERCANTIL. COMPUTO DEL TÉRMINO.
El término de que goza el demandado en el juicio ejecutivo mercantil para dar contestación a la demanda debe computarse a partir de que surte efectos el emplazamiento, lo que ocurre al día siguiente al en que se practica dicho acto procesal.
Aprobada en sesión del día 25 de noviembre del 2002. Magistrado Ponente Lic. Lilia Villafuerte Zavala.`
  },
  {
    numero: '0001/2003',
    title: 'ES FACTIBLE LA ACTUALIZACIÓN DE LA PRÓRROGA TÁCITA DE COMPETENCIA POR RAZÓN DE TERRITORIO',
    content: `Contradicción de Tesis número 1/2003 entre las sustentadas por la Octava y Novena Salas Civiles.
ES FACTIBLE LA ACTUALIZACIÓN DE LA PRORROGA TÁCITA DE COMPETENCIA POR RAZÓN DE TERRITORIO.
Cuando se establece en beneficio del deudor, aunque sea contrario al lugar de pago o al pacto de sumisión expresa contenido en el documento fundatorio que da origen al juicio, porque devienen inoperantes esos pactos cuando no se hace uso de los mismos. Para dilucidar la competencia debe estarse a las reglas establecidas en la Ley de la materia, en este caso, la que resulta de lo dispuesto en los artículos 1105 y 1120 del Código de Comercio reformado.
Aprobada en sesión del día 12 de Noviembre del 2003. Magistrado Ponente Lic. Plinio Manuel E. Martínez Tafolla.`
  },
  {
    numero: '0002/2003',
    title: 'PAGARÉS. VENCIMIENTO A LA VISTA. LA FALTA DE PRESENTACIÓN PREVIA PARA SU PAGO NO ES OBSTÁCULO PARA EL EJERCICIO DE LA ACCIÓN CAMBIARIA DIRECTA',
    content: `Contradicción de Tesis número 2/2003 entre las sustentadas por la Novena y Décima Salas Civiles.
PAGARÉS. VENCIMIENTO A LA VISTA. LA FALTA DE PRESENTACIÓN PREVIA PARA SU PAGO NO ES OBSTÁCULO PARA EL EJERCICIO DE LA ACCIÓN CAMBIARIA DIRECTA.
El tenedor de un pagaré con vencimiento a la vista no está obligado a presentar el título al cobro antes de reclamar judicialmente su pago y no constituye un impedimento para el ejercicio de la acción cambiaria directa, por lo que para tener por satisfecho el requisito de incorporación propio de los títulos de crédito basta con que el actor adjunte a su demanda el pagaré y se ponga a la vista del obligado al efectuarse el requerimiento de pago en la diligencia de exequendo.
Aprobada en sesión del día 28 de Abril del 2004. Magistrado Ponente Lic. Luis Felipe Luna Obregón.`
  },
  {
    numero: '0001/2004',
    title: 'COMPETENCIA. JUECES DE PARTIDO Y MENORES',
    content: `Contradicción de Tesis número 1/2004 entre las sustentadas por la Primera y Novena Salas Civiles.
COMPETENCIA. JUECES DE PARTIDO Y MENORES.
Si en un juicio la petición esencial versa sobre una acción que no es estimable en dinero por hacerse valer una acción de carácter primordialmente jurídico, como lo sería la rescisoria, con independencia de que de ella deriven obligaciones patrimoniales que puedan cuantificarse en numerario, el conocimiento del asunto le corresponde a un Juez de Partido, en acatamiento a lo que establece la parte final del artículo 24 del Código de Procedimientos Civiles del Estado.
Aprobada en sesión del día 07 de Mayo del 2004. Magistrado Ponente Lic. Rebeca González Solís.`
  },
  {
    numero: '0001/2005',
    title: 'COSTAS RESPECTO A LOS JUICIOS DE AMPARO',
    content: `Contradicción de tesis 1/2005 entre las sustentadas por la Quinta y Primera Salas Civiles.
COSTAS RESPECTO A LOS JUICIOS DE AMPARO.
Esta cuestión ha sido resuelta por la tesis de Jurisprudencia 1ª./J39/2002 de la Primera Sala de la Suprema Corte de Justicia de la Nación: "COSTAS EN LA TRAMITACIÓN DE LOS JUICIOS DE AMPARO. NO ES PROCEDENTE SU PAGO AUN CUANDO LAS LEGISLACIONES LOCALES LO CONTEMPLEN."
Aprobada en sesión del día 29 de Junio del 2005. Magistrado Ponente Lic. Carlos Fuentes Díaz.`
  },
  {
    numero: '0002/2005',
    title: 'COSTAS. VALOR DEL NEGOCIO CUANDO ES VALUABLE EN DINERO',
    content: `Contradicción de Tesis número 2/2005 entre las sustentadas por la Segunda y Cuarta Salas Civiles.
COSTAS, VALOR DEL NEGOCIO, CUANDO ES VALUABLE EN DINERO.
Para atender a las costas judiciales del valor del negocio al que hacen referencia los artículos 16 y 17 de la Ley Arancelaria para el cobro de Honorarios de Abogados y Notarios del Estado de Guanajuato, debe tomarse únicamente en consideración si el objeto directo e inmediato de la acción o acciones que se ejerciten son valuables o no en dinero.
Aprobada en sesión del día 10 de Octubre del 2005. Magistrado Ponente Lic. Antonio Obregón Padilla.`
  },
  {
    numero: '0003/2005',
    title: 'DEMANDA. EL ACTOR PUEDE ACLARARLA, CORREGIRLA O COMPLETARLA ANTES DE VERIFICARSE EL EMPLAZAMIENTO',
    content: `Contradicción de Tesis número 3/2005 entre las sustentadas por la Décima, Sexta, Tercera y Octavas Salas Civiles.
DEMANDA. EL ACTOR PUEDE ACLARARLA, CORREGIRLA O COMPLETARLA ANTES DE VERIFICARSE EL EMPLAZAMIENTO.
La demanda es el acto concreto con el que se inicia el ejercicio de la acción. Cuando el actor advierta que éste no es claro, contiene imprecisiones o es menester complementarlo, siempre que no se haya verificado el emplazamiento, podrá aclarar, corregir o completar la demanda, no así introducir cuestiones que impliquen variación sustancial de dicho escrito.
Aprobada en sesión del día 25 de Octubre del 2006. Magistrado Ponente Lic. Maria Raquel Barajas Monjarás.`
  },
  {
    numero: '0001/2006',
    title: 'EXCUSA NO REQUIERE SER CALIFICADA POR EL AD QUEM CONFORME AL ARTÍCULO 1150 REFORMADO DEL CÓDIGO DE COMERCIO',
    content: `Contradicción de Tesis número 1/2006 entre la Tercera y Séptima Sala Civil.
EXCUSA NO REQUIERE SER CALIFICADA POR EL AD QUEM CONFORME AL ARTÍCULO 1150 REFORMADO DEL CÓDIGO DE COMERCIO.
La excusa es el medio a disposición del Juez para separarse voluntariamente del conocimiento de una causa. Conforme al artículo 1150 del Código de Comercio reformado, se cambió el sistema del control de las excusas y dejó de ser jurisdiccional para convertirse en administrativo. En caso de que la excusa sea sin causa legítima, podrá dar lugar a una corrección disciplinaria, pero no será materia de calificación jurisdiccional.`
  },
  {
    numero: '0002/2006',
    title: 'APELABILIDAD DEL AUTO QUE DESECHA LA ACTUALIZACIÓN DE AVALÚO EN JUICIO EJECUTIVO MERCANTIL',
    content: `Contradicción de Tesis número 2/2006 entre las sustentadas por la Segunda, Quinta y Tercera Salas Civiles.
APELABILIDAD DEL AUTO QUE DESECHA LA ACTUALIZACIÓN DE AVALÚO EN JUICIO EJECUTIVO MERCANTIL.
Conforme al Artículo 1341 del Código de Comercio, para que la apelación proceda en contra de un auto, se requiere que cause un gravamen que no pueda repararse en la definitiva. Esta situación existe respecto del auto que deniega la admisión de la actualización del avalúo realizado sobre el bien materia del remate, pues en la definitiva ya no se analiza el valor que se atribuye al mismo.
Aprobada en sesión del día 25 de Octubre del 2006. Magistrado Ponente Lic. Lilia Villafuerte Zavala.`
  },
  {
    numero: '0003/2006',
    title: 'NATURALEZA DEL ARRENDAMIENTO COMO ACTO DE COMERCIO',
    content: `Contradicción de Tesis número 3/2006 entre las sustentadas por la Octava y Tercera Salas Civiles.
NATURALEZA DEL ARRENDAMIENTO COMO ACTO DE COMERCIO.
Debe prevalecer el criterio de la Tercera Sala Civil, por ajustarse a la Jurisprudencia 1/J.63/98 de la Primera Sala de la Suprema Corte: "VIA MERCANTIL, IMPROCEDENCIA DE LA, TRATANDOSE DE ARRENDAMIENTO DE INMUEBLES". Aún cuando la persona moral actora sea un comerciante, tratándose de arrendamiento de inmuebles, las controversias no pueden regularse por el Código de Comercio por no ser un acto de comercio.
Aprobada en sesión del día 26 de septiembre del 2007. Magistrado Ponente Lic. Esteban Ramírez Sánchez.`
  },
  {
    numero: '0002/2007',
    title: 'DEPENDENCIAS DE LA ADMINISTRACIÓN PÚBLICA CENTRALIZADA DEL PODER EJECUTIVO DEL ESTADO DE GUANAJUATO. LEGITIMACIÓN AD PROCESUM',
    content: `Contradicción de Tesis número 2/2007 entre las sustentadas por la Primera y Tercera Salas Civiles.
DEPENDENCIAS DE LA ADMINISTRACIÓN PUBLICA CENTRALIZADA DEL PODER EJECUTIVO DEL ESTADO DE GUANAJUATO. LEGITIMACION AD PROCESUM.
Los titulares de las dependencias centralizadas del Poder Ejecutivo del Estado de Guanajuato se encuentran investidos de legitimación procesal para intervenir en los juicios del fuero común en los que se involucren los intereses de la Dependencia que encabezan, por sí mismos o por medio de sus unidades administrativas internas que formen parte de su estructura orgánica.
Aprobada en sesión del día 12 de Marzo de 2008. Magistrada ponente Claudia Barrera Rangel.`
  },
  {
    numero: '0001/2008',
    title: 'APLICACIÓN DEL ARTÍCULO 1198 DEL CÓDIGO DE COMERCIO A LOS JUICIOS EJECUTIVOS MERCANTILES',
    content: `Contradicción de Tesis número 1/2008 entre las sustentadas por la Quinta y Novena Salas Civiles.
APLICACIÓN DEL ARTÍCULO 1198 DEL CÓDIGO DE COMERCIO A LOS JUICIOS EJECUTIVOS MERCANTILES.
Las reglas generales en materia de pruebas del Código de Comercio son aplicables a los juicios mercantiles que regula dicha legislación, incluyendo al juicio ejecutivo mercantil. Tratándose del ofrecimiento de los medios de prueba, en todos los juicios mercantiles se deben colmar de manera ineludible los requisitos del artículo 1198, porque de no ser así se desecharán.
Aprobada en sesión del día 05 de marzo de 2008. Magistrada ponente Belia Martínez López.`
  },
  {
    numero: '0001/2009',
    title: 'ENLISTAR CONSTANCIAS. EFECTOS DE SU SEÑALAMIENTO GENÉRICO',
    content: `Contradicción de tesis número 1/2009 entre las sustentadas por la Primera y Décima Salas Civiles.
ENLISTAR CONSTANCIAS. EFECTOS DE SU SEÑALAMIENTO GENÉRICO.
En los casos de la apelación en el efecto devolutivo a que se refiere el artículo 239 del Código de Procedimientos Civiles del Estado de Guanajuato, cuando el apelante señale de manera genérica las constancias para la integración del testimonio, el tribunal del primer grado deberá requerir al inconforme para que dentro del término de tres días siguientes enliste las constancias necesarias, prevenido que de no hacerlo se tendrá por no interpuesto el recurso.
Aprobada en sesión del día 05 de enero de 2011. Magistrada ponente Lic. Ma. Elena Hernández Muñoz.`
  },
  {
    numero: '0002/2009',
    title: 'REMATE. DESIGNACIÓN DE PERITO CUANDO EL DEMANDADO NO LO NOMBRA',
    content: `Contradicción de tesis número 2/2009 entre las sustentadas por la Séptima y Segunda Salas Civiles.
REMATE.
Cuando conforme al artículo 1410 del Código del Comercio las partes deban nombrar peritos para el avalúo del remate, y el demandado no realice la designación del perito que le corresponde o este no lo entregue oportunamente, deberá aplicarse el contenido del artículo 1253 fracción VI del Código de Comercio, dando como consecuencia que se le tenga como conforme con el dictamen pericial que rinda el perito de la oferente.
Aprobada en sesión del día 23 de septiembre de 2009. Magistrado ponente Lic. Mario Gutiérrez Covarrubias.`
  },
  {
    numero: '0001/2010',
    title: 'TESTIMONIAL EN EL JUICIO CIVIL. ES INADMISIBLE LA OFRECIDA A CARGO DE UN CODEMANDADO',
    content: `Contradicción de tesis número 1/2010 sustentada entre los Juzgados Cuarto y Décimo Civil de Partido Judicial de León, Gto.
TESTIMONIAL EN EL JUICIO CIVIL. ES INADMISIBLE LA OFRECIDA CARGO DE UN CODEMANDADO.
De la interpretación de los artículos 2, 4 y 168 del Código de Procedimientos Civiles, la prueba testimonial sólo puede ser a cargo de terceros ajenos a las partes. Al ser un codemandado parte por tener interés directo en el negocio judicial, no puede fungir como testigo, con independencia de que tenga como finalidad acreditar hechos diversos a los que se controvierten en el juicio.
Aprobada en la sesión del día 02 de marzo de 2011. Magistrado ponente Lic. Esteban Ramírez Sánchez.`
  },
  {
    numero: '0002/2010',
    title: 'COMPETENCIA, PRÓRROGA EN RAZÓN AL TERRITORIO. EL JUEZ CARECE DE FACULTADES PARA DESECHAR LA DEMANDA',
    content: `Contradicción de Tesis número 2/2010 entre las sustentadas por la Primera, Segunda, Séptima, Octava y Décima y la Tercera y Cuarta Salas Civiles.
COMPETENCIA, PRÓRROGA EN RAZÓN AL TERRITORIO. EL JUEZ CARECE DE FACULTADES PARA DESECHAR LA DEMANDA.
Del artículo 19 del Código de Procedimientos Civiles del Estado de Guanajuato, se desprende la prohibición para que ningún tribunal se niegue a conocer de un asunto, sino por estimarse incompetente. El juzgador está obligado a darle trámite a las demandas que las partes le presenten, aún cuando advierta que no se actualiza alguno de los supuestos del artículo 30 del Código de Procedimientos Civiles, pues debe considerar la sumisión tácita de la parte actora.
Aprobada en sesión del día 07 de septiembre de 2011. Magistrada Ponente Martha Susana Barragán Rangel.`
  },
  {
    numero: '0003/2010',
    title: 'EJECUCIÓN DE SENTENCIA EN EL JUICIO EJECUTIVO MERCANTIL. RESULTA INNECESARIO DEJAR CITATORIO',
    content: `Contradicción de tesis número 3/2010 entre las sustentadas por la Segunda y Octava Salas Civiles.
EJECUCIÓN DE SENTENCIA EN EL JUICIO EJECUTIVO MERCANTIL. RESULTA INNECESARIO DEJAR CITATORIO.
La interpretación sistemática de los artículos 1054 y 1347 del Código de Comercio y del 424 del Código Federal de Procedimientos Civiles permite concluir que en etapa de ejecución de sentencia, resulta innecesario dejar citatorio al deudor cuando no se encuentre en su domicilio, toda vez que el demandado ya fue oído y vencido en un juicio en el que se cumplieron las formalidades esenciales del procedimiento.
Aprobada en la sesión del día 30 de marzo de 2011. Magistrado ponente Lic. Carolina Orozco Arredondo.`
  },
  {
    numero: '0001/2011',
    title: 'RECTIFICACIÓN O MODIFICACIÓN DE ACTAS DEL ESTADO CIVIL. DEBE AGOTARSE EL TRÁMITE ADMINISTRATIVO ANTES DE LA VÍA JUDICIAL',
    content: `Contradicción de tesis número 1/2011 sustentadas entre la Tercera y Cuarta Salas Civiles.
RECTIFICACIÓN O MODIFICACIÓN DE ACTAS DEL ESTADO CIVIL. EN LOS SUPUESTOS DE EXCEPCION QUE ESTABLECE EL ARTÍCULO 137 DEL CÓDIGO CIVIL DEL ESTADO, ANTES DE INSTAR EN LA VÍA JUDICIAL SE DEBE AGOTAR EL TRÁMITE ADMINISTRATIVO.
En los supuestos de excepción del artículo 137 del Código Civil, antes de instar en la vía judicial, se debe agotar el trámite administrativo ante la Dirección General del Registro Civil, y únicamente en caso de que se niegue la solicitud, el interesado podrá acudir ante el Juez competente conforme al artículo 140 último párrafo del Código Civil para el Estado de Guanajuato.
Aprobada en sesión del día 18 de mayo de 2011. Magistrado ponente Lic. José Luis Aranda Galván.`
  },
  {
    numero: '0002/2011',
    title: 'APELACIÓN CONTRA EL AUTO QUE DESECHA PRUEBAS PARA PERFECCIONAR DOCUMENTAL OBJETADA, ES ADMISIBLE',
    content: `Contradicción de Tesis número 2/2011 entre las sustentadas por la Quinta y Primera Salas Civiles.
APELACIÓN CONTRA EL AUTO QUE DESECHA PRUEBAS PARA PERFECCIONAR DOCUMENTAL OBJETADA, ES ADMISIBLE EL RECURSO DE.
La facultad para probar con medio de prueba directa contra los argumentos de objeción de documental se encuentra prevista en el artículo 210 del Código de Procedimientos Civiles para el Estado de Guanajuato. A la luz del artículo 90, el recurso de apelación es admisible contra el desechamiento de prueba directa tendente al perfeccionamiento de documental objetada.
Aprobada en sesión del día 31 de octubre de 2012. Magistrada Ponente Martha Alejandra Vera Díaz.`
  },
  {
    numero: '0004/2011',
    title: 'COMPETENCIA. JUECES DE PARTIDO Y MENORES. ACCIÓN RESCISORIA',
    content: `Contradicción de Tesis número 4/2011 entre las sustentadas por la Primera y Séptima Salas Civiles.
COMPETENCIA. JUECES DE PARTIDO Y MENORES.
Si en un juicio la petición esencial versa sobre una acción que no es estimable en dinero por hacerse valer una acción de carácter primordialmente jurídico, como lo sería la rescisoria, con independencia de que de ella deriven obligaciones patrimoniales que puedan cuantificarse en numerario, el conocimiento del asunto le corresponde a un Juez de Partido conforme al artículo 24 del Código de Procedimientos Civiles del Estado.
Aprobada en sesión del día 1° de febrero de 2012. Magistrada Ponente Ma. Rocío Carrillo Díaz.`
  },
  {
    numero: '0003/2012',
    title: 'VÍA MERCANTIL. SU PROCEDENCIA CUANDO INTERVIENE UNA SOCIEDAD MERCANTIL',
    content: `Contradicción de Tesis número 3/2012 entre las sustentadas por la Sexta, Segunda y Quinta Salas Civiles.
VIA MERCANTIL SU PROCEDENCIA. CUANDO INTERVIENE UNA SOCIEDAD MERCANTIL.
Para determinar la procedencia de la vía en la cual deba encausarse un conflicto en el que una de las partes sea una Sociedad Mercantil, debe atenderse a: la naturaleza del acto conforme a los artículos 3, 4, 75, 1049 y 1050 del Código de Comercio, y si la Sociedad Mercantil efectuó la operación génesis del litigio para la realización de su objeto social.
Aprobada en sesión del día 06 de marzo de 2013. Magistrada Ponente Belia Martínez López.`
  },
  {
    numero: '0003/2014',
    title: 'INCOMPETENCIA CIVIL RESPECTO DEL CONOCIMIENTO DE LA ACCIÓN DE CUMPLIMIENTO DE CONVENIO SOBRE FINANCIAMIENTO OTORGADO POR LA EMPRESA A SUS TRABAJADORES',
    content: `Contradicción de Tesis número 3/2014 entre las sustentadas por la Tercera y Cuarta Salas Civiles.
INCOMPETENCIA CIVIL, SE SURTE RESPECTO DEL CONOCIMIENTO DE LA ACCION DE CUMPLIMIENTO DE CONVENIO SOBRE EL FINANCIAMIENTO OTORGADO POR LA EMPRESA A SUS TRABAJADORES PARA SU CAPACITACION LABORAL.
El juzgador tiene facultad para declararse incompetente de oficio por razón de materia. La reclamación del pago de financiamiento otorgado por un patrón a su trabajador para su capacitación, al amparo de un convenio que tuvo su origen en la relación laboral, no puede ser atendida por un Juez Civil del fuero común.
Aprobada en sesión del día 03 de febrero de 2016. Magistrada Ponente Ma. Elena Hernández Muñoz.`
  },
  {
    numero: '0004/2014',
    title: 'COSTAS PROCESALES. PARA SU CUANTIFICACIÓN RESULTA INAPLICABLE EL ARTÍCULO 13 DE LA LEY ARANCELARIA VIGENTE EN EL ESTADO DE GUANAJUATO',
    content: `Contradicción de Tesis número 4/2014 entre las sustentadas por la Tercera y Séptima Salas Civiles.
COSTAS PROCESALES. PARA SU CUANTIFICACIÓN RESULTA INAPLICABLE EL CONTENIDO DEL ARTÍCULO 13 DE LA LEY ARANCELARIA VIGENTE EN EL ESTADO DE GUANAJUATO.
Para establecer la dificultad que representó el negocio a fin de cuantificar las costas, deberá atenderse a las particularidades suscitadas dentro del procedimiento, prescindiendo de los parámetros previstos en el artículo 13 de la vigente ley arancelaria para el Estado, conforme a la diversa naturaleza de las costas procesales y los honorarios profesionales.
Aprobada en sesión del día 26 de noviembre de 2014. Magistrada Ponente Ma. Claudia Barrera Rangel.`
  },
  {
    numero: '0001/2015',
    title: 'REMATE DE BIENES INMUEBLES. LA SOLICITUD DE ADJUDICACIÓN POR PARTE DEL EJECUTANTE DEBE HACERSE EN LA DILIGENCIA DE REMATE',
    content: `Contradicción de Tesis número 1/2015 entre las sustentadas por la Octava y Décima Salas Civiles.
REMATE DE BIENES INMUEBLES. LA SOLICITUD DE LA ADJUDICACIÓN POR PARTE DEL EJECUTANTE, DEBE HACERSE EN LA DILIGENCIA DE REMATE, Y NO OTRO MOMENTO PROCESAL.
El artículo 519 del Código de Procedimientos Civiles para el Estado de Guanajuato determina que en cualquier almoneda en la que no haya postura legal, el ejecutante tendrá derecho a pedir la adjudicación de los bienes embargados; sin embargo, deberá hacerlo precisamente en almoneda judicial.
Aprobada en sesión del día 20 de mayo de 2015. Magistrado Ponente Francisco Javier Zamora Rocha.`
  },
  {
    numero: '0002/2015',
    title: 'COMPETENCIA. CORRESPONDE A UN JUEZ DE PARTIDO TRATÁNDOSE DE ASUNTOS DONDE SE RECLAME EL CUMPLIMIENTO DE UN CONTRATO',
    content: `Contradicción de Tesis número 2/2015 entre las sustentadas por la Tercera y Novena Salas Civiles.
COMPETENCIA. CORRESPONDE A UN JUEZ DE PARTIDO TRATÁNDOSE DE ASUNTOS EN DONDE SE RECLAME EL CUMPLIMIENTO DE UN CONTRATO.
Los asuntos no valuables en dinero del artículo 24 del Código de Procedimientos Civiles para el Estado de Guanajuato son aquellos en los que se hace valer una acción que intrínsecamente no tiene valor económico, sino primordialmente jurídico, como lo es la acción de cumplimiento de un contrato. El conocimiento de esta clase de asuntos le corresponde a un Juez de Partido.
Aprobada en sesión del día 02 de septiembre de 2015. Magistrada Ponente Martha Susana Barragán Rangel.`
  },
  {
    numero: '0003/2015',
    title: 'ARRENDAMIENTO. LA OBLIGACIÓN DEL ARRENDATARIO DE PAGAR LAS RENTAS CESA A PARTIR DE QUE SE ENTREGA LA FINCA AL ARRENDADOR',
    content: `Contradicción de Tesis número 3/2015 entre las sustentadas por la Novena y Décima Salas Civiles.
ARRENDAMIENTO. LA OBLIGACIÓN DEL ARRENDATARIO DE PAGAR LAS RENTAS CESA A PARTIR DE QUE SE ENTREGA AL ARRENDADOR LA FINCA ARRENDADA PARA QUE LA CONSERVE A DISPOSICIÓN DEL JUEZ MIENTRAS CONCLUYE EL JUICIO CORRESPONDIENTE.
Conforme al artículo 1927 del Código Civil para el Estado de Guanajuato, el arrendatario está obligado a pagar la renta hasta el día en que entregue la cosa arrendada. Cuando la finca es desocupada y entregada al arrendador para que la conserve a disposición del Juez, cesa la obligación del arrendatario de pagar las rentas.
Aprobada en sesión del día 13 de julio de 2016. Magistrado Ponente Fernando Reyes Solórzano.`
  },
  {
    numero: '0001/2016',
    title: 'DILIGENCIAS DE INFORMACIÓN TESTIMONIAL AD PERPETUAM PARA ACREDITAR LA POSESIÓN DE UN INMUEBLE SON INSCRIBIBLES EN EL REGISTRO PÚBLICO',
    content: `Contradicción de Tesis 1/2016-CT entre las sustentadas por la Séptima y Octava Salas Civiles.
DILIGENCIAS DE INFORMACIÓN TESTIMONIAL AD PERPETUAM PARA ACREDITAR LA POSESIÓN DE UN INMUEBLE, SON INSCRIBIBLES EN EL REGISTRO PÚBLICO DE LA PROPIEDAD CUANDO SE TRAMITAN CONFORME A LA FRACCIÓN II DEL ARTÍCULO 731 DEL CÓDIGO DE PROCEDIMIENTOS CIVILES.
La pretensión de acreditar la posesión de un inmueble no inscrito en el Registro Público debe encauzarse por el procedimiento del artículo 731 fracción II del Código de Procedimientos Civiles, dando publicidad mediante avisos en el Periódico Oficial, pidiendo certificado de no inscripción, citando a colindantes y al Ministerio Público.
Aprobada en sesión del día 21 de septiembre de 2016. Magistrada Ponente Ma. Elena Hernández Muñoz.`
  },
  {
    numero: '0003/2016',
    title: 'EXCUSA. CUANDO EL IMPEDIMENTO TIENE SUSTENTO EN LA FRACCIÓN XVII DEL ARTÍCULO 41 DEL CÓDIGO DE PROCEDIMIENTOS CIVILES NO EXIGE PRUEBA',
    content: `Contradicción de Tesis 3/2016-CT entre las sustentadas por la Octava y Novena Salas Civiles.
EXCUSA. CUANDO EL IMPEDIMENTO TIENE SUSTENTO EN LA FRACCIÓN XVII DEL ARTÍCULO 41 DEL CÓDIGO DE PROCEDIMIENTOS CIVILES DEL ESTADO DE GUANAJUATO; NO EXIGE PRUEBA PARA SU ACREDITACIÓN.
Cuando magistrados, jueces y secretarios sustenten su excusa por tener animadversión manifiesta con algunas de las partes que los coloca en situación que puede afectar su imparcialidad, tal impedimento no requiere de prueba para su acreditación, pues una vez manifiesta la causa, se ubica en el supuesto normativo.
Aprobada en sesión del día 26 de octubre de 2016. Magistrado Ponente Fernando Reyes Solórzano.`
  },
  {
    numero: '0004/2016',
    title: 'REMATE. LAS REGLAS DEL ARTÍCULO 532 DEL CÓDIGO DE PROCEDIMIENTOS CIVILES NO CONSTITUYEN UN ACTO SOLEMNE',
    content: `Contradicción de Tesis 4/2016-CT entre las sustentadas por la Octava y Décima Salas Civiles.
REMATE, LAS REGLAS PREVISTAS EN EL ARTÍCULO 532 DEL CÓDIGO DE PROCEDIMIENTOS CIVILES PARA EL ESTADO DE GUANAJUATO, NO CONSTITUYEN UN ACTO SOLEMNE.
La interpretación teleológica del artículo 532 del Código de Procedimientos Civiles permite colegir que los parámetros previstos solo constituyen las pautas que han de seguirse en la celebración de la subasta pública, sin imponer al Juzgador el pronunciamiento de frases sacramentales o ritos solemnes.
Aprobada en sesión del día 30 de noviembre de 2016. Magistrada Ponente Ma. Elena Hernández Muñoz.`
  },
  {
    numero: '0005/2016',
    title: 'DISPENSA DE EDAD PARA CONTRAER MATRIMONIO DE ADOLESCENTE MAYOR DE DIECISÉIS AÑOS',
    content: `Contradicción de Tesis 5/2016-CT entre las sustentadas por la Cuarta y Décima Salas Civiles.
DISPENSA DE EDAD PARA CONTRAER MATRIMONIO DE ADOLESCENTE MAYOR DE DIECISÉIS AÑOS. NO ES DABLE DESECHAR DE PLANO LA SOLICITUD DE, CUANDO SE EXPRESAN LAS CAUSAS QUE PRETENDEN JUSTIFICAR TAL DISPENSA.
Si la solicitud de dispensa para que un adolescente mayor de dieciséis años contraiga matrimonio conforme al artículo 145 del Código Civil expresa las causas justificantes, no es dable desechar la petición analizando aspectos del fondo, pues en aras del derecho fundamental de acceso a la justicia deben analizarse en cada caso concreto.
Aprobada en sesión del día 07 de diciembre de 2016. Magistrada Ponente Martha Susana Barragán Rangel.`
  },
  {
    numero: '0006/2016',
    title: 'PRUEBA CONFESIONAL POR POSICIONES. REQUISITO DE ADMISIBILIDAD EN EL JUICIO SUMARIO DE ARRENDAMIENTO INMOBILIARIO',
    content: `Contradicción de Tesis 6/2016-CT entre las sustentadas por la Tercera y la Octava Salas Civiles.
PRUEBA CONFESIONAL POR POSICIONES. REQUISITO DE ADMISIBILIDAD EN EL JUICIO SUMARIO DE ARRENDAMIENTO INMOBILIARIO.
En el Juicio Sumario de Arrendamiento Inmobiliario, las pruebas deben ofrecerse en los escritos que fijan la Litis. Realizando una interpretación sistemática de los artículos 105, 746, 765, 767, 768 y 769 del Código de Procedimientos Civiles, no puede citarse a persona alguna para absolver posiciones si no se ha presentado el pliego que las contenga.
Aprobada en sesión del día 07 de diciembre de 2016. Magistrado Ponente Eloy Zavala Arredondo.`
  },
  {
    numero: '0002/2017',
    title: 'COSTAS. CONDENACIÓN FORZOSA. CUANDO LA PARTE PERDIDOSA HAYA DEMANDADO EN CUMPLIMIENTO DE UN IMPERATIVO LEGAL NO PROCEDE EXONERARLA',
    content: `Contradicción de Tesis 2/2017-CT entre las sustentadas por la Cuarta y la Sexta Salas Civiles.
COSTAS. CONDENACION FORZOSA. CUANDO LA PARTE PERDIDOSA HAYA DEMANDADO EN CUMPLIMIENTO DE UN IMPERATIVO LEGAL NO PROCEDE EXONERARLA DE DICHA PRESTACIÓN.
Acorde al artículo 11 del Código de Procedimientos Civiles para el Estado de Guanajuato, la parte que pierde debe reembolsar a su contraria las costas del proceso. Cuando la parte perdidosa haya demandado en cumplimiento de un mandato legal, se considera que sí provocó el juicio, por ende no procede exonerarla del pago de costas procesales.
Aprobada en sesión del día 05 de julio de 2017. Magistrada Ponente Martha Isabel Villar Torres.`
  },
  {
    numero: '0004/2017',
    title: 'DILIGENCIAS DE JURISDICCIÓN VOLUNTARIA RELATIVAS A INSCRIPCIÓN PRIMARIA DE BIENES INMUEBLES. EL REGISTRO PÚBLICO DE LA PROPIEDAD CARECE DE LEGITIMACIÓN',
    content: `Contradicción de Tesis 4/2017-CT entre las sustentadas por la Octava, Primera y Séptima Salas Civiles.
DILIGENCIAS DE JURISDICCIÓN VOLUNTARIA RELATIVAS A INSCRIPCIÓN PRIMARIA DE BIENES INMUEBLES. EL REGISTRO PÚBLICO DE LA PROPIEDAD CARECE DE LEGITIMACIÓN EN EL PROCEDIMIENTO ESPECIAL RESPECTIVO.
El artículo 706 del Código de Procedimientos Civiles establece la posibilidad de llamar a cualquier persona que el juzgador estime necesaria su intervención. Sin embargo, la fe pública registral del Registro Público de la Propiedad no le confiere titularidad de derechos susceptibles de ser afectados, ni existe disposición que le faculte expresamente para tal intervención.
Aprobada en sesión del día 17 de enero de 2018. Magistrado Ponente Roberto Ávila García.`
  },
  {
    numero: '0006/2017',
    title: 'COMPETENCIA. LA ACCIÓN DE RESPONSABILIDAD CIVIL POR AFECTACIÓN A LA HACIENDA PÚBLICA CUANDO SE TRATE DE RECURSOS DEL RAMO 33 NO COMPETE A LOS JUZGADOS CIVILES',
    content: `Contradicción de Tesis 6/2017-CT entre las sustentadas por la Quinta y la Séptima Salas Civiles.
COMPETENCIA. LA ACCIÓN DE RESPONSABILIDAD CIVIL POR AFECTACIÓN A LA HACIENDA PÚBLICA CUANDO SE TRATE DE RECURSOS PROVENIENTES EL RAMO 33, NO COMPETE DILUCIDARLA A LOS JUZGADOS CIVILES DEL FUERO COMÚN.
Los recursos del Ramo 33 son de carácter federal, por lo que los Juzgados Civiles del fuero común carecen de competencia para conocer de la acción de responsabilidad civil que se ejerza para reclamar daños con motivo de desfalco a la Hacienda Pública derivada de dichos recursos.
Aprobada en sesión del día 14 de febrero de 2018. Magistrado Ponente Fernando Reyes Solórzano.`
  },
  {
    numero: '0007/2017',
    title: 'APELACIÓN. ES IMPROCEDENTE EN CONTRA DE LA DETERMINACIÓN QUE ADMITE UN MEDIO DE PRUEBA EN FORMA DIVERSA A LA QUE FUE OFRECIDA',
    content: `Contradicción de Tesis 7/2017-CT entre las sustentadas por la Tercera y la Quinta Salas Civiles.
APELACION, ES IMPROCEDENTE EN CONTRA DE LA DETERMINACION QUE ADMITE UN MEDIO DE PRUEBA EN FORMA DIVERSA A LA QUE FUE OFRECIDA.
De conformidad con los artículos 90 y 245 del Código de Procedimientos Civiles para el Estado de Guanajuato, los autos en que se admita alguna prueba no son recurribles. Si una determinación judicial admite un medio de prueba, aun cuando su admisión haya sido en forma diversa al ofrecimiento, tal hipótesis no puede ser impugnada a través del recurso de apelación.
Aprobada en sesión del día 28 de febrero de 2018. Magistrada Ponente Ma. Elena Hernández Muñoz.`
  },
  {
    numero: '0002/2018',
    title: 'LIQUIDACIÓN DE SENTENCIA. NO PUEDE RECONOCER UNA PRESTACIÓN DIVERSA A LAS QUE FUERON MATERIA DE LA CONDENA EN LA SENTENCIA DEFINITIVA',
    content: `Contradicción de Tesis 2/2018-CT entre las sustentadas por la Segunda y la Novena Salas Civiles.
LIQUIDACIÓN DE SENTENCIA. NO PUEDE RECONOCER UNA PRESTACIÓN DIVERSA A LAS QUE FUERON MATERIA DE LA CONDENA EN LA SENTENCIA DEFINITIVA.
La cosa juzgada materializa la seguridad y certeza jurídica de un proceso que culminó con sentencia firme. Los incidentes de liquidación solo tienen como fin determinar con exactitud la cuantía de las prestaciones de la condena. Por tanto, los incidentes de liquidación no pueden rebasar lo decidido reconociendo una prestación diversa, pues ello equivaldría a inobservar la autoridad de la cosa juzgada.
Aprobada en sesión del día 05 de septiembre de 2018. Magistrado Ponente Diego León Zavala.`
  },
  {
    numero: '0004/2018',
    title: 'VÍA ORAL ORDINARIA. LA DISMINUCIÓN DE UNA PENSIÓN ALIMENTICIA PREVIAMENTE FIJADA EN SENTENCIA SE DEBE TRAMITAR EN LA VÍA ORAL',
    content: `Contradicción de Tesis 4/2018-CT entre las sustentadas por dos Jueces de Partido Civil Especializados en Materia Familiar de Irapuato, Guanajuato.
VÍA ORAL ORDINARIA. LA DISMINUCIÓN DE UNA PENSIÓN ALIMENTICIA PREVIAMENTE FIJADA EN SENTENCIA, SE DEBE TRAMITAR EN LA.
El artículo 851 del Código de Procedimientos Civiles para el Estado de Guanajuato establece como una vía independiente y autónoma la oral ordinaria para dirimir los conflictos relativos al aumento, disminución, cancelación o suspensión de las pensiones alimenticias que surjan con posterioridad al dictado de una sentencia. No es dable tramitarlo a través de un incidente de ejecución de sentencia.
Aprobada en sesión del día 10 de abril de 2019. Magistrada Ponente Ma. Rosa Medina Rodríguez.`
  },
  {
    numero: '0002/2022',
    title: 'COSTAS EN MATERIA CIVIL. CORRESPONDE A LA PARTE DEMANDADA EL CARÁCTER DE PERDIDOSA CUANDO SE HUBIEREN ACOGIDO PARCIALMENTE LAS PRETENSIONES DE LA ACTORA',
    content: `Contradicción de Tesis 2/2022-CT entre las sustentadas por la Cuarta y la Quinta Salas Civiles.
COSTAS EN MATERIA CIVIL. CORRESPONDE A LA PARTE DEMANDADA EL CARÁCTER DE PERDIDOSA CUANDO, SIN HABER INTERPUESTO RECONVENCIÓN, SE HUBIEREN ACOGIDO PARCIALMENTE LAS PRETENSIONES QUE LA ACTORA DEDUJO EN SU CONTRA.
La legislación adjetiva civil local adoptó la teoría del vencimiento en el tema de condena en costas. Cuando sean acogidas parcialmente las pretensiones deducidas en un proceso civil en el que se carezca de reconvención, la calidad de perdidosa corresponde a la parte demandada conforme al artículo 11 del Código de Procedimientos Civiles para el Estado de Guanajuato.
Aprobada en sesión del día 10 de agosto de 2022. Magistrado Ponente Gustavo Rodríguez Junquera.`
  },
  {
    numero: '0005/2022',
    title: 'EXCUSA EN MATERIA CIVIL. FUNDADA EN LA FRACCIÓN XVII DEL ARTÍCULO 41 SOLO SERÁ SUSCEPTIBLE DE CALIFICARSE CUANDO EXISTA INCONFORMIDAD DE LAS PARTES',
    content: `Contradicción de Tesis número 5/2022-CT entre los criterios sostenidos por la Segunda y Séptima Salas Civiles y los sustentados por la Primera, Cuarta y Sexta Salas Civiles.
EXCUSA EN MATERIA CIVIL. LA FUNDADA EN LA FRACCIÓN XVII DEL ARTÍCULO 41 DEL CÓDIGO DE PROCEDIMIENTOS CIVILES PARA EL ESTADO SOLO SERÁ SUSCEPTIBLE DE CALIFICARSE POR LA ALZADA CUANDO EXISTA INCONFORMIDAD DE ALGUNA O AMBAS PARTES.
Las excusas de las personas juzgadoras basadas en la fracción XVII del artículo 41 del Código de Procedimientos Civiles del Estado solo requieren ser calificadas por la alzada cuando exista oposición de parte. Si las partes no plantean oposición, la excusa se torna irrecurrible y surte sus efectos de plano.
Aprobada en sesión del día 16 de noviembre de 2022. Magistrado Ponente Francisco Javier Zamora Rocha.`
  },
  {
    numero: '0001/2023',
    title: 'EXCUSA O RECUSACIÓN DE UN JUEZ DEL SISTEMA DE ORALIDAD FAMILIAR. LA APLICACIÓN GOOGLE MAPS ES EL INSTRUMENTO IDÓNEO PARA DETERMINAR EL JUZGADO MÁS CERCANO',
    content: `Contradicción de Tesis número 1/2023-CT entre los criterios sustentados por la Tercera Sala Civil y los sostenidos por la Octava Sala Civil.
EXCUSA O RECUSACIÓN DE UN JUEZ DEL SISTEMA DE ORALIDAD FAMILIAR. LA APLICACIÓN GOOGLE MAPS ES EL INSTRUMENTO IDÓNEO PARA DETERMINAR EL JUZGADO DE MATERIA FAMILIAR MÁS CERCANO.
El Pleno del Supremo Tribunal de Justicia del Estado de Guanajuato determina que la aplicación Google Maps es la herramienta tecnológica idónea para determinar el juzgado especializado en el sistema de oralidad familiar más cercano en los casos de recusación o excusa, y que la distancia se debe calcular de juzgado a juzgado.
Aprobada en sesión del día 16 de agosto de 2023. Magistrada Ponente Ma. Elena Hernández Muñoz.`
  },
  {
    numero: '0003/2024',
    title: 'ACCIONES PROFORMA Y DE INSCRIPCIÓN EN EL REGISTRO PÚBLICO DE LA PROPIEDAD. NO HA LUGAR AL DESECHAMIENTO DE ESTA ÚLTIMA CUANDO SE INTENTE COMO ACCIÓN INDEPENDIENTE',
    content: `Contradicción de Tesis número 3/2024-CT entre los criterios sustentados por la Octava Sala Civil y por la Novena Sala Civil.
ACCIONES PROFORMA Y DE INSCRIPCIÓN EN EL REGISTRO PÚBLICO DE LA PROPIEDAD, NO HA LUGAR NECESARIAMENTE AL DESECHAMIENTO DE ESTA ÚLTIMA CUANDO SE INTENTE COMO ACCIÓN INDEPENDIENTE.
Cuando se intenta como acción principal el cumplimiento de contrato y como diversa prestación la inscripción ante el Registro Público en contra de diversa persona de los contratantes, no es dable desechar la demanda bajo la óptica de que el cumplimiento del contrato compete únicamente a los contratantes. El pronunciamiento debe hacerse desde una óptica integral y desde una perspectiva separada e independiente de cada prestación.
Aprobada en sesión del día 29 de abril de 2024. Magistrada Ponente Cigüeña Circe León López.`
  },
  {
    numero: '0007/2024',
    title: 'RECURSO DE APELACIÓN. ES PROCEDENTE EN CONTRA DEL AUTO QUE DESECHA O INADMITE UNA DEMANDA INCIDENTAL EN LOS JUICIOS ESPECIALES HIPOTECARIOS',
    content: `Contradicción de Tesis 7/2024-CT entre las sustentadas por la Cuarta y la Primera Salas Civiles.
RECURSO DE APELACIÓN. ES PROCEDENTE EN CONTRA DEL AUTO QUE DESECHA O INADMITE UNA DEMANDA INCIDENTAL EN LOS JUICIOS ESPECIALES HIPOTECARIOS, AL TENOR DE LO DISPUESTO EN LOS ARTÍCULOS 245 Y 704 O DEL CÓDIGO DE PROCEDIMIENTOS CIVILES PARA EL ESTADO DE GUANAJUATO.
En términos de los artículos 245 y 704 O del Código de Procedimientos Civiles para el Estado de Guanajuato, en contra del auto que desecha o inadmite un incidente en los juicios hipotecarios, sí procede el recurso de apelación. Los incidentes tienen una tramitación similar a una pequeña contienda accesoria, por lo que el escrito incidental tiene el mismo tratamiento que una demanda.
Aprobada en sesión del día 26 de febrero de 2025. Magistrada Ponente Edna Jesica Muñoz Escoto.`
  },
  {
    numero: '0002/2025',
    title: 'ACCIÓN CAUSAL. CUANDO EL NEGOCIO SUBYACENTE A LA EMISIÓN DEL TÍTULO DE CRÉDITO ES DE NATURALEZA CONTRACTUAL, SU CONOCIMIENTO CORRESPONDE A UN JUZGADO DE PARTIDO',
    content: `Contradicción de Tesis 2/2025-CT entre las sustentadas por la Segunda y la Octava Salas Civiles.
ACCIÓN CAUSAL. CUANDO EL NEGOCIO SUBYACENTE A LA EMISIÓN DEL TÍTULO DE CRÉDITO ES DE NATURALEZA CONTRACTUAL, SU CONOCIMIENTO CORRESPONDE A UN JUZGADO DE PARTIDO.
La acción causal ejercitada para obtener el pago de un título de crédito cuyo negocio subyacente sea de naturaleza contractual, constituye una acción de carácter primordialmente jurídico y no valuable en dinero. Conforme al artículo 24 del Código de Procedimientos Civiles para el Estado de Guanajuato, su conocimiento corresponde a un juzgado de partido, pues el objeto principal de la acción es la tutela del derecho subjetivo del acreedor y no el cobro inmediato de una cantidad líquida.
Aprobada en sesión del día 09 de julio de 2025. Magistrada Ponente Claudia Ibet Amezcua Rodríguez.`
  }
];

async function upsertJurisprudencia(j: typeof JURISPRUDENCIAS[0]) {
  const existing = await prisma.document.findFirst({
    where: { title: j.title, jurisdiccion: 'ESTATAL', sourceType: 'STJGTO' },
    select: { id: true }
  });
  if (existing) {
    await prisma.document.update({
      where: { id: existing.id },
      data: { content: j.content, active: true }
    });
    console.log(`Actualizada: ${j.numero} — ${j.title.substring(0, 60)}...`);
    return existing.id;
  } else {
    const created = await prisma.document.create({
      data: {
        title: j.title,
        content: j.content,
        matter: 'CIVIL',
        jurisdiccion: 'ESTATAL',
        submatter: 'JURISPRUDENCIA',
        sourceType: 'STJGTO',
        active: true
      },
      select: { id: true }
    });
    console.log(`Creada: ${j.numero} — ${j.title.substring(0, 60)}...`);
    return created.id;
  }
}

async function main() {
  console.log(`\nSeed de Jurisprudencias del STJGTO iniciado...`);
  console.log(`Total a procesar: ${JURISPRUDENCIAS.length}\n`);
  let creadas = 0, actualizadas = 0;
  for (const j of JURISPRUDENCIAS) {
    await upsertJurisprudencia(j);
    creadas++;
  }
  console.log(`\nSeed completado. ${creadas} jurisprudencias procesadas.`);
  console.log(`\nIMPORTANTE: Después de este seed ejecuta el script de embeddings para generar los vectores.`);
}

main()
  .catch((e) => { console.error('Error:', e?.message || e); })
  .finally(async () => { await prisma.$disconnect(); });
