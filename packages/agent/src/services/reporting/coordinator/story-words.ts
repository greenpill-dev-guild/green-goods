/**
 * The words the reader that needs no model knows, in English, Spanish and Portuguese. A clause is
 * read only when each of its words is one of these, a fact's own words, or part of a place
 * phrase; any other word leaves the whole message to a question. So a word belongs here only when
 * it cannot change what a number in its clause means: "planted" can stay, "lost", "expected" and
 * "watered" cannot. Words are matched folded (lower case, no accents or apostrophes) and with a
 * final "s" taken off, so each list is written as people write the words.
 */
export const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/['’]/gu, "");

export const singular = (word: string) =>
  word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word;

/** A word as the reader compares it. */
export const wordKey = (word: string) => singular(fold(word));

const words = (list: string) => new Set(list.split(/\s+/u).filter(Boolean).map(wordKey));

/** Who did the work. */
export const PEOPLE = words(`i we me us it they them yo nosotros nosotras nos eu nós gente`);

/** Verbs that say the work was done, and words that say a number is a total or a correction. */
export const REPORT_CUES = words(`
  planted sowed seeded installed added built removed collected gathered cleared cleaned repaired
  fixed harvested served trained taught delivered held hosted opened open did
  done made finished completed recycled composted sorted transferred total actually sorry correction
  planté plantamos sembré sembramos instalé instalamos añadí añadimos agregué agregamos
  construimos quitamos recogí recogimos limpié limpiamos reparé reparamos arreglamos cosechamos
  atendimos servimos capacitamos entregamos abrimos hicimos hice completamos plantadas plantados hechas hechos instalados
  instaladas completados completadas realidad perdón corrección
  plantei semeei semeamos instalei adicionei adicionamos colocamos construímos removemos
  coletamos recolhemos limpei limpamos consertamos colhemos atendemos treinamos entregamos
  fizemos fiz
  concluímos concluído concluída concluídos concluídas feito feita feitos feitas instalado
  plantada plantado verdade desculpa desculpe correção
`);

/** Words that carry no meaning a number could take: articles, past forms of "be", time words. */
export const FILLERS = words(`
  the an all this that these those was were had got about around approximately roughly
  hi hello hey thanks thank you ok okay yes hola gracias sí olá oi obrigado obrigada sim
  today yesterday morning afternoon evening mostly mainly only just
  el la los las lo un una unos unas fue fueron era eran tuvimos tuve hoy ayer esta este tarde
  noche aproximadamente alrededor cerca sobre todo todas todos principalmente solo sólo
  o os um uma uns umas foi foram eram tivemos teve hoje ontem manhã noite apenas só
`);

/** "esta mañana" is this morning; "mañana" alone is tomorrow. */
export const MORNING_LEAD = words(`esta la por de`);
export const TOMORROW_OR_MORNING = wordKey("mañana");

/** Words that join one fact to the next. */
export const JOINERS = words(`and y e plus with con com also también também &`);

/** Words that join a number to what came before it: "in 2 hours", "con 6 personas". */
export const BEFORE_A_NUMBER = words(`in en em for por para durante during de`);

/** Words that open a place before the work is named: "At TAS today I planted ...". */
export const PLACE_OPENERS = words(`at in on en em na nas`);

/** Words that open a place or a description after a fact: "... by the fence", "de baobá". */
const AFTER_A_FACT = `by at in on near along beside behind around across inside outside under
  for of en junto sobre detrás dentro fuera frente cerca para por de del em na nas perto longo
  sob fora atrás da do das dos`;

/** In Spanish and Portuguese "a" opens a place ("a lo largo", "à cerca"); in English it counts. */
export function afterAFact(locale: string): Set<string> {
  return words(`${AFTER_A_FACT} ${locale.startsWith("en") ? "" : "a al ao"}`);
}

/** Words before a number that make it a clock time: "at 5", "às 8 horas", "a las 9". */
export const CLOCK_LEADS = words(`at as las until till from desde hasta ate até das pelas`);

/** Words that change or deny what a number in their clause says. */
const NEGATIONS = `not never none nothing nobody neither nor without except didnt dont doesnt
  couldnt cant cannot wont wasnt werent isnt arent havent hasnt hadnt shouldnt wouldnt
  nunca nada nadie ningún ninguna ninguno ni tampoco sin excepto menos jamás
  não nem nenhum nenhuma sem`;

/** "no" denies in English and Spanish, and means "in the" in Portuguese. */
export function negations(locale: string): Set<string> {
  return words(`${NEGATIONS} ${locale.startsWith("pt") ? "" : "no"}`);
}

/** Words that say a count is not work done now: lost, expected, planned, still to come. */
export const NOT_DONE = words(`
  died dead die dying lost missing stolen failed broken broke destroyed eaten expected expect
  planned plan planning will would going gonna next tomorrow later hope want need should could
  might left still yet again already there are is
  murieron murió muertas muertos muerta muerto perdimos perdidas perdidos faltaron faltan falta
  robadas esperábamos esperamos planeamos vamos voy iremos próximo próxima después todavía aún
  ya hay son es
  morreram morreu mortas mortos perdemos faltaram faltou roubadas esperávamos planejamos vou vai
  amanhã depois ainda já são é
`);

/** Words a choice may be named after: "the species was neem", "species: neem". */
export const NAMING = words(`was were is are fue fueron es era son foi foram é era : =`);

/** Words that say a duration is how long the work took. */
export const WORK_TIME = words(`
  took spent worked work lasted time tardamos tardé duró llevó trabajamos trabajé trabajo tiempo tomó
  levou levamos demorou demoramos durou gastamos trabalhamos trabalhei trabalho tempo
`);

export const HOURS = words(`hour hours hr hrs h hora horas`);
export const MINUTES = words(`minute minutes min mins minuto minutos`);
/** "an hour", "una hora", "uma hora". */
export const ONE = words(`a an one un una uma um`);
/** "and a half", "y media", "e meia". */
export const HALF = words(`half media meia`);
