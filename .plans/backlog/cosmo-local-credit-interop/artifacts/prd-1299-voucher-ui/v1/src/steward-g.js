/* Steward cockpit: the cross-garden personal G$ purchase. Two gardens act: the provider garden
   (Green Goods Community Garden, whose pool is the protocol pool) approves; the buyer garden
   (Riverside Commons Garden, fictional) records, applies and, when owed, refunds the member's own
   G$ held in its Safe. People, amounts and times are fictional. */
GG.T({
  "s.promisesTab": ["Promises", "Promesas", "Promessas"],
  "s.overview": ["Overview", "Resumen", "Visão geral"],
  "s.work": ["Work", "Trabajo", "Trabalho"],
  "s.impact": ["Impact", "Impacto", "Impacto"],
  "s.gardenTitle": ["Garden", "Jardín", "Jardim"],
  "s.review": ["Review Promises", "Revisar promesas", "Revisar promessas"],
  "s.reviewSub": ["Neighbors asking to take a promise up. Approving one closes the others on that promise.", "Vecinos que piden aceptar una promesa. Aprobar una cierra las demás de esa promesa.", "Vizinhos pedindo para aceitar uma promessa. Aprovar uma fecha as outras dessa promessa."],
  "s.nothing": ["Nothing to review.", "Nada que revisar.", "Nada para revisar."],
  "s.offersReqs": ["Offers and Requests", "Ofertas y peticiones", "Ofertas e pedidos"],
  "s.poolStatus": ["Pool Status", "Estado del fondo común", "Status do fundo comum"],
  "s.poolFunding": ["Pool Funding", "Financiación del fondo común", "Financiamento do fundo comum"],
  "s.poolOpen": ["Open · 12 promises · Autumn season", "Abierto · 12 promesas · temporada de otoño", "Aberto · 12 promessas · temporada de outono"],
  "s.fundingLine": ["Funded through the protocol route", "Financiado por la ruta del protocolo", "Financiado pela rota do protocolo"],
  "s.approve": ["Approve", "Aprobar", "Aprovar"],
  "s.decline": ["Decline…", "Rechazar…", "Recusar…"],
  "s.offer": ["Offer", "Oferta", "Oferta"],
  "s.request": ["Request", "Petición", "Pedido"],
  "s.open": ["Open", "Abierta", "Aberta"],
  "s.ownRoute": ["Own G$ route", "Ruta de G$ propios", "Rota de G$ próprios"],
  "s.takesV": ["Takes vouchers", "Acepta vales", "Aceita vales"],
  "s.depChecked": ["Deposit recorded", "Depósito registrado", "Depósito registrado"],
  "s.depWaiting": ["No deposit yet", "Sin depósito aún", "Sem depósito ainda"],
  "s.termsStale": ["Old terms", "Condiciones antiguas", "Condições antigas"],
  "s.m.lina": ["AI assistant membership · own G$, 450.00 G$ held by Riverside Commons · asked Today, 10:41 AM", "AI assistant membership · G$ propios, 450,00 G$ en Riverside Commons · pidió hoy, 10:41", "AI assistant membership · G$ próprios, 450,00 G$ no Riverside Commons · pediu hoje, 10:41"],
  "s.m.kofi": ["AI assistant membership · own G$, nothing recorded at Hilltop Orchard · asked Yesterday, 4:12 PM", "AI assistant membership · G$ propios, nada registrado en Hilltop Orchard · pidió ayer, 16:12", "AI assistant membership · G$ próprios, nada registrado no Hilltop Orchard · pediu ontem, 16:12"],
  "s.m.ai": ["450 G$ · approval needed · 2 asks waiting", "450 G$ · requiere aprobación · 2 pedidos en espera", "450 G$ · precisa de aprovação · 2 pedidos aguardando"],
  "s.m.web": ["Garden payment only · 1 hour", "Solo pago de jardines · 1 hora", "Somente pagamento de jardins · 1 hora"],
  "s.m.translate": ["Pays 200 G$ · due Nov 30", "Paga 200 G$ · vence el 30 nov", "Paga 200 G$ · vence em 30 nov"],
  "s.stale.t": ["Promise data is 6 minutes old", "Los datos de promesas tienen 6 minutos", "Os dados de promessas têm 6 minutos"],
  "s.stale.b": ["Approvals wait until it refreshes, so nothing is approved on old data.", "Las aprobaciones esperan a que se actualice, para no aprobar con datos viejos.", "As aprovações esperam a atualização, para nada ser aprovado com dados antigos."],
  "s.whyOff": ["Why is Approve off?", "¿Por qué Aprobar está desactivado?", "Por que Aprovar está desativado?"]
});
GG.ckRowsGGCG = function (st) {
  var stale = st === "stale";
  return GG.arow({ name: "Lina", chips: GG.sb("ok", t("s.depChecked")), meta: t("s.m.lina"), acts: GG.abtn(t("s.decline"), { disabled: stale }) + GG.abtn(t("s.approve"), { fill: true, go: "S02@ready", disabled: stale }) }) +
    GG.arow({ name: "Kofi", chips: GG.sb("neu", t("s.depWaiting")), meta: t("s.m.kofi"), acts: GG.abtn(t("s.decline"), { disabled: stale }) + GG.abtn(t("s.approve"), { go: "S02@unverified", disabled: true }) });
};

