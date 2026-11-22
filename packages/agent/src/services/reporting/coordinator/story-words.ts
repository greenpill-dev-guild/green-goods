/**
 * The words the reader that needs no model knows, in English, Spanish and Portuguese. A clause is
 * read only when each of its words is one of these, a fact's own words, or part of a place
 * phrase; any other word leaves the whole message to a question. So a word belongs here only when
 * it cannot change what a number in its clause means: "planted" can stay, "lost", "expected" and
 * "watered" cannot. Words are matched folded (lower case, no accents or apostrophes) and with a
 * final "s" taken off, so each list is written as people write the words.
 */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/['’]/gu, "");

const singular = (word: string) =>
  word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word;

/** A word as the reader compares it. */
export const wordKey = (word: string) => singular(fold(word));

const words = (list: string) => new Set(list.split(/\s+/u).filter(Boolean).map(wordKey));

/** Who did the work. */
export const PEOPLE = words(`i we me us it they them yo nosotros nosotras nos eu nós gente`);

/** The speaker counted beside a number: "me and 5 people" is six. ("nós" would fold to "nos",
 * which in Spanish is the "us" of "nos tomó 2 horas".) */
export const SPEAKER = words(`me i us yo mí nosotros eu mim`);

/** Words that say a number is work done, a total or a correction, whatever the activity. */
export const REPORT_CUES = words(`
  did done made finished completed total actually sorry correction
  hicimos hice completamos hechas hechos completados completadas realidad perdón corrección
  fizemos fiz concluímos concluído concluída concluídos concluídas feito feita feitos feitas
  verdade desculpa desculpe correção
`);

/**
 * Verbs that name a kind of work, each with the stem the activity has to mention for the verb to
 * count toward it: "we removed 12 trees" is not a planting, and "plantamos" is. A verb whose
 * stem the activity does not mention leaves the message to a question.
 */
const ACTS: Record<string, string> = {
  plant: `planted sowed seeded planté plantamos sembré sembramos plantadas plantados plantei semeei
    semeamos plantada plantado colocamos`,
  install: "installed instalé instalamos instalados instaladas instalei instalado",
  add: "added añadí añadimos agregué agregamos adicionei adicionamos",
  remov: "removed quitamos sacamos removemos tiramos",
  collect: "collected gathered recogí recogimos coletamos recolhemos",
  clean: "cleaned cleared limpié limpiamos limpei limpamos",
  repair: "repaired fixed reparé reparamos arreglamos consertamos",
  harvest: "harvested cosechamos colhemos",
  serv: "served atendimos servimos atendemos",
  deliver: "delivered entregamos",
  session: "taught trained enseñamos capacitamos ensinamos treinamos",
  open: "opened open abrimos",
  recycl: "recycled",
  compost: "composted",
  sort: "sorted",
  transfer: "transferred",
};
const ACT_STEMS = new Map(
  Object.entries(ACTS).flatMap(([stem, list]) => [...words(list)].map((word) => [word, stem]))
);

/**
 * For an activity, whether a word that names a kind of work fits it: true or false for such a
 * word, null for any other. The activity's title, slug, field titles and choices say what it is
 * about.
 */
export function actsFor(
  title: string,
  slug: string,
  inputs: ReadonlyArray<{ title: string; options: readonly string[] }>
): (word: string) => boolean | null {
  const about = fold(
    [title, slug, ...inputs.flatMap((input) => [input.title, ...input.options])].join(" ")
  );
  return (word) => {
    const stem = ACT_STEMS.get(word);
    return stem === undefined ? null : about.includes(stem);
  };
}

/** Words that carry no meaning a number could take: articles, past forms of "be", time words. */
export const FILLERS = words(`
  the an all this that these those was were had got about around approximately roughly
  hi hello hey thanks thank you ok okay yes hola gracias sí olá oi obrigado obrigada sim
  today yesterday morning afternoon evening mostly mainly only just
  el la los las lo un una unos unas fue fueron era eran tuvimos tuve hoy ayer esta este tarde
  noche aproximadamente alrededor cerca sobre todo todas todos principalmente solo sólo
  o os um uma uns umas foi foram eram tivemos teve hoje ontem manhã noite apenas só
`);

/** Words that may come before a number that answers the open question on its own: "about 12". */
export const APPROXIMATE = words(`about around approximately roughly unos unas uns umas
  aproximadamente alrededor cerca ok okay yes yeah yep sí si sim claro`);

/** "esta mañana" is this morning; "mañana" alone is tomorrow. */
export const MORNING_LEAD = words(`esta la por de`);
export const TOMORROW_OR_MORNING = wordKey("mañana");

/** Words that join one fact to the next. */
export const JOINERS = words(`and y e plus with con com also también também &`);

/** Words that join a number to what came before it: "in 2 hours", "con 6 personas". */
export const BEFORE_A_NUMBER = words(`in en em for por para durante during de`);

/** Words that open a place before the work is named: "At TAS today I planted ...". */
export function placeOpeners(locale: string): Set<string> {
  return words(`at in on en em na nas ${locale.startsWith("pt") ? "no nos" : ""}`);
}

/** Words that open a place or a description after a fact: "... by the fence", "de baobá". */
const AFTER_A_FACT = `by at in on near along beside behind around across inside outside under
  for of en junto sobre detrás dentro fuera frente cerca para por de del em na nas perto longo
  sob fora atrás da do das dos`;

/** In Spanish and Portuguese "a" opens a place ("a lo largo", "à cerca"); in English it counts. */
export function afterAFact(locale: string): Set<string> {
  const portuguese = locale.startsWith("pt") ? "no nos" : "";
  return words(`${AFTER_A_FACT} ${locale.startsWith("en") ? "" : "a al ao"} ${portuguese}`);
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
  amanhã depois ainda já são
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

/**
 * Whether the word after a number in an answer names what the asked field counts, in the field's
 * own words: its title, its hint, its unit or the words its question profile lists for it, as
 * "bags" is named by "Amount Removed (kg or bags)". Any other word ("6 of us", "200 meters",
 * "12 more") leaves the answer to a question.
 */
export function namesTheCount(stated: string, fieldWords: readonly string[]): boolean {
  const said = stated.trim().split(/\s+/u);
  if (said.length !== 1 || !/^[\p{L}'’]+$/u.test(said[0] ?? "")) return false;
  const own = new Set(
    fieldWords.flatMap((text) =>
      fold(text)
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
        .map(singular)
    )
  );
  return own.has(wordKey(said[0] as string));
}
