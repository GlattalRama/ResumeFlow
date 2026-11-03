/**
 * Record the product tour as a real video: Playwright drives the app with the
 * fictional "Maya Schneider" demo data while we log timed captions.
 *
 *   GOOGLE_CLIENT_ID=replace_with_dev GOOGLE_CLIENT_SECRET=replace_with_dev npm run dev
 *   caffeinate -i npm run record:tour   # in another terminal; keeps the Mac awake
 *
 * The dev server must run in local mode (placeholder Google creds) so pages
 * are open and storage is data/*.json. The script swaps data/ for
 * scripts/tour/demo-data, records, and puts your data/ back afterwards.
 * AI steps make real OpenRouter calls; the waiting time is cut from the video.
 *
 * Output: public/tour/demo.mp4, public/tour/poster.webp and
 * public/tour/tour.json (captions in all five languages + chapter starts).
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.TOUR_BASE_URL ?? "http://localhost:3001";
const ROOT = process.cwd();
const DATA = join(ROOT, "data");
const DATA_BACKUP = join(ROOT, "data.tour-backup");
const FIXTURE = join(ROOT, "scripts", "tour", "demo-data");
const OUT = join(ROOT, "public", "tour");
const TMP = join(ROOT, ".tour-tmp");
const W = 1440;
const H = 900;

const SWISSRE_JD =
  "Swiss Re is hiring a Senior Product Manager to own our internal Data Platform. You will define the product vision for self-serve data access, partner with data engineering and actuarial teams, and drive adoption of governed data products across the organization. We are looking for someone with strong stakeholder management, a data-driven approach to prioritization, experience with B2B or internal enterprise platforms, and the ability to translate regulatory and compliance requirements into clear roadmaps. Experience with SQL, analytics tooling, API/platform product management, and OKRs is expected. German is a plus.";

// ---- Captions (all five UI languages) ---------------------------------------
// Chapter ids map to tour.chapters.<id> in messages/*.json.
const S = {
  welcome: {
    chapter: "start",
    en: ["Welcome to Resumeflow-ATS", "Resumes, job applications and interview prep in one place. Here is the whole flow in about three minutes."],
    de: ["Willkommen bei Resumeflow-ATS", "Lebensläufe, Bewerbungen und Interview-Vorbereitung an einem Ort. Hier ist der ganze Ablauf in rund drei Minuten."],
    es: ["Bienvenido a Resumeflow-ATS", "Currículums, candidaturas y preparación de entrevistas en un solo lugar. Aquí tienes todo el flujo en unos tres minutos."],
    fr: ["Bienvenue sur Resumeflow-ATS", "CV, candidatures et préparation aux entretiens au même endroit. Voici tout le parcours en trois minutes environ."],
    it: ["Benvenuto in Resumeflow-ATS", "Curriculum, candidature e preparazione ai colloqui in un unico posto. Ecco tutto il flusso in circa tre minuti."],
  },
  dashboard: {
    chapter: "start",
    en: ["Your dashboard", "Every resume, open application and next step at a glance. Everything is stored in your own Google Drive, not on our servers."],
    de: ["Deine Übersicht", "Alle Lebensläufe, offenen Bewerbungen und nächsten Schritte auf einen Blick. Alles liegt in deinem eigenen Google Drive, nicht auf unseren Servern."],
    es: ["Tu panel", "Todos tus currículums, candidaturas abiertas y próximos pasos de un vistazo. Todo se guarda en tu propio Google Drive, no en nuestros servidores."],
    fr: ["Ton tableau de bord", "Tous tes CV, candidatures en cours et prochaines étapes en un coup d'œil. Tout est stocké dans ton propre Google Drive, pas sur nos serveurs."],
    it: ["La tua dashboard", "Tutti i curriculum, le candidature aperte e i prossimi passi a colpo d'occhio. Tutto è salvato nel tuo Google Drive, non sui nostri server."],
  },
  resumes: {
    chapter: "resumes",
    en: ["Resume versions", "Keep one base resume and as many tailored versions as you need, each with its own ATS score."],
    de: ["Lebenslauf-Versionen", "Ein Basis-Lebenslauf und so viele angepasste Versionen wie nötig, jede mit eigenem ATS-Score."],
    es: ["Versiones del currículum", "Un currículum base y tantas versiones adaptadas como necesites, cada una con su propia puntuación ATS."],
    fr: ["Versions du CV", "Un CV de base et autant de versions adaptées que nécessaire, chacune avec son propre score ATS."],
    it: ["Versioni del curriculum", "Un curriculum base e tutte le versioni personalizzate che ti servono, ognuna con il proprio punteggio ATS."],
  },
  resumeDetail: {
    chapter: "resumes",
    en: ["One resume, everything around it", "Preview, download as PDF or Word, and see which applications used this version."],
    de: ["Ein Lebenslauf, alles drumherum", "Vorschau, Download als PDF oder Word, und welche Bewerbungen diese Version verwendet haben."],
    es: ["Un currículum y todo lo que lo rodea", "Vista previa, descarga en PDF o Word y qué candidaturas usaron esta versión."],
    fr: ["Un CV et tout ce qui l'entoure", "Aperçu, téléchargement en PDF ou Word, et les candidatures qui ont utilisé cette version."],
    it: ["Un curriculum e tutto il resto", "Anteprima, download in PDF o Word e quali candidature hanno usato questa versione."],
  },
  editor: {
    chapter: "resumes",
    en: ["The editor", "Sections on the left, a live preview on the right. What you see is exactly what the PDF will look like."],
    de: ["Der Editor", "Links die Abschnitte, rechts die Live-Vorschau. Was du siehst, ist genau das, was im PDF steht."],
    es: ["El editor", "Secciones a la izquierda y vista previa en vivo a la derecha. Lo que ves es exactamente cómo quedará el PDF."],
    fr: ["L'éditeur", "Les sections à gauche, l'aperçu en direct à droite. Ce que tu vois est exactement ce que contiendra le PDF."],
    it: ["L'editor", "Sezioni a sinistra, anteprima dal vivo a destra. Quello che vedi è esattamente come sarà il PDF."],
  },
  experience: {
    chapter: "resumes",
    en: ["Edit any section", "Work experience, skills, certificates, custom sections: reorder, hide or rewrite them and the preview follows."],
    de: ["Jeden Abschnitt bearbeiten", "Berufserfahrung, Skills, Zertifikate, eigene Abschnitte: umsortieren, ausblenden oder umschreiben, die Vorschau zieht mit."],
    es: ["Edita cualquier sección", "Experiencia, habilidades, certificados, secciones propias: reordénalas, ocúltalas o reescríbelas y la vista previa se actualiza."],
    fr: ["Modifier chaque section", "Expérience, compétences, certificats, sections personnalisées : réordonne, masque ou réécris, l'aperçu suit."],
    it: ["Modifica ogni sezione", "Esperienza, competenze, certificati, sezioni personalizzate: riordina, nascondi o riscrivi e l'anteprima si aggiorna."],
  },
  improve: {
    chapter: "resumes",
    en: ["Improve with AI", "One click rewrites a section to be sharper and more measurable. You review the suggestion and keep only what you like."],
    de: ["Mit KI verbessern", "Ein Klick formuliert einen Abschnitt prägnanter und messbarer. Du prüfst den Vorschlag und übernimmst nur, was dir gefällt."],
    es: ["Mejorar con IA", "Un clic reescribe una sección para que sea más clara y medible. Revisas la sugerencia y te quedas solo con lo que te gusta."],
    fr: ["Améliorer avec l'IA", "Un clic réécrit une section de façon plus précise et mesurable. Tu relis la proposition et ne gardes que ce qui te plaît."],
    it: ["Migliora con l'IA", "Un clic riscrive una sezione in modo più incisivo e misurabile. Rivedi il suggerimento e tieni solo ciò che ti piace."],
  },
  ats: {
    chapter: "resumes",
    en: ["ATS match score", "Paste a job description to see how well the resume matches and which keywords are missing."],
    de: ["ATS-Match-Score", "Füge eine Stellenbeschreibung ein und sieh, wie gut der Lebenslauf passt und welche Schlüsselwörter fehlen."],
    es: ["Puntuación ATS", "Pega una oferta de empleo para ver cuánto encaja el currículum y qué palabras clave faltan."],
    fr: ["Score de correspondance ATS", "Colle une offre d'emploi pour voir à quel point le CV correspond et quels mots-clés manquent."],
    it: ["Punteggio ATS", "Incolla un annuncio di lavoro per vedere quanto il curriculum corrisponde e quali parole chiave mancano."],
  },
  tracker: {
    chapter: "applications",
    en: ["Application tracker", "Every job you're after, grouped by stage, with the resume you sent and the next action due."],
    de: ["Bewerbungs-Tracker", "Jede Stelle, auf die du dich bewirbst, nach Phase geordnet, mit dem gesendeten Lebenslauf und dem nächsten Schritt."],
    es: ["Seguimiento de candidaturas", "Cada puesto que te interesa, agrupado por fase, con el currículum enviado y la próxima acción pendiente."],
    fr: ["Suivi des candidatures", "Chaque poste visé, classé par étape, avec le CV envoyé et la prochaine action à faire."],
    it: ["Tracker delle candidature", "Ogni posizione che ti interessa, raggruppata per fase, con il curriculum inviato e la prossima azione."],
  },
  addJob: {
    chapter: "applications",
    en: ["Add a job", "Paste the job link and Autofill reads the posting for you, or type the details yourself."],
    de: ["Stelle hinzufügen", "Link einfügen und Autofill liest die Ausschreibung für dich, oder die Details selbst eintippen."],
    es: ["Añadir un puesto", "Pega el enlace y Autofill lee la oferta por ti, o escribe los detalles tú mismo."],
    fr: ["Ajouter un poste", "Colle le lien et Autofill lit l'annonce pour toi, ou saisis les détails toi-même."],
    it: ["Aggiungi una posizione", "Incolla il link e Autofill legge l'annuncio per te, oppure inserisci i dettagli a mano."],
  },
  application: {
    chapter: "applications",
    en: ["One page per application", "The job description, the resume you sent, notes, documents and the full status history stay together."],
    de: ["Eine Seite pro Bewerbung", "Stellenbeschreibung, gesendeter Lebenslauf, Notizen, Dokumente und der ganze Statusverlauf bleiben zusammen."],
    es: ["Una página por candidatura", "La oferta, el currículum enviado, notas, documentos y todo el historial de estados, juntos."],
    fr: ["Une page par candidature", "L'offre, le CV envoyé, les notes, les documents et tout l'historique des statuts restent ensemble."],
    it: ["Una pagina per candidatura", "L'annuncio, il curriculum inviato, note, documenti e tutta la cronologia degli stati restano insieme."],
  },
  tailor: {
    chapter: "applications",
    en: ["Tailor the resume to the job", "AI rewrites your resume for this job description. It never invents experience, it only reframes what you have."],
    de: ["Lebenslauf auf die Stelle zuschneiden", "Die KI passt deinen Lebenslauf an diese Stelle an. Sie erfindet keine Erfahrung, sie formuliert nur um, was du hast."],
    es: ["Adaptar el currículum al puesto", "La IA adapta tu currículum a esta oferta. Nunca inventa experiencia, solo reformula lo que ya tienes."],
    fr: ["Adapter le CV au poste", "L'IA adapte ton CV à cette offre. Elle n'invente jamais d'expérience, elle reformule seulement ce que tu as."],
    it: ["Adatta il curriculum al lavoro", "L'IA adatta il curriculum a questo annuncio. Non inventa esperienze, riformula solo ciò che hai."],
  },
  review: {
    chapter: "applications",
    en: ["Review every change", "Accept or keep the original bullet by bullet, then save it as a new version linked to this application."],
    de: ["Jede Änderung prüfen", "Punkt für Punkt übernehmen oder das Original behalten, dann als neue Version zu dieser Bewerbung speichern."],
    es: ["Revisa cada cambio", "Acepta o conserva el original punto por punto y guárdalo como nueva versión vinculada a esta candidatura."],
    fr: ["Vérifier chaque modification", "Accepte ou garde l'original point par point, puis enregistre une nouvelle version liée à cette candidature."],
    it: ["Controlla ogni modifica", "Accetta o mantieni l'originale punto per punto, poi salvalo come nuova versione collegata alla candidatura."],
  },
  compare: {
    chapter: "applications",
    en: ["Side by side", "Compare the original and the tailored resume before you commit to anything."],
    de: ["Nebeneinander", "Vergleiche Original und angepassten Lebenslauf, bevor du etwas übernimmst."],
    es: ["Lado a lado", "Compara el original y la versión adaptada antes de decidir nada."],
    fr: ["Côte à côte", "Compare l'original et la version adaptée avant de valider quoi que ce soit."],
    it: ["Fianco a fianco", "Confronta l'originale e la versione adattata prima di confermare qualsiasi cosa."],
  },
  coverLetter: {
    chapter: "applications",
    en: ["Cover letter", "Generate a cover letter from the tailored resume and the job, then edit it right here."],
    de: ["Anschreiben", "Erstelle ein Anschreiben aus dem angepassten Lebenslauf und der Stelle und bearbeite es direkt hier."],
    es: ["Carta de presentación", "Genera una carta a partir del currículum adaptado y la oferta, y edítala aquí mismo."],
    fr: ["Lettre de motivation", "Génère une lettre à partir du CV adapté et de l'offre, puis modifie-la directement ici."],
    it: ["Lettera di presentazione", "Genera una lettera dal curriculum adattato e dall'annuncio, poi modificala qui."],
  },
  coach: {
    chapter: "interviews",
    en: ["Interview Coach", "Likely questions from the job description and your resume: behavioural, technical and the tricky ones."],
    de: ["Interview-Coach", "Wahrscheinliche Fragen aus Stellenbeschreibung und Lebenslauf: Verhalten, Fachliches und die heiklen."],
    es: ["Coach de entrevistas", "Preguntas probables a partir de la oferta y tu currículum: de comportamiento, técnicas y las difíciles."],
    fr: ["Coach d'entretien", "Les questions probables d'après l'offre et ton CV : comportementales, techniques et les plus délicates."],
    it: ["Coach per colloqui", "Le domande probabili dall'annuncio e dal curriculum: comportamentali, tecniche e quelle difficili."],
  },
  answer: {
    chapter: "interviews",
    en: ["Answers from your real experience", "Each answer is built in STAR format from your resume and work journal, with the evidence it used."],
    de: ["Antworten aus echter Erfahrung", "Jede Antwort entsteht im STAR-Format aus Lebenslauf und Arbeitsjournal, mit den verwendeten Belegen."],
    es: ["Respuestas con tu experiencia real", "Cada respuesta se construye en formato STAR con tu currículum y tu diario de trabajo, citando las pruebas usadas."],
    fr: ["Des réponses tirées de ton expérience", "Chaque réponse est construite au format STAR depuis ton CV et ton journal de travail, avec les preuves utilisées."],
    it: ["Risposte dalla tua esperienza reale", "Ogni risposta è costruita in formato STAR da curriculum e diario di lavoro, con le prove utilizzate."],
  },
  practice: {
    chapter: "interviews",
    en: ["Practice and get feedback", "Rehearse a full round or flash cards. Each answer is scored on clarity, structure and relevance, with tips to improve."],
    de: ["Üben mit Feedback", "Übe eine ganze Runde oder mit Karteikarten. Jede Antwort wird nach Klarheit, Struktur und Relevanz bewertet, mit Tipps."],
    es: ["Practica y recibe feedback", "Ensaya una ronda completa o con tarjetas. Cada respuesta se puntúa por claridad, estructura y relevancia, con consejos."],
    fr: ["S'entraîner avec retour", "Répète un entretien complet ou en cartes mémo. Chaque réponse est notée sur la clarté, la structure et la pertinence, avec des conseils."],
    it: ["Esercitati con feedback", "Prova un colloquio completo o con flashcard. Ogni risposta riceve un punteggio su chiarezza, struttura e pertinenza, con consigli."],
  },
  journal: {
    chapter: "journal",
    en: ["Work journal", "Log wins as they happen: situation, action, result, metrics and evidence. Future you will thank you at review time."],
    de: ["Arbeitsjournal", "Halte Erfolge fest, wenn sie passieren: Situation, Handlung, Ergebnis, Kennzahlen und Belege."],
    es: ["Diario de trabajo", "Registra tus logros cuando ocurren: situación, acción, resultado, métricas y pruebas."],
    fr: ["Journal de travail", "Note tes réussites au fil de l'eau : situation, action, résultat, chiffres et preuves."],
    it: ["Diario di lavoro", "Annota i successi quando accadono: situazione, azione, risultato, metriche e prove."],
  },
  journalEntry: {
    chapter: "journal",
    en: ["Ready-to-use outputs", "Each entry becomes a resume bullet, a STAR story, a LinkedIn post and a performance-review blurb."],
    de: ["Sofort verwendbar", "Jeder Eintrag wird zu einem Lebenslauf-Punkt, einer STAR-Geschichte, einem LinkedIn-Post und einem Text fürs Mitarbeitergespräch."],
    es: ["Listo para usar", "Cada entrada se convierte en un punto del currículum, una historia STAR, un post de LinkedIn y un texto para tu evaluación."],
    fr: ["Prêt à l'emploi", "Chaque entrée devient une ligne de CV, une histoire STAR, un post LinkedIn et un texte pour l'entretien annuel."],
    it: ["Pronto all'uso", "Ogni voce diventa un punto del curriculum, una storia STAR, un post LinkedIn e un testo per la valutazione annuale."],
  },
  insights: {
    chapter: "journal",
    en: ["Career insights", "See your strengths, the gaps in your story and how ready you are for the next level."],
    de: ["Karriere-Einblicke", "Sieh deine Stärken, die Lücken in deiner Geschichte und wie bereit du für den nächsten Schritt bist."],
    es: ["Visión de carrera", "Descubre tus fortalezas, los huecos en tu historia y lo preparado que estás para el siguiente nivel."],
    fr: ["Vue de carrière", "Vois tes forces, les manques dans ton parcours et ton niveau de préparation pour l'étape suivante."],
    it: ["Panoramica di carriera", "Scopri i tuoi punti di forza, le lacune nel tuo percorso e quanto sei pronto per il livello successivo."],
  },
  end: {
    chapter: "end",
    en: ["Try it yourself", "Sign in with Google or Apple. It's free, and your data stays in your own Google Drive."],
    de: ["Probier es selbst", "Melde dich mit Google oder Apple an. Kostenlos, und deine Daten bleiben in deinem eigenen Google Drive."],
    es: ["Pruébalo tú mismo", "Inicia sesión con Google o Apple. Es gratis y tus datos se quedan en tu propio Google Drive."],
    fr: ["Essaie par toi-même", "Connecte-toi avec Google ou Apple. C'est gratuit, et tes données restent dans ton propre Google Drive."],
    it: ["Provalo tu stesso", "Accedi con Google o Apple. È gratuito e i tuoi dati restano nel tuo Google Drive."],
  },
};
const LANGS = ["en", "de", "es", "fr", "it"];

// ---- Timeline ---------------------------------------------------------------
const cues = [];
const cuts = [];
let t0 = 0;
const now = () => (performance.now() - t0) / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Start a caption (logged as a cue, shown in-page only for the preview run) and hold. */
async function say(page, key, holdMs = 4000) {
  const s = S[key];
  const start = now();
  console.log(`[${start.toFixed(1)}s] ${s.chapter} · ${s.en[0]}`);
  if (cues.length) cues[cues.length - 1].end = start;
  cues.push({ key, start, end: start + holdMs / 1000, chapter: s.chapter });
  if (process.env.TOUR_SHOW_CAPTIONS) {
    await page
      .evaluate((html) => {
        let box = document.getElementById("__tour_caption");
        if (!box) {
          box = document.createElement("div");
          box.id = "__tour_caption";
          box.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;max-width:760px;background:rgba(10,15,26,.9);color:#fff;padding:12px 18px;border-radius:12px;font:14px/1.45 system-ui;pointer-events:none";
          document.body.appendChild(box);
        }
        box.innerHTML = html;
      }, `<b>${escapeHtml(s.en[0])}</b><br>${escapeHtml(s.en[1])}`)
      .catch(() => undefined);
  }
  await sleep(holdMs);
}