/* ---------------- S01 Provider garden › Promises (Review Promises) ---------------- */
GG.SCR("S01", {
  surface: "steward", journey: "gd", title: "Provider garden › Promises: review asks", entry: true, prd: "PRD-1297",
  states: [["default", "Asks waiting (one verified, one not)", "default"], ["empty", "Nothing to review", "empty"], ["stale", "Indexer behind", "stale"]],
  notes: {
    who: "Provider steward (Green Goods Community Garden operator or owner hat), wallet on Arbitrum.",
    pre: "Approval-gated Individual Offer with the personal G$ route. Each ask shows its funding state, read from the buyer garden's deposit record.",
    auth: "Nothing here; Approve opens the guarded confirmation (S02).",
    out: "Decision rows (Decline…, Approve). A decided row keeps its place with its outcome (DL-067).",
    rec: "Stale data disables decisions until refreshed; nothing is approved on old data.",
    facts: "Review Promises rows join claim records with the cross-garden funding record (buyer garden, DepositRecorded or not). Funding state is shown, never inferred from the claim alone.",
    tags: ["req", "sel", "ui"], dec: ["D1"]
  },
  stateNotes: {
    default: { say: "Approve is filled only where the deposit is recorded; the other row's Approve is off and its chip says why.", sr: "Row chips are text; disabled Approve has a description \"No deposit yet\"." },
    empty: { say: "The card stays with one quiet line (DL-067).", sr: "None." },
    stale: { say: "Freshness is a blocker for consequential acts.", sr: "Notice (status)." }
  },
  render: function (st, ctx) {
    var D = GG.D;
    var review = GG.acard({ title: t("s.review"), sub: t("s.reviewSub"), rows: st === "empty" ? "" : GG.ckRowsGGCG(st), body: st === "empty" ? '<p class="small" style="margin:0;color:var(--muted)">' + t("s.nothing") + "</p>" : "" });
    var list = GG.acard({ title: t("s.offersReqs"), rows:
      GG.arow({ dir: "offer", name: D.aiTitle, chips: GG.sb("ok", t("s.open")) + GG.sb("neu", t("s.ownRoute")), meta: t("s.m.ai") }) +
      GG.arow({ dir: "offer", name: "Website check-up, 1 hour", chips: GG.sb("ok", t("s.open")), meta: t("s.m.web") }) +
      GG.arow({ dir: "req", name: "Translate the field guide to Portuguese", chips: GG.sb("info", t("s.open")), meta: t("s.m.translate") }) });
    var main = (st === "stale" ? '<div class="flowrow" role="status">' + ic("refresh", 16) + "<span><b>" + t("s.stale.t") + "</b> " + t("s.stale.b") + "</span></div>" : "") + list;
    var rail = review + GG.acard({ title: t("s.poolStatus"), body: '<p class="small" style="margin:0">' + t("s.poolOpen") + "</p>" }) + GG.acard({ title: t("s.poolFunding"), body: '<p class="small" style="margin:0">' + t("s.fundingLine") + "</p>" });
    if (ctx && ctx.phone) { main = review + main; rail = rail.replace(review, ""); }
    return GG.ckShell({ garden: D.ggcg, av: "GG", title: t("s.gardenTitle"), tabs: [t("s.overview"), t("s.promisesTab"), t("s.work"), t("s.impact")], tab: 1, main: main, rail: rail });
  }
});

/* ---------------- S02 Approve a G$ purchase (guarded acceptance) ---------------- */
GG.T({
  "s02.title": ["Approve Lina's Request?", "¿Aprobar la solicitud de Lina?", "Aprovar a solicitação de Lina?"],
  "s02.target": ["Writing to Green Goods Community Garden's pool, the protocol pool", "Escribe en el fondo común de Green Goods Community Garden, el del protocolo", "Grava no fundo comum do Green Goods Community Garden, o do protocolo"],
  "s02.promise": ["Promise", "Promesa", "Promessa"],
  "s02.askedBy": ["Asked by", "Pedida por", "Pedida por"],
  "s02.askedByV": ["Lina, gardener at Riverside Commons Garden", "Lina, jardinera de Riverside Commons Garden", "Lina, jardineira do Riverside Commons Garden"],
  "s02.askedByKofi": ["Kofi, gardener at Hilltop Orchard", "Kofi, jardinero de Hilltop Orchard", "Kofi, jardineiro do Hilltop Orchard"],
  "s02.payment": ["Payment", "Pago", "Pagamento"],
  "s02.paymentV": ["450.00 G$ of her own, held by Riverside Commons Garden", "450,00 G$ propios, guardados por Riverside Commons Garden", "450,00 G$ próprios, guardados pelo Riverside Commons Garden"],
  "s02.checks": ["Before you approve", "Antes de aprobar", "Antes de aprovar"],
  "s02.cTerms": ["Lina agreed to version 3, the current terms", "Lina aceptó la versión 3, las condiciones actuales", "Lina aceitou a versão 3, as condições atuais"],
  "s02.cTermsS": ["From her signed request", "Según su solicitud firmada", "Conforme a solicitação assinada"],
  "s02.cDep": ["A Riverside Commons steward recorded 450.00 G$ arriving", "Un responsable de Riverside Commons registró la llegada de 450,00 G$", "Um responsável do Riverside Commons registrou a chegada de 450,00 G$"],
  "s02.cDepS": ["Tomás, Today, 10:58 AM. A steward's check, not automatic proof.", "Tomás, hoy, 10:58. Lo comprobó un responsable, no es una prueba automática.", "Tomás, hoje, 10:58. Conferência de um responsável, não é prova automática."],
  "s02.cApply": ["Riverside Commons applies her deposit after you approve", "Riverside Commons aplica su depósito después de que apruebes", "O Riverside Commons aplica o depósito dela depois que você aprovar"],
  "s02.cApplyS": ["Until then, the service shouldn't start.", "Hasta entonces, el servicio no debería empezar.", "Até lá, o serviço não deve começar."],
  "s02.noDep": ["No deposit recorded yet", "Aún no hay depósito registrado", "Ainda não há depósito registrado"],
  "s02.noDepS": ["Approve stays off until a Hilltop Orchard steward records it. Approving without it would provide the service before anyone is paid.", "Aprobar sigue desactivado hasta que un responsable de Hilltop Orchard lo registre. Aprobar sin él daría el servicio antes de que nadie pague.", "Aprovar continua desativado até um responsável do Hilltop Orchard registrar. Aprovar sem isso entregaria o serviço antes de alguém pagar."],
  "s02.staleT": ["Lina agreed to version 3; the offer is now version 4", "Lina aceptó la versión 3; el ofrecimiento ya es la versión 4", "Lina aceitou a versão 3; a oferta agora é a versão 4"],
  "s02.staleS": ["She has to agree again before you can approve.", "Tiene que volver a aceptar antes de que puedas aprobar.", "Ela precisa aceitar de novo antes de você aprovar."],
  "s02.conseq": ["Approving starts this promise with Lina and closes 1 other ask on it. Her G$ stays in Riverside Commons Garden's Safe until the promise is kept or ends. It then pays this promise's team under its payout plan, or goes back to her. Access to the AI assistant is set up separately.", "Aprobar inicia esta promesa con Lina y cierra 1 pedido más. Sus G$ siguen en el Safe de Riverside Commons Garden hasta que la promesa se cumpla o termine. Entonces pagan al equipo de esta promesa según su plan de pagos, o vuelven a ella. El acceso al asistente de IA se activa aparte.", "Aprovar inicia esta promessa com Lina e fecha 1 outro pedido. Os G$ dela ficam no Safe do Riverside Commons Garden até a promessa ser cumprida ou terminar. Depois pagam a equipe desta promessa conforme o plano de pagamento, ou voltam para ela. O acesso ao assistente de IA é ativado à parte."],
  "s02.walletOnce": ["Your wallet asks once.", "Tu billetera te pide una firma.", "Sua carteira pede uma assinatura."],
  "s02.approveReq": ["Approve Request", "Aprobar solicitud", "Aprovar solicitação"],
  "s02.sending": ["Approving… waiting for your wallet", "Aprobando… esperando a tu billetera", "Aprovando… aguardando sua carteira"],
  "s02.done": ["Approved. Lina's request is accepted; Riverside Commons applies her deposit next.", "Aprobada. Se aceptó la solicitud de Lina; Riverside Commons aplica su depósito a continuación.", "Aprovada. A solicitação de Lina foi aceita; o Riverside Commons aplica o depósito em seguida."],
  "s02.failed": ["Didn't go through. Nothing changed. Try again.", "No se completó. No cambió nada. Inténtalo de nuevo.", "Não foi concluída. Nada mudou. Tente de novo."],
  "s02.ready": ["Ready to approve.", "Lista para aprobar.", "Pronta para aprovar."]
});
GG.SCR("S02", {
  surface: "steward", journey: "gd", title: "Approve a G$ purchase (guarded acceptance)", prd: "PRD-1297",
  states: [["ready", "All checks pass", "default"], ["unverified", "No deposit recorded", "blocked"], ["stale", "Consent on old terms", "stale"], ["sending", "Waiting for wallet", "pending"], ["done", "Approved", "success"], ["failed", "Failed, nothing changed", "failure"]],
  notes: {
    who: "Provider steward, wallet on Arbitrum. Writes to the protocol pool (warning target, DL-066).",
    pre: "Exact consent to the current revision; buyer-garden steward's deposit attestation; pool open. Evidence: signed request record, DepositRecorded funding record, terms revision.",
    auth: "Acceptance of one claim, closing the others on the promise.",
    out: "FlowStatusRow keeps one height through ready, sending, done and failed (DL-072).",
    rec: "Failure leaves state unchanged; retry from the same dialog. Stale consent: the buyer must re-consent (M06@stale).",
    facts: "Upgraded CommitmentPooling acceptance guard rejects acceptance without exact-revision consent. Whether acceptance also requires DepositRecorded is a product choice (prototype: required, to avoid fronting the service from the garden); today's settlement spec allows acceptance without a recorded deposit (\"fronts the Offer from the Safe\").",
    tags: ["req", "sel", "open"], dec: ["D1"]
  },
  stateNotes: {
    ready: { say: "Checks name their source: a signed request, and a person's attestation.", sr: "Alert dialog; checks read as a list." },
    unverified: { say: "Approve disabled with the reason in the check list.", sr: "Disabled button described by the failed check." },
    stale: { say: "The guard's rule shown before signing; the UI cannot bypass it.", sr: "Failed check read first." },
    sending: { say: "Close blocked while in flight.", sr: "Status row (polite)." },
    done: { say: "Quiet done state; the steward closes it.", sr: "Status row (polite)." },
    failed: { say: "Failure keeps the dialog with nothing changed.", sr: "Status row (assertive)." }
  },
  render: function (st, ctx) {
    var D = GG.D, blocked = st === "unverified" || st === "stale";
    var checks = st === "unverified" ? GG.checkrow("ok", t("s02.cTerms"), t("s02.cTermsS")) + GG.checkrow("no", t("s02.noDep"), t("s02.noDepS")) :
      st === "stale" ? GG.checkrow("no", t("s02.staleT"), t("s02.staleS")) + GG.checkrow("ok", t("s02.cDep"), t("s02.cDepS")) :
      GG.checkrow("ok", t("s02.cTerms"), t("s02.cTermsS")) + GG.checkrow("ok", t("s02.cDep"), t("s02.cDepS")) + GG.checkrow("wait", t("s02.cApply"), t("s02.cApplyS"));
    var flow = st === "sending" ? GG.flowrow("info", "spin", t("s02.sending")) : st === "done" ? GG.flowrow("ok", "check", t("s02.done")) : st === "failed" ? GG.flowrow("err", "xcirc", t("s02.failed")) : GG.flowrow("", "info", t("s02.ready"));
    var name = st === "unverified" ? "Kofi" : "Lina";
    var body = GG.target(t("s02.target"), true) + flow + GG.afacts([[t("s02.promise"), D.aiTitle], [t("s02.askedBy"), st === "unverified" ? t("s02.askedByKofi") : t("s02.askedByV")], [t("m03.terms"), t("c.version", { n: 3 })], [t("s02.payment"), st === "unverified" ? t("s.depWaiting") : t("s02.paymentV")]]) +
      '<div class="dsec"><h3>' + t("s02.checks") + '</h3><div class="checks">' + checks + "</div></div>" + '<p style="margin:0">' + t("s02.conseq") + "</p>";
    var foot = st === "done" ? GG.abtn(t("c.done"), { fill: true, go: "S01@default" }) : GG.abtn(t("c.cancel"), { disabled: st === "sending" }) + GG.abtn(st === "failed" ? t("c.tryagain") : t("s02.approveReq"), { fill: true, go: "@sending", disabled: blocked || st === "sending" });
    return GG.screens.S01.render("default", ctx) + GG.adlg({ title: st === "unverified" ? t("s02.title").replace("Lina", "Kofi") : t("s02.title"), body: body, foot: foot, note: blocked ? "" : t("s02.walletOnce"), alert: true });
  }
});

/* ---------------- S03 Buyer garden › Promises: Member Deposits ---------------- */
GG.T({
  "s03.title": ["Member Deposits", "Depósitos de miembros", "Depósitos de membros"],
  "s03.sub": ["Members' own G$ sent to this garden's Safe for promises in other gardens. Not garden funds.", "G$ propios de miembros enviados al Safe de este jardín para promesas de otros jardines. No son fondos del jardín.", "G$ próprios de membros enviados ao Safe deste jardim para promessas de outros jardins. Não são fundos do jardim."],
  "s03.toCheck": ["To Check", "Por comprobar", "Para conferir"],
  "s03.toApply": ["To Apply", "Por aplicar", "Para aplicar"],
  "s03.refunds": ["Refunds", "Reembolsos", "Reembolsos"],
  "s03.check": ["Check Deposit…", "Comprobar depósito…", "Conferir depósito…"],
  "s03.apply": ["Apply Deposit…", "Aplicar depósito…", "Aplicar depósito…"],
  "s03.retry": ["Try Refund Again", "Reintentar reembolso", "Tentar reembolso de novo"],
  "s03.queueRefund": ["Queue Refund…", "Poner reembolso en cola…", "Enfileirar reembolso…"],
  "s03.c.check": ["To check", "Por comprobar", "Para conferir"],
  "s03.c.withdrawn": ["Withdrawn", "Retirada", "Retirada"],
  "s03.c.accepted": ["Accepted", "Aceptada", "Aceita"],
  "s03.c.failed": ["Refund failed", "Reembolso fallido", "Reembolso falhou"],
  "s03.c.declined": ["Declined", "Rechazada", "Recusada"],
  "s03.m.lina": ["AI assistant membership at Green Goods Community Garden · expects 450.00 G$ · sent Today, 10:52 AM", "AI assistant membership en Green Goods Community Garden · espera 450,00 G$ · enviado hoy, 10:52", "AI assistant membership no Green Goods Community Garden · espera 450,00 G$ · enviado hoje, 10:52"],
  "s03.m.ama": ["Website check-up at Green Goods Community Garden · 452.26 G$ arrived after she withdrew", "Website check-up en Green Goods Community Garden · llegaron 452,26 G$ después de retirar", "Website check-up no Green Goods Community Garden · chegaram 452,26 G$ depois que ela retirou"],
  "s03.m.linaApply": ["AI assistant membership · accepted Today, 2:05 PM · 450.00 G$ recorded", "AI assistant membership · aceptada hoy, 14:05 · 450,00 G$ registrados", "AI assistant membership · aceita hoje, 14:05 · 450,00 G$ registrados"],
  "s03.m.amaFail": ["450.00 G$ to 0x51d0…c2A9 · attempt 1 failed on Celo · Today, 3:10 PM", "450,00 G$ a 0x51d0…c2A9 · falló el intento 1 en Celo · hoy, 15:10", "450,00 G$ para 0x51d0…c2A9 · tentativa 1 falhou na Celo · hoje, 15:10"],
  "s03.m.joao": ["Translation workshop at Sunroot Skills Hub · declined Oct 21 · 300.00 G$ recorded", "Translation workshop en Sunroot Skills Hub · rechazada el 21 oct · 300,00 G$ registrados", "Translation workshop na Sunroot Skills Hub · recusada em 21 out · 300,00 G$ registrados"],
  "s03.empty": ["No member deposits to check.", "No hay depósitos de miembros por comprobar.", "Nenhum depósito de membro para conferir."],
  "s03.stale.b": ["Celo balances are 2 hours old. Checks wait until they refresh.", "Los saldos de Celo tienen 2 horas. Las comprobaciones esperan a que se actualicen.", "Os saldos da Celo têm 2 horas. As conferências esperam a atualização."]
});
GG.SCR("S03", {
  surface: "steward", journey: "gd", title: "Buyer garden › Promises: Member Deposits (new card)", entry: true, prd: "PRD-1297",
  states: [["check", "To Check", "default"], ["apply", "To Apply", "default"], ["refunds", "Refunds (one failed)", "failure"], ["empty", "Nothing to check", "empty"], ["stale", "Celo data stale", "stale"]],
  notes: {
    who: "Buyer-garden settlement steward (operator or owner of Riverside Commons Garden), wallet on Arbitrum.",
    pre: "Pledges naming this garden as the buyer garden; Celo transfer reads into its registered Safe; acceptance state from the provider's pool.",
    auth: "Opens Check Deposit (S04), Apply Deposit (S05) or a refund retry.",
    out: "One card, three scopes of one list (interaction-patterns §5): what arrives, what to apply, what to return.",
    rec: "Refund failure retried by this steward with the same refund child (requeue), never a new payment.",
    facts: "New card on the buyer garden's Promises tab, a different object from promises (a member's held payment). Amends DL-068's rail order: Review Promises, Member Deposits, Pool Status, Pool Funding (decision). Reads funding records where buyer garden = this garden.",
    tags: ["sel", "ui", "open"], dec: ["D3", "D12"]
  },
  stateNotes: {
    check: { say: "Each row says whose G$, for which promise in which garden, how much is expected and when it was sent.", sr: "Scope chips are toggle buttons with aria-pressed." },
    apply: { say: "Accepted requests waiting for the deposit to be applied.", sr: "None." },
    refunds: { say: "Failed refund is a state chip, not a banner; retry is the row's one act.", sr: "None." },
    empty: { say: "Quiet line, the card stays (DL-067 pattern).", sr: "None." },
    stale: { say: "Stale Celo reads disable checks.", sr: "Status row." }
  },
  render: function (st, ctx) {
    var D = GG.D, rows = "";
    var scopes = ["check", "apply", "refunds"].map(function (k, i) { var lbl = [t("s03.toCheck"), t("s03.toApply"), t("s03.refunds")][i]; var on = st === k || (k === "check" && (st === "empty" || st === "stale")); return '<span class="chipf' + (on ? " on" : "") + '" role="button" aria-pressed="' + on + '">' + lbl + "</span>"; }).join(" ");
    if (st === "check" || st === "stale") rows = GG.arow({ name: "Lina", chips: GG.sb("info", t("s03.c.check")), meta: t("s03.m.lina"), acts: GG.abtn(t("s03.check"), { go: "S04@exact", disabled: st === "stale" }) }) +
      GG.arow({ name: "Ama", chips: GG.sb("warn", t("s03.c.withdrawn")), meta: t("s03.m.ama"), acts: GG.abtn(t("s03.check"), { go: "S04@late", disabled: st === "stale" }) });
    if (st === "apply") rows = GG.arow({ name: "Lina", chips: GG.sb("ok", t("s03.c.accepted")), meta: t("s03.m.linaApply"), acts: GG.abtn(t("s03.apply"), { fill: true, go: "S05@ready" }) });
    if (st === "refunds") rows = GG.arow({ name: "Ama", chips: GG.sb("err", t("s03.c.failed")), meta: t("s03.m.amaFail"), acts: GG.abtn(t("s03.retry"), { go: "S06@refundfail" }) }) +
      GG.arow({ name: "João", chips: GG.sb("warn", t("s03.c.declined")), meta: t("s03.m.joao"), acts: GG.abtn(t("s03.queueRefund")) });
    var deposits = GG.acard({ title: t("s03.title"), sub: t("s03.sub"), top: '<div style="display:flex;gap:6px;flex-wrap:wrap">' + scopes + "</div>" + (st === "empty" ? '<p class="small" style="margin:0;color:var(--muted)">' + t("s03.empty") + "</p>" : "") + (st === "stale" ? GG.flowrow("", "refresh", t("s03.stale.b")) : ""), rows: rows });
    var review = GG.acard({ title: t("s.review"), sub: t("s.reviewSub"), body: '<p class="small" style="margin:0;color:var(--muted)">' + t("s.nothing") + "</p>" });
    var list = GG.acard({ title: t("s.offersReqs"), rows:
      GG.arow({ dir: "req", name: "Teach two compost workshops", chips: GG.sb("info", t("s.open")), meta: t("m16.d.req") }) +
      GG.arow({ dir: "offer", name: "Tool library: bike repair hour", chips: GG.sb("ok", t("s.open")) + GG.sb("neu", t("s.takesV")), meta: t("m16.d.bike") }) });
    var main = list, rail = review + deposits + GG.acard({ title: t("s.poolStatus"), body: '<p class="small" style="margin:0">' + t("s.poolOpen") + "</p>" });
    if (ctx && ctx.phone) { main = deposits + list; rail = review; }
    return GG.ckShell({ garden: D.home, av: "RC", title: t("s.gardenTitle"), tabs: [t("s.overview"), t("s.promisesTab"), t("s.work"), t("s.impact")], tab: 1, main: main, rail: rail });
  }
});