/** Wait for something slow (AI) and cut the dead time out of the video. */
async function waitCut(promise) {
  await sleep(1200);
  const from = now();
  await promise;
  const to = now() - 0.4;
  if (to - from > 0.5) cuts.push([from, to]);
  await sleep(600);
}

async function moveTo(page, locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 22 });
  await sleep(300);
}

async function click(page, locator, holdMs = 900) {
  await moveTo(page, locator);
  await locator.click();
  await sleep(holdMs);
}

async function type(page, locator, text, delay = 28) {
  await click(page, locator, 200);
  await locator.pressSequentially(text, { delay });
  await sleep(300);
}

async function go(page, path, wait = 1200) {
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 90000 });
  await sleep(wait);
}

async function scrollBy(page, dy, steps = 8) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await sleep(40);
  }
  await sleep(500);
}

async function scrollToText(page, text) {
  const loc = page.getByText(text, { exact: false }).first();
  if (!(await loc.count())) return false;
  await loc.evaluate((el) => {
    const y = el.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top: y, behavior: "smooth" });
  });
  await sleep(900);
  return true;
}

const navLink = (page, name) => page.locator("header nav").getByRole("link", { name, exact: true }).first();
const railButton = (page, name) => page.getByRole("button", { name: new RegExp("^" + name) }).first();