/* ---------------- S04 Check a member's deposit (steward attestation) ---------------- */
GG.T({
  "s04.title": ["Check Lina's Deposit", "Comprobar el depósito de Lina", "Conferir o depósito de Lina"],
  "s04.titleAma": ["Check Ama's Deposit", "Comprobar el depósito de Ama", "Conferir o depósito de Ama"],
  "s04.sub": ["You confirm her own G$ arrived in this garden's Safe. It isn't garden money, and nothing leaves the Safe now.", "Confirmas que llegaron sus propios G$ al Safe de este jardín. No es dinero del jardín y no sale nada del Safe ahora.", "Você confirma que os G$ dela chegaram ao Safe deste jardim. Não é dinheiro do jardim e nada sai do Safe agora."],
  "s04.target": ["Recording for Riverside Commons Garden · Safe 0xA77c…19F0 on Celo", "Registro para Riverside Commons Garden · Safe 0xA77c…19F0 en Celo", "Registro para o Riverside Commons Garden · Safe 0xA77c…19F0 na Celo"],
  "s04.member": ["Member", "Miembro", "Membro"],
  "s04.forPromise": ["For", "Para", "Para"],
  "s04.forV": ["AI assistant membership at Green Goods Community Garden", "AI assistant membership en Green Goods Community Garden", "AI assistant membership no Green Goods Community Garden"],
  "s04.expected": ["Expected to arrive", "Debe llegar", "Deve chegar"],
  "s04.refundAcct": ["Refunds go to", "Los reembolsos van a", "Os reembolsos vão para"],
  "s04.top": ["Extra G$", "G$ de más", "G$ a mais"],
  "s04.topNo": ["She didn't allow a top-up", "No permitió una recarga", "Ela não permitiu reforço"],
  "s04.celo": ["What Celo shows", "Lo que muestra Celo", "O que a Celo mostra"],
  "s04.found": ["Transfer of {g} from 0x3C1e…7A2e, {n} arrived after the token fee", "Transferencia de {g} desde 0x3C1e…7A2e; llegaron {n} tras la comisión del token", "Transferência de {g} de 0x3C1e…7A2e; chegaram {n} após a taxa do token"],
  "s04.readAt": ["Read Today, 10:58 AM · reference GG-7F3A · View on Celoscan", "Leído hoy, 10:58 · referencia GG-7F3A · Ver en Celoscan", "Lido hoje, 10:58 · referência GG-7F3A · Ver no Celoscan"],
  "s04.amount": ["Amount that arrived", "Importe que llegó", "Valor que chegou"],
  "s04.amountHint": ["Filled from the transfer above. Change it only if the Safe shows otherwise.", "Rellenado con la transferencia de arriba. Cámbialo solo si el Safe muestra otra cosa.", "Preenchido com a transferência acima. Mude só se o Safe mostrar outra coisa."],
  "s04.conseq": ["Recording lets Green Goods Community Garden approve her request. If she withdraws or is declined, this garden owes her the full recorded amount.", "Registrarlo permite que Green Goods Community Garden apruebe su solicitud. Si ella la retira o la rechazan, este jardín le debe el importe registrado completo.", "Registrar permite que o Green Goods Community Garden aprove a solicitação. Se ela retirar ou for recusada, este jardim deve a ela o valor registrado inteiro."],
  "s04.record": ["Record Deposit", "Registrar depósito", "Registrar depósito"],
  "s04.excess": ["{n} more than the price arrived. She didn't allow a top-up, so the extra goes back to her with the outcome.", "Llegaron {n} más que el precio. No permitió una recarga, así que lo que sobra vuelve a ella con el resultado.", "Chegaram {n} a mais que o preço. Ela não permitiu reforço, então o excedente volta para ela com o resultado."],
  "s04.short": ["440.00 G$ arrived, 10.00 G$ less than the price. The record can't take less than the price.", "Llegaron 440,00 G$, 10,00 G$ menos que el precio. El registro no admite menos que el precio.", "Chegaram 440,00 G$, 10,00 G$ a menos que o preço. O registro não aceita menos que o preço."],
  "s04.shortNext": ["Ask Lina to send the rest, or return what arrived. Returning happens from the Safe, outside the promise record.", "Pide a Lina que envíe lo que falta o devuelve lo que llegó. La devolución se hace desde el Safe, fuera del registro de la promesa.", "Peça a Lina para enviar o restante ou devolva o que chegou. A devolução é feita pelo Safe, fora do registro da promessa."],
  "s04.ask": ["Ask Lina for the Rest", "Pedir a Lina lo que falta", "Pedir o restante a Lina"],
  "s04.returnSafe": ["Return from the Safe…", "Devolver desde el Safe…", "Devolver pelo Safe…"],
  "s04.nf": ["No matching transfer on Celo yet. It may still be on its way; this doesn't mean it failed.", "Aún no hay una transferencia que coincida en Celo. Puede estar en camino; no significa que haya fallado.", "Ainda não há transferência correspondente na Celo. Pode estar a caminho; isso não quer dizer que falhou."],
  "s04.refresh": ["Refresh", "Actualizar", "Atualizar"],
  "s04.stale": ["Celo data is 2 hours old. Refresh before recording.", "Los datos de Celo tienen 2 horas. Actualiza antes de registrar.", "Os dados da Celo têm 2 horas. Atualize antes de registrar."],
  "s04.late": ["Ama withdrew before this arrived. Record it so the full amount is owed back to her, then queue the refund.", "Ama retiró la solicitud antes de que esto llegara. Regístralo para que se le deba el importe completo y pon el reembolso en cola.", "Ama retirou antes de isto chegar. Registre para que o valor inteiro seja devido a ela e enfileire o reembolso."],
  "s04.twoPrompts": ["Your wallet asks twice: once to record, once to queue the refund.", "Tu billetera te pide dos firmas: una para registrar y otra para poner el reembolso en cola.", "Sua carteira pede duas assinaturas: uma para registrar e outra para enfileirar o reembolso."],
  "s04.recordRefund": ["Record and Queue Refund", "Registrar y poner reembolso en cola", "Registrar e enfileirar reembolso"],
  "s04.sending": ["Recording… waiting for your wallet", "Registrando… esperando a tu billetera", "Registrando… aguardando sua carteira"],
  "s04.done": ["Recorded 450.00 G$ for Lina's request.", "Registrados 450,00 G$ para la solicitud de Lina.", "Registrados 450,00 G$ para a solicitação de Lina."],
  "s04.ready": ["Ready to record.", "Listo para registrar.", "Pronto para registrar."],
  "s05.ready": ["Ready to apply.", "Listo para aplicar.", "Pronto para aplicar."]
});
GG.SCR("S04", {
  surface: "steward", journey: "gd", title: "Check a member's deposit (attestation)", prd: "PRD-1297",
  states: [["exact", "Exact amount found", "default"], ["excess", "More than the price", "default"], ["short", "Underpaid", "blocked"], ["notfound", "No transfer found yet", "delayed"], ["stale", "Celo data stale", "stale"], ["late", "Arrived after withdrawal", "recovery"], ["sending", "Waiting for wallet", "pending"], ["recorded", "Recorded", "success"]],
  notes: {
    who: "Buyer-garden settlement steward, wallet on Arbitrum. The attestation is theirs; the chain read is a helper, not proof the module checks.",
    pre: "Pledge exists for this buyer garden; a matching Celo transfer into the registered Safe. Evidence: Celo transfer log read (time-stamped) and the pledge's expected amount and refund account.",
    auth: "Records the net amount that arrived against this member's pledge (DepositRecorded).",
    out: "Status row through ready, sending and done; the row moves to To Apply after acceptance.",
    rec: "Underpaid: can't record below price; ask for the rest or return from the Safe (off-record, Safe signers). Not found: refresh; never implies failure. Late: record then queue the full refund.",
    facts: "Deposit verification is a steward attestation, not automatic cryptographic cross-chain verification. Upgraded SettlementModule records a buyer-garden deposit for a claim in another garden's pool (existing recordFundingDeposit requires amount ≥ expected; excess is recorded). Top-up consent comes from the member's pledge.",
    tags: ["req", "sel", "open"], dec: ["D3", "D4"]
  },
  stateNotes: {
    exact: { say: "Celo read and attestation side by side; the read's time is visible.", sr: "Dialog; status row \"Ready\"." },
    excess: { say: "Extra handled per the member's choice; no silent top-up.", sr: "Note read under the amount field." },
    short: { say: "Record disabled; two honest next steps, one flagged as outside the record.", sr: "Error text tied to the amount field." },
    notfound: { say: "Absence is a wait, not a failure.", sr: "Status." },
    stale: { say: "Stale reads disable recording.", sr: "Status." },
    late: { say: "Record-and-refund as one guided act with two prompts declared.", sr: "Status." },
    sending: { say: "Close blocked.", sr: "Status row." },
    recorded: { say: "Quiet done.", sr: "Status row." }
  },
  render: function (st, ctx) {
    var D = GG.D, ama = st === "late";
    var arrived = st === "short" ? 440 : st === "excess" ? 452.26 : 450, gross = st === "excess" ? 454.53 : st === "short" ? 442.21 : 452.26;
    var celo = st === "notfound" ? GG.flowrow("info", "clock", t("s04.nf")) : st === "stale" ? GG.flowrow("err", "refresh", t("s04.stale")) :
      '<div class="flowrow' + (st === "short" ? " err" : "") + '">' + ic(st === "short" ? "alert" : "check", 16) + "<span>" + t("s04.found", { g: GG.gd(gross), n: GG.gd(arrived) }) + '<br><span class="tstamp">' + t("s04.readAt") + "</span></span></div>";
    var flow = st === "sending" ? GG.flowrow("info", "spin", t("s04.sending")) : st === "recorded" ? GG.flowrow("ok", "check", t("s04.done")) : GG.flowrow("", "info", t("s04.ready"));
    var hint = st === "short" ? '<span class="hl err">' + t("s04.short") + "</span>" : st === "excess" ? '<span class="hl">' + t("s04.excess", { n: GG.gd(2.26) }) + "</span>" : '<span class="hl">' + t("s04.amountHint") + "</span>";
    var body = GG.target(t("s04.target")) + flow + GG.afacts([[t("s04.member"), ama ? "Ama" : "Lina"], [t("s04.forPromise"), ama ? "Website check-up, 1 hour" : t("s04.forV")], [t("s04.expected"), GG.gd(450)], [t("s04.refundAcct"), ama ? "0x51d0…c2A9" : D.meAddr, "Celo"], [t("s04.top"), t("s04.topNo")]]) +
      '<div class="dsec"><h3>' + t("s04.celo") + "</h3>" + celo + "</div>" +
      '<div class="fieldA"><label>' + t("s04.amount") + '</label><div class="inp' + (st === "notfound" || st === "stale" ? " dis" : "") + '"><span>' + (st === "notfound" || st === "stale" ? "-" : GG.num(arrived, 2)) + "</span><span>G$</span></div>" + hint + "</div>" +
      (st === "short" ? '<p style="margin:0">' + t("s04.shortNext") + "</p>" : st === "late" ? GG.flowrow("info", "info", t("s04.late")) : '<p style="margin:0">' + t("s04.conseq") + "</p>");
    var foot = st === "recorded" ? GG.abtn(t("c.done"), { fill: true, go: "S03@check" }) :
      st === "short" ? GG.abtn(t("s04.returnSafe")) + GG.abtn(t("s04.ask"), { fill: true }) :
      st === "notfound" || st === "stale" ? GG.abtn(t("c.cancel")) + GG.abtn(t("s04.refresh"), { go: "@exact" }) + GG.abtn(t("s04.record"), { fill: true, disabled: true }) :
      st === "late" ? GG.abtn(t("c.cancel")) + GG.abtn(t("s04.recordRefund"), { fill: true, go: "S06@refund" }) :
      GG.abtn(t("c.cancel"), { disabled: st === "sending" }) + GG.abtn(t("s04.record"), { fill: true, go: "@recorded", disabled: st === "sending" });
    return GG.screens.S03.render("check", ctx) + GG.adlg({ title: ama ? t("s04.titleAma") : t("s04.title"), sub: t("s04.sub"), body: body, foot: foot, note: st === "late" ? t("s04.twoPrompts") : "" });
  }
});