/** Run a step; if the UI changed and a locator fails, log it and keep recording. */
async function step(name, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`  ! step "${name}" failed: ${String(err).split("\n")[0]}`);
  }
}

// ---- Tour ---------------------------------------------------------------------
async function tour(page) {
  await go(page, "/", 600);
  await say(page, "welcome", 4200);
  await scrollBy(page, 420);
  await say(page, "dashboard", 4200);
  await scrollBy(page, -420);

  // Resumes
  await step("resumes", async () => {
    await click(page, navLink(page, "Resumes"), 1200);
    await say(page, "resumes", 4000);
  });
  await step("resume detail", async () => {
    await click(page, page.locator('a[href="/resumes/res-base"]').first(), 1800);
    await say(page, "resumeDetail", 3600);
  });

  await step("editor", async () => {
    await go(page, "/resumes/res-base/edit", 1500);
    await say(page, "editor", 4000);
  });
  await step("experience", async () => {
    await click(page, railButton(page, "Work Experience"), 1000);
    await say(page, "experience", 3200);
    await click(page, railButton(page, "Font & Colors"), 1800);
  });
  await step("improve", async () => {
    await click(page, railButton(page, "Summary"), 900);
    await click(page, page.getByRole("button", { name: /Improve with AI/ }).first(), 300);
    await say(page, "improve", 2200);
    // Accept is rendered (disabled) while the suggestion streams; wait until it's enabled.
    await waitCut(
      page.waitForFunction(
        () => [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Accept" && !b.disabled),
        null,
        { timeout: 120000 },
      ),
    );
    await sleep(2800);
    await click(page, page.getByRole("button", { name: "Discard", exact: true }).filter({ visible: true }).first(), 600);
  });
  await step("ats", async () => {
    // The rail's score card opens the ATS panel with the job-description box.
    await click(page, page.getByRole("button", { name: /Add a job description/ }).first(), 1000);
    const jd = page.locator('textarea[placeholder^="Paste the job description"]').first();
    await moveTo(page, jd);
    await jd.fill(SWISSRE_JD);
    await sleep(1800);
    await say(page, "ats", 4500);
    await scrollBy(page, 450);
    await sleep(1200);
  });

  // Applications
  await step("tracker", async () => {
    await click(page, navLink(page, "Applications"), 1800);
    await say(page, "tracker", 4000);
    const tab = page.getByRole("tab", { name: /Interview/ }).or(page.getByRole("link", { name: /^Interviewing/ })).first();
    if (await tab.isVisible().catch(() => false)) await click(page, tab, 1600);
  });
  await step("add job", async () => {
    await go(page, "/applications/new", 1000);
    await type(page, page.locator('input[placeholder="https://…"]').first(), "https://careers.example.com/jobs/senior-product-manager", 18);
    await moveTo(page, page.getByRole("button", { name: "Autofill from link", exact: true }).first());
    await say(page, "addJob", 3800);
  });
  await step("application", async () => {
    await go(page, "/applications/app-swissre", 1500);
    await say(page, "application", 4000);
    await scrollBy(page, 600);
    await sleep(1000);
  });
  await step("tailor", async () => {
    const openBtn = page.getByRole("button", { name: "Tailor Resume for this Job", exact: true }).first();
    await click(page, openBtn, 1200);
    await say(page, "tailor", 3200);
    await click(page, page.getByRole("button", { name: "Generate", exact: true }).first(), 300);
    const changes = page.getByRole("button", { name: /^Changes \(\d+\)$/ }).or(page.getByText(/^Changes \(\d+\)$/)).first();
    await waitCut(changes.waitFor({ state: "visible", timeout: 240000 }));
    await sleep(800);
    await say(page, "review", 3000);
    const keep = page.getByRole("button", { name: "Keep original", exact: true }).first();
    if (await keep.count()) await moveTo(page, keep);
    await sleep(1800);
    const sbs = page.getByRole("button", { name: "Side by side", exact: true }).or(page.getByText("Side by side", { exact: true })).first();
    await click(page, sbs, 1200);
    await say(page, "compare", 3600);
    const discard = page.getByRole("button", { name: "Discard", exact: true }).first();
    if (await discard.isVisible().catch(() => false)) await click(page, discard, 800);
    else await page.keyboard.press("Escape");
  });
  await step("cover letter", async () => {
    await scrollToText(page, "Dear Swiss Re Hiring Team");
    await say(page, "coverLetter", 4000);
  });

  // Interviews
  await step("coach", async () => {
    await click(page, navLink(page, "Interview Coach"), 1800);
    await say(page, "coach", 4000);
  });
  await step("answer", async () => {
    await click(page, page.getByText("How would you drive adoption of a governed data platform", { exact: false }).first(), 1200);
    await scrollToText(page, "Evidence used");
    await say(page, "answer", 4200);
  });
  await step("practice", async () => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(700);
    await click(page, page.getByRole("button", { name: "Practice", exact: true }).first(), 1200);
    const open = page.getByRole("button", { name: "Open", exact: true }).first();
    if (await open.isVisible().catch(() => false)) await click(page, open, 1500);
    await say(page, "practice", 4500);
    await scrollBy(page, 500);
    await sleep(1000);
  });

  // Journal
  await step("journal", async () => {
    await click(page, navLink(page, "Work Journal"), 1800);
    await say(page, "journal", 4000);
  });
  await step("journal entry", async () => {
    await click(page, page.getByText("Grew governed self-serve analytics", { exact: false }).first(), 1200);
    await scrollToText(page, "Ready-to-use outputs");
    await say(page, "journalEntry", 4200);
  });
  await step("insights", async () => {
    await go(page, "/work-journal", 800);
    await click(page, page.getByRole("button", { name: "Dashboard", exact: true }).first(), 1500);
    await say(page, "insights", 4000);
    await scrollBy(page, 500);
    await sleep(800);
  });

  await step("end", async () => {
    await go(page, "/", 800);
    await say(page, "end", 4500);
  });
  cues[cues.length - 1].end = now();
}