/* ---------------- S05 Apply a recorded deposit to the accepted promise ---------------- */
GG.T({
  "s05.title": ["Apply Lina's Deposit", "Aplicar el depósito de Lina", "Aplicar o depósito de Lina"],
  "s05.sub": ["Ties 450.00 G$ to her accepted promise at Green Goods Community Garden.", "Vincula 450,00 G$ a su promesa aceptada en Green Goods Community Garden.", "Vincula 450,00 G$ à promessa aceita dela no Green Goods Community Garden."],
  "s05.cAcc": ["Green Goods Community Garden accepted Lina's request", "Green Goods Community Garden aceptó la solicitud de Lina", "O Green Goods Community Garden aceitou a solicitação de Lina"],
  "s05.cAccS": ["Today, 2:05 PM · she is the promise's counterparty", "Hoy, 14:05 · ella es la contraparte de la promesa", "Hoje, 14:05 · ela é a contraparte da promessa"],
  "s05.cRec": ["450.00 G$ recorded by Tomás", "450,00 G$ registrados por Tomás", "450,00 G$ registrados por Tomás"],
  "s05.conseq": ["From now on, this 450.00 G$ either pays the promise's team when it's kept, or goes back to Lina if the promise is canceled or expires. Never both. A kept promise is never refunded.", "A partir de ahora, estos 450,00 G$ pagan al equipo de la promesa cuando se cumpla, o vuelven a Lina si la promesa se cancela o vence. Nunca las dos cosas. Una promesa cumplida nunca se reembolsa.", "A partir de agora, estes 450,00 G$ pagam a equipe da promessa quando for cumprida, ou voltam para Lina se a promessa for cancelada ou vencer. Nunca os dois. Promessa cumprida nunca é reembolsada."],
  "s05.apply": ["Apply Deposit", "Aplicar depósito", "Aplicar depósito"],
  "s05.notAcc": ["Not accepted yet", "Aún no aceptada", "Ainda não aceita"],
  "s05.notAccS": ["Apply becomes available once Green Goods Community Garden accepts Lina.", "Aplicar estará disponible cuando Green Goods Community Garden acepte a Lina.", "Aplicar fica disponível quando o Green Goods Community Garden aceitar Lina."],
  "s05.done": ["Applied. Lina's promise is funded.", "Aplicado. La promesa de Lina tiene fondos.", "Aplicado. A promessa de Lina tem fundos."]
});
GG.SCR("S05", {
  surface: "steward", journey: "gd", title: "Apply a deposit (funding consumption)", prd: "PRD-1297",
  states: [["ready", "Accepted and recorded", "default"], ["blocked", "Not accepted yet", "blocked"], ["done", "Applied", "success"]],
  notes: {
    who: "Buyer-garden settlement steward, wallet on Arbitrum.",
    pre: "Promise accepted with counterparty = the funder; deposit recorded. Evidence: pooling read and the funding record.",
    auth: "Consumption: binds the recorded deposit to this promise's single outcome.",
    out: "Funded; the member's page moves from \"Accepted, not yet applied\" to \"Access being set up\".",
    rec: "Blocked until accepted; nothing else to retry.",
    facts: "consumeFunding (DepositRecorded → Consumed) with the write-once consumed pointer; the upgrade makes payout and refund exclusive outcomes. Whether consumption is a separate steward act or automatic at guarded acceptance is to confirm against the reconciliation handoff.",
    tags: ["sel", "open"], dec: ["D1"]
  },
  stateNotes: {
    ready: { say: "Consequence states the exclusive outcome.", sr: "Dialog." },
    blocked: { say: "Explains when it becomes available.", sr: "Failed check read first." },
    done: { say: "Quiet done.", sr: "Status row." }
  },
  render: function (st, ctx) {
    var body = GG.flowrow(st === "done" ? "ok" : "", st === "done" ? "check" : "info", st === "done" ? t("s05.done") : t("s05.ready")) +
      '<div class="checks">' + (st === "blocked" ? GG.checkrow("no", t("s05.notAcc"), t("s05.notAccS")) : GG.checkrow("ok", t("s05.cAcc"), t("s05.cAccS"))) + GG.checkrow("ok", t("s05.cRec"), t("s02.cDepS")) + "</div>" +
      '<p style="margin:0">' + t("s05.conseq") + "</p>";
    var foot = st === "done" ? GG.abtn(t("c.done"), { fill: true, go: "S06@applied" }) : GG.abtn(t("c.cancel")) + GG.abtn(t("s05.apply"), { fill: true, go: "@done", disabled: st === "blocked" });
    return GG.screens.S03.render("apply", ctx) + GG.adlg({ title: t("s05.title"), sub: t("s05.sub"), body: GG.target(t("s04.target")) + body, foot: foot, note: st === "done" ? "" : t("s02.walletOnce"), alert: true });
  }
});