// ---- Fake cursor so viewers can follow the clicks ----------------------------
const CURSOR_SCRIPT = `
(() => {
  const install = () => {
    if (document.getElementById("__tour_cursor")) return;
    const style = document.createElement("style");
    style.textContent = "nextjs-portal{display:none!important}#__tour_cursor{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(0,51,160,.28);border:2px solid rgba(0,51,160,.9);z-index:2147483647;pointer-events:none;transition:transform .12s}#__tour_cursor.down{transform:scale(.7);background:rgba(0,51,160,.5)}";
    document.head.appendChild(style);
    const dot = document.createElement("div");
    dot.id = "__tour_cursor";
    const pos = window.__tourPos || { x: -100, y: -100 };
    dot.style.left = pos.x + "px"; dot.style.top = pos.y + "px";
    document.body.appendChild(dot);
  };
  document.addEventListener("mousemove", (e) => {
    window.__tourPos = { x: e.clientX, y: e.clientY };
    try { sessionStorage.setItem("__tourPos", JSON.stringify(window.__tourPos)); } catch {}
    const d = document.getElementById("__tour_cursor");
    if (d) { d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px"; }
  }, true);
  document.addEventListener("mousedown", () => document.getElementById("__tour_cursor")?.classList.add("down"), true);
  document.addEventListener("mouseup", () => document.getElementById("__tour_cursor")?.classList.remove("down"), true);
  try { window.__tourPos = JSON.parse(sessionStorage.getItem("__tourPos") || "null") || undefined; } catch {}
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
})();
`;

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = join(homedir(), "Library", "Caches", "ms-playwright");
  if (!existsSync(cache)) return undefined;
  for (const dir of readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
    const p = join(cache, dir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
    if (existsSync(p)) return p;
  }
  return undefined;
}