/* ---------------- S06 Purchase in the commitment inspector (payment, payout, refund, access) ---------------- */
GG.T({
  "s06.title": ["AI assistant membership, 1 month", "AI assistant membership, 1 month", "AI assistant membership, 1 month"],
  "s06.sub": ["Offer at Green Goods Community Garden · taken up by Lina", "Oferta en Green Goods Community Garden · aceptada por Lina", "Oferta no Green Goods Community Garden · aceita por Lina"],
  "s06.secPay": ["Payment", "Pago", "Pagamento"],
  "s06.payer": ["Paid by", "Pagado por", "Pago por"],
  "s06.payerV": ["Lina, with her own G$", "Lina, con sus propios G$", "Lina, com seus próprios G$"],
  "s06.heldBy": ["Held by", "Lo guarda", "Guardado por"],
  "s06.heldByV": ["Riverside Commons Garden · Safe 0xA77c…19F0", "Riverside Commons Garden · Safe 0xA77c…19F0", "Riverside Commons Garden · Safe 0xA77c…19F0"],
  "s06.recorded": ["Recorded", "Registrado", "Registrado"],
  "s06.recordedV": ["450.00 G$ by Tomás, Oct 22 (steward check)", "450,00 G$ por Tomás, 22 oct (comprobación de responsable)", "450,00 G$ por Tomás, 22 out (conferência de responsável)"],
  "s06.applied": ["Applied", "Aplicado", "Aplicado"],
  "s06.appliedV": ["Oct 22, 2:20 PM", "22 oct, 14:20", "22 out, 14:20"],
  "s06.outcome": ["Outcome", "Resultado", "Resultado"],
  "s06.outPay": ["Payout, after the promise is kept", "Pago, cuando se cumpla la promesa", "Pagamento, depois que a promessa for cumprida"],
  "s06.outRefund": ["Refund of the full 450.00 G$", "Reembolso de los 450,00 G$ completos", "Reembolso dos 450,00 G$ inteiros"],
  "s06.secPayout": ["Payout Plan", "Plan de pagos", "Plano de pagamento"],
  "s06.payoutNote": ["Paid to the people who kept the promise, split by recognition. The provider garden's Safe doesn't receive it as one sum.", "Se paga a las personas que cumplieron la promesa, repartido según el reconocimiento. El Safe del jardín proveedor no lo recibe como una suma única.", "É pago às pessoas que cumpriram a promessa, dividido pelo reconhecimento. O Safe do jardim prestador não recebe como uma soma única."],
  "s06.step.create": ["Create payout plan", "Crear plan de pagos", "Criar plano de pagamento"],
  "s06.step.split": ["Contributor split (default from recognition)", "Reparto entre colaboradores (por defecto según reconocimiento)", "Divisão entre colaboradores (padrão pelo reconhecimento)"],
  "s06.splitEx": ["Joy 50% · Kwesi 30% · Ana 20% (sample people)", "Joy 50 % · Kwesi 30 % · Ana 20 % (personas de ejemplo)", "Joy 50% · Kwesi 30% · Ana 20% (pessoas de exemplo)"],
  "s06.step.final": ["Finalize payout plan", "Finalizar plan de pagos", "Finalizar plano de pagamento"],
  "s06.step.dispatch": ["Dispatch to Celo", "Enviar a Celo", "Enviar para a Celo"],
  "s06.step.ack": ["Celo acknowledgment", "Confirmación de Celo", "Confirmação da Celo"],
  "s06.waitKept": ["Waiting for Lina to confirm kept", "Esperando que Lina confirme que se cumplió", "Aguardando Lina confirmar que foi cumprida"],
  "s06.secRefund": ["Refund", "Reembolso", "Reembolso"],
  "s06.refundTo": ["To 0x3C1e…7A2e on Celo · full recorded amount", "A 0x3C1e…7A2e en Celo · importe registrado completo", "Para 0x3C1e…7A2e na Celo · valor registrado inteiro"],
  "s06.att1": ["Attempt 1 failed on Celo · Today, 3:10 PM · executor reported: transfer reverted", "Falló el intento 1 en Celo · hoy, 15:10 · el ejecutor informó: transferencia revertida", "Tentativa 1 falhou na Celo · hoje, 15:10 · o executor informou: transferência revertida"],
  "s06.retry": ["Requeue Same Refund", "Volver a poner el mismo reembolso en cola", "Enfileirar o mesmo reembolso de novo"],
  "s06.retryNote": ["Requeues this refund. It can't create a second one or change the amount.", "Vuelve a poner este reembolso en cola. No puede crear otro ni cambiar el importe.", "Enfileira este reembolso de novo. Não pode criar outro nem mudar o valor."],
  "s06.queued": ["Refund queued · ready to dispatch", "Reembolso en cola · listo para enviar", "Reembolso na fila · pronto para enviar"],
  "s06.secAccess": ["Access (outside Green Goods)", "Acceso (fuera de Green Goods)", "Acesso (fora do Green Goods)"],
  "s06.accessNot": ["Not active", "No activo", "Não ativo"],
  "s06.accessOn": ["Active since Oct 24", "Activo desde el 24 oct", "Ativo desde 24 out"],
  "s06.accessNote": ["Green Goods' membership system reports this. Payment alone never marks access active.", "Lo informa el sistema de membresías de Green Goods. El pago por sí solo nunca marca el acceso como activo.", "O sistema de assinaturas do Green Goods informa isso. O pagamento sozinho nunca marca o acesso como ativo."],
  "s06.markActive": ["Record Access Active…", "Registrar acceso activo…", "Registrar acesso ativo…"],
  "s06.close": ["Close", "Cerrar", "Fechar"]
});
GG.SCR("S06", {
  surface: "steward", journey: "gd", title: "Purchase in the commitment inspector", prd: "PRD-1297 (inspector shared with PRD-1323)",
  states: [["applied", "Funded, waiting for kept", "pending"], ["payout", "Kept, payout plan in progress", "pending"], ["refund", "Refund queued", "recovery"], ["refundfail", "Refund failed: requeue", "failure"], ["provider", "Provider view: record access", "default"]],
  notes: {
    who: "Buyer-garden settlement steward (payment, payout, refund). Provider steward (access status, read-only payment).",
    pre: "Funding record, payout plan and children, refund child and its attempts, provider access report.",
    auth: "Existing payout plan acts; requeue of the same refund child; provider records access status (proposal).",
    out: "Payment, payout, refund and access each have their own section and state. Payout and refund are exclusive.",
    rec: "Refund failure: requeue the same child (buyer-garden steward). Payout failure: the existing payout recovery.",
    facts: "Existing SettlementModule payout plan (ContributorConsideration by recognition) is preserved. Refund child kind Refund cannot be canceled, only requeued. Access status is a separate integration record; how it is reported (manual record or integration callback) is open.",
    tags: ["req", "sel", "ui", "open"], dec: ["D13"]
  },
  stateNotes: {
    applied: { say: "Outcome stated as payout or refund, never both.", sr: "Dialog heading and section headings." },
    payout: { say: "Existing step labels reused; payout to contributors by recognition.", sr: "None." },
    refund: { say: "Refund replaces payout entirely.", sr: "None." },
    refundfail: { say: "Attempt history kept; requeue states it can't duplicate or change the amount.", sr: "Error row (status)." },
    provider: { say: "Provider sees payment facts read-only and owns the access record.", sr: "None." }
  },
  render: function (st, ctx) {
    var refund = st === "refund" || st === "refundfail";
    var pay = '<div class="dsec"><h3>' + t("s06.secPay") + "</h3>" + GG.afacts([[t("s06.payer"), t("s06.payerV")], [t("s06.heldBy"), t("s06.heldByV")], [t("s06.recorded"), t("s06.recordedV")], [t("s06.applied"), refund ? "-" : t("s06.appliedV")], [t("s06.outcome"), refund ? t("s06.outRefund") : t("s06.outPay")]]) + "</div>";
    var payout = refund ? "" : '<div class="dsec"><h3>' + t("s06.secPayout") + '</h3><p class="small" style="margin:0;color:var(--muted)">' + t("s06.payoutNote") + '</p><div class="checks">' +
      (st === "payout" ? GG.checkrow("ok", t("s06.step.create")) + GG.checkrow("ok", t("s06.step.split"), t("s06.splitEx")) + GG.checkrow("ok", t("s06.step.final")) + GG.checkrow("ok", t("s06.step.dispatch")) + GG.checkrow("wait", t("s06.step.ack")) :
        GG.checkrow("wait", t("s06.waitKept"))) + "</div></div>";
    var ref = refund ? '<div class="dsec"><h3>' + t("s06.secRefund") + "</h3>" + GG.afacts([[GG.gd(450), t("s06.refundTo")]]) +
      (st === "refundfail" ? GG.flowrow("err", "xcirc", t("s06.att1")) + '<p class="small" style="margin:0;color:var(--muted)">' + t("s06.retryNote") + "</p>" : GG.flowrow("info", "clock", t("s06.queued"))) + "</div>" : "";
    var access = '<div class="dsec"><h3>' + t("s06.secAccess") + '</h3><div style="display:flex;gap:8px;align-items:center;justify-content:space-between"><span>AI assistant</span>' + GG.sb(st === "payout" ? "ok" : "neu", st === "payout" ? t("s06.accessOn") : t("s06.accessNot")) + '</div><p class="small" style="margin:0;color:var(--muted)">' + t("s06.accessNote") + "</p></div>";
    var foot = st === "refundfail" ? GG.abtn(t("s06.close")) + GG.abtn(t("s06.retry"), { fill: true, go: "@refund" }) : st === "provider" ? GG.abtn(t("s06.close")) + GG.abtn(t("s06.markActive"), { fill: true }) : GG.abtn(t("s06.close"), { fill: true });
    var gardenCtx = st === "provider" ? "S01" : "S03";
    return GG.screens[gardenCtx].render(gardenCtx === "S01" ? "default" : "refunds", ctx) + GG.adlg({ lg: true, title: t("s06.title"), sub: t("s06.sub"), body: pay + payout + ref + access, foot: foot });
  }
});