function swapInDemoData() {
  if (existsSync(DATA_BACKUP)) throw new Error(`${DATA_BACKUP} exists — a previous run did not finish. Move it back to data/ first.`);
  if (existsSync(DATA)) renameSync(DATA, DATA_BACKUP);
  cpSync(FIXTURE, DATA, { recursive: true });
}

function restoreData() {
  rmSync(DATA, { recursive: true, force: true });
  if (existsSync(DATA_BACKUP)) renameSync(DATA_BACKUP, DATA);
}

async function main() {
  const res = await fetch(BASE + "/api/resumes").catch(() => null);
  if (!res || res.status !== 200) {
    throw new Error(`${BASE}/api/resumes did not return 200 — start the dev server in local mode (see header comment).`);
  }
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  swapInDemoData();
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      restoreData();
      process.exit(130);
    });
  }

  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  try {
    // Warm up every route first so dev-mode compiles don't show in the video.
    const warm = await browser.newContext({ viewport: { width: W, height: H } });
    const wp = await warm.newPage();
    for (const p of ["/", "/resumes", "/resumes/res-base", "/resumes/res-base/edit", "/applications", "/applications/new", "/applications/app-swissre", "/interview-coach", "/work-journal", "/signin"]) {
      await wp.goto(BASE + p, { waitUntil: "networkidle", timeout: 120000 }).catch(() => undefined);
    }
    await warm.close();

    const context = await browser.newContext({
      viewport: { width: W, height: H },
      recordVideo: { dir: TMP, size: { width: W, height: H } },
      colorScheme: "light",
      deviceScaleFactor: 1,
    });
    await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: BASE }]);
    await context.addInitScript(CURSOR_SCRIPT);
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on("dialog", (d) => d.accept().catch(() => undefined));
    t0 = performance.now();
    await page.mouse.move(W / 2, H / 2);
    await tour(page);
    await context.close();
  } finally {
    await browser.close();
    restoreData();
  }

  // ---- Files ----------------------------------------------------------------
  const webm = readdirSync(TMP).find((f) => f.endsWith(".webm"));
  if (!webm) throw new Error("No video recorded");
  const src = join(TMP, webm);

  // Remove the AI waiting time and shift the captions to match.
  const shift = (t) => t - cuts.filter(([a]) => a < t).reduce((sum, [a, b]) => sum + (Math.min(t, b) - a), 0);
  const keep = cuts.length ? `,select='not(${cuts.map(([a, b]) => `between(t\\,${a.toFixed(2)}\\,${b.toFixed(2)})`).join("+")})',setpts=N/FRAME_RATE/TB` : "";
  execFileSync(
    "ffmpeg",
    ["-y", "-v", "error", "-i", src, "-vf", `fps=25${keep}`, "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", join(OUT, "demo.mp4")],
    { stdio: "inherit" },
  );
  const posterPng = join(TMP, "poster.png");
  execFileSync("ffmpeg", ["-y", "-ss", "3", "-i", join(OUT, "demo.mp4"), "-frames:v", "1", "-vf", "scale=1280:-1", posterPng], { stdio: "ignore" });
  execFileSync("cwebp", ["-q", "80", posterPng, "-o", join(OUT, "poster.webp")], { stdio: "ignore" });
  rmSync(TMP, { recursive: true, force: true });

  const round = (n) => Math.round(n * 100) / 100;
  const outCues = cues.map((c) => ({
    start: round(shift(c.start)),
    end: round(shift(c.end)),
    chapter: c.chapter,
    title: Object.fromEntries(LANGS.map((l) => [l, S[c.key][l][0]])),
    text: Object.fromEntries(LANGS.map((l) => [l, S[c.key][l][1]])),
  }));
  const chapters = [];
  for (const c of outCues) if (!chapters.some((x) => x.id === c.chapter)) chapters.push({ id: c.chapter, start: Math.floor(c.start) });
  const duration = Math.ceil(outCues[outCues.length - 1].end);
  writeFileSync(join(OUT, "tour.json"), JSON.stringify({ duration, chapters, cues: outCues }, null, 2) + "\n");
  console.log(`Recorded ${duration}s (cut ${cuts.length} AI waits), ${outCues.length} captions, ${chapters.length} chapters → public/tour/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
