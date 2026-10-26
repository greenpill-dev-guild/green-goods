/* Steward cockpit: voucher setup approval, guarded acceptance, the final split proposal, transfer
   recovery, linked rewards, and the proposed issuer admission surfaces. Issuer admission, caps and
   suspension are drawn as policy records: the contracts don't enforce them yet (PRD-1315). */
GG.T({
  "s07.row": ["Solar basics course · 100 Sunroot vouchers · asked Today, 11:02 AM", "Solar basics course · 100 vales de Sunroot · pidió hoy, 11:02", "Solar basics course · 100 vales de Sunroot · pediu hoje, 11:02"],
  "s07.rowReady": ["Solar basics course · 100 Sunroot vouchers in escrow · accept by Oct 25, 5:00 PM", "Solar basics course · 100 vales de Sunroot en depósito de garantía · aceptar antes del 25 oct, 17:00", "Solar basics course · 100 vales de Sunroot em depósito em garantia · aceitar até 25 out, 17:00"],
  "s07.chipSetup": ["Setup to approve", "Preparación por aprobar", "Preparação para aprovar"],
  "s07.chipEscrow": ["Escrow ready", "Depósito listo", "Depósito pronto"],
  "s07.approveSetup": ["Approve Setup…", "Aprobar preparación…", "Aprovar preparação…"],
  "s07.title": ["Approve Lina's Voucher Setup?", "¿Aprobar la preparación de vales de Lina?", "Aprovar a preparação de vales de Lina?"],
  "s07.sub": ["Lets her deposit vouchers into escrow for this promise. It doesn't accept her request.", "Le permite depositar vales en garantía para esta promesa. No acepta su solicitud.", "Permite que ela deposite vales em garantia para esta promessa. Não aceita a solicitação."],
  "s07.target": ["Signing as Sunroot Skills Hub's Safe on Gnosis · 2 of 3 signers", "Firma como el Safe de Sunroot Skills Hub en Gnosis · 2 de 3 firmantes", "Assina como o Safe da Sunroot Skills Hub na Gnosis · 2 de 3 signatários"],
  "s07.holder": ["Holder", "Titular", "Titular"],
  "s07.holderV": ["Lina · Green Goods account 0x3C1e…7A2e", "Lina · cuenta de Green Goods 0x3C1e…7A2e", "Lina · conta do Green Goods 0x3C1e…7A2e"],
  "s07.holderS": ["Deposits from Gnosis wallet 0x9A40…41bD", "Deposita desde la billetera de Gnosis 0x9A40…41bD", "Deposita da carteira da Gnosis 0x9A40…41bD"],
  "s07.escrow": ["Escrow", "Depósito de garantía", "Depósito em garantia"],
  "s07.cCons": ["Lina agreed to version 2, the current terms", "Lina aceptó la versión 2, las condiciones actuales", "Lina aceitou a versão 2, as condições atuais"],
  "s07.cCap": ["Outstanding Sunroot vouchers: 1,240 of a 2,000 cap", "Vales de Sunroot en circulación: 1.240 de un límite de 2.000", "Vales da Sunroot em circulação: 1.240 de um limite de 2.000"],
  "s07.cCapS": ["Published policy, monitored. The contracts don't enforce this cap yet.", "Política publicada y vigilada. Los contratos todavía no aplican este límite.", "Política publicada e monitorada. Os contratos ainda não aplicam este limite."],
  "s07.conseq": ["Approving lets Lina deposit 100 vouchers into escrow for this promise. Accepting her request is a separate decision once the escrow is ready.", "Aprobar permite que Lina deposite 100 vales en garantía para esta promesa. Aceptar su solicitud es otra decisión, cuando el depósito esté listo.", "Aprovar permite que Lina deposite 100 vales em garantia para esta promessa. Aceitar a solicitação é outra decisão, quando o depósito estiver pronto."],
  "s07.approve": ["Approve Setup", "Aprobar preparación", "Aprovar preparação"],
  "s07.partial": ["1 of 2 signatures · waiting for another Sunroot signer", "1 de 2 firmas · esperando a otro firmante de Sunroot", "1 de 2 assinaturas · aguardando outro signatário da Sunroot"],
  "s07.done": ["Setup approved. Lina can deposit now.", "Preparación aprobada. Lina ya puede depositar.", "Preparação aprovada. Lina já pode depositar."],
  "s07.ready": ["Ready. The Safe needs 2 signatures.", "Lista. El Safe necesita 2 firmas.", "Pronta. O Safe precisa de 2 assinaturas."]
});
GG.ckRowsSunroot = function (mode) {
  return mode === "setup" ? GG.arow({ name: "Lina", chips: GG.sb("info", t("s07.chipSetup")), meta: t("s07.row"), acts: GG.abtn(t("s07.approveSetup"), { go: "S07@ready" }) }) :
    GG.arow({ name: "Lina", chips: GG.sb("ok", t("s07.chipEscrow")), meta: t("s07.rowReady"), acts: GG.abtn(t("s.decline")) + GG.abtn(t("s.approve"), { fill: true, go: "S08@ready" }) });
};
GG.ckSunroot = function (mode, ctx) {
  var review = GG.acard({ title: t("s.review"), sub: t("s.reviewSub"), rows: GG.ckRowsSunroot(mode) });
  var list = GG.acard({ title: t("s.offersReqs"), rows: GG.arow({ dir: "offer", name: "Solar basics course, 10 lessons", chips: GG.sb("ok", t("s.open")) + GG.sb("neu", t("s.takesV")), meta: t("m02.d.solar") }) +
    GG.arow({ dir: "offer", name: "Battery safety workshop", chips: GG.sb("ok", t("s.open")) + GG.sb("neu", t("s.takesV")), meta: t("m02.d.battery") }) });
  var main = list, rail = review + GG.acard({ title: t("s.poolStatus"), body: '<p class="small" style="margin:0">' + t("s.poolOpen") + "</p>" });
  if (ctx && ctx.phone) { main = review + list; rail = ""; }
  return GG.ckShell({ garden: GG.D.sunroot, av: "SS", title: t("s.gardenTitle"), tabs: [t("s.overview"), t("s.promisesTab"), t("s.work"), t("s.impact")], tab: 1, main: main, rail: rail });
};

/* ---------------- S07 Issuer approves a voucher setup ---------------- */
GG.SCR("S07", {
  surface: "steward", journey: "vs", title: "Issuer approves a voucher setup", entry: true, prd: "PRD-1297",
  states: [["ready", "Ready", "default"], ["partial", "1 of 2 Safe signatures", "pending"], ["done", "Approved", "success"]],
  notes: {
    who: "Issuer authority: Sunroot Skills Hub stewards signing as the issuer Safe on Gnosis (multisig).",
    pre: "Setup prepared on Arbitrum for this promise, presenter, token and amount; consent current. Evidence: setup record and consent record.",
    auth: "Permission for the escrow to take this holder's exact deposit for this promise.",
    out: "Multisig progress shown as signatures collected; done lets the holder deposit.",
    rec: "Missing signer: the setup waits; the holder can cancel the setup meanwhile.",
    facts: "Issuer approval recorded on Gnosis (GnosisVoucherAdapter or GnosisVoucherEscrow, per the reconciled design). Issuer cap shown as monitored policy until PRD-1315 chooses enforcement.",
    tags: ["req", "sel", "dep"], dec: ["D8", "D12"]
  },
  stateNotes: {
    ready: { say: "Approval is explicitly not acceptance.", sr: "Dialog." },
    partial: { say: "Multisig progress in the status row.", sr: "Status row (polite)." },
    done: { say: "Quiet done.", sr: "Status row (polite)." }
  },
  render: function (st, ctx) {
    var flow = st === "partial" ? GG.flowrow("info", "clock", t("s07.partial")) : st === "done" ? GG.flowrow("ok", "check", t("s07.done")) : GG.flowrow("", "info", t("s07.ready"));
    var body = GG.target(t("s07.target")) + flow + GG.afacts([[t("s02.promise"), "Solar basics course, 10 lessons"], [t("s07.holder"), t("s07.holderV"), t("s07.holderS")], [t("m07.takes"), GG.vN(100)], [t("s07.escrow"), t("m09.escrowV"), "0xE5c0…a1F2"], [t("m03.terms"), t("c.version", { n: 2 })]]) +
      '<div class="dsec"><h3>' + t("s02.checks") + '</h3><div class="checks">' + GG.checkrow("ok", t("s07.cCons"), t("s02.cTermsS")) + GG.checkrow("pol", t("s07.cCap"), t("s07.cCapS")) + "</div></div>" + '<p style="margin:0">' + t("s07.conseq") + "</p>";
    var foot = st === "done" ? GG.abtn(t("c.done"), { fill: true }) : GG.abtn(t("c.cancel")) + GG.abtn(t("s07.approve"), { fill: true, go: st === "ready" ? "@partial" : "@done", disabled: false });
    return GG.ckSunroot("setup", ctx) + GG.adlg({ title: t("s07.title"), sub: t("s07.sub"), body: body, foot: foot });
  }
});

/* ---------------- S08 Accept a voucher request (guarded acceptance) ---------------- */
GG.T({
  "s08.title": ["Accept Lina's Voucher Request?", "¿Aceptar la solicitud con vales de Lina?", "Aceitar a solicitação com vales de Lina?"],
  "s08.target": ["Writing to Sunroot Skills Hub's pool", "Escribe en el fondo común de Sunroot Skills Hub", "Grava no fundo comum da Sunroot Skills Hub"],
  "s08.cProof": ["Escrow proof received from Gnosis", "Prueba del depósito recibida desde Gnosis", "Prova do depósito recebida da Gnosis"],
  "s08.cProofS": ["100 Sunroot vouchers held for this promise · received Today, 11:24 AM", "100 vales de Sunroot guardados para esta promesa · recibida hoy, 11:24", "100 vales da Sunroot guardados para esta promessa · recebida hoje, 11:24"],
  "s08.cWindow": ["Acceptance window open until Oct 25, 5:00 PM", "Plazo de aceptación abierto hasta el 25 oct, 17:00", "Prazo de aceite aberto até 25 out, 17:00"],
  "s08.noProof": ["Escrow proof not received yet", "Aún no se recibió la prueba del depósito", "A prova do depósito ainda não chegou"],
  "s08.noProofS": ["Sent from Gnosis at 11:21 AM; Green Goods hasn't received it. A sent message isn't proof.", "Se envió desde Gnosis a las 11:21; Green Goods no la ha recibido. Un mensaje enviado no es una prueba.", "Enviada da Gnosis às 11:21; o Green Goods não recebeu. Mensagem enviada não é prova."],
  "s08.stale": ["Lina agreed to version 2; the offer is now version 3", "Lina aceptó la versión 2; el ofrecimiento ya es la versión 3", "Lina aceitou a versão 2; a oferta agora é a versão 3"],
  "s08.race": ["Lina asked to cancel at 4:57 PM", "Lina pidió cancelar a las 16:57", "Lina pediu para cancelar às 16:57"],
  "s08.raceS": ["If your approval lands first, the promise starts; if her cancellation does, her vouchers go back. Only one counts.", "Si tu aprobación llega primero, la promesa empieza; si llega antes su cancelación, sus vales vuelven. Solo cuenta una.", "Se sua aprovação chegar primeiro, a promessa começa; se o cancelamento chegar antes, os vales voltam. Só um vale."],
  "s08.cut": ["The acceptance window closed Oct 25, 5:00 PM", "El plazo de aceptación cerró el 25 oct, 17:00", "O prazo de aceite fechou em 25 out, 17:00"],
  "s08.cutS": ["Accepting now isn't allowed. Lina can cancel and get her vouchers back.", "Ya no se puede aceptar. Lina puede cancelar y recuperar sus vales.", "Não é mais possível aceitar. Lina pode cancelar e receber os vales de volta."],
  "s08.conseq": ["Accepting starts the promise, on Gnosis too. Lina can't cancel setup after this; missed lessons go through your remedy and the final split.", "Aceptar inicia la promesa, también en Gnosis. Después, Lina ya no puede cancelar la preparación; las clases no dadas pasan por tu solución y el reparto final.", "Aceitar inicia a promessa, também na Gnosis. Depois disso, Lina não pode mais cancelar a preparação; aulas não dadas passam pela sua solução e pela divisão final."],
  "s08.accept": ["Accept Request", "Aceptar solicitud", "Aceitar solicitação"],
  "s08.sending": ["Accepting… waiting for your wallet", "Aceptando… esperando a tu billetera", "Aceitando… aguardando sua carteira"],
  "s08.done": ["Accepted. Starting the promise on Gnosis; confirmed once Gnosis replies.", "Aceptada. Iniciando la promesa en Gnosis; se confirma cuando Gnosis responda.", "Aceita. Iniciando a promessa na Gnosis; confirmada quando a Gnosis responder."]
});
GG.SCR("S08", {
  surface: "steward", journey: "vs", title: "Accept a voucher request (guarded)", prd: "PRD-1297",
  states: [["ready", "All checks pass", "default"], ["noproof", "Escrow proof not received", "blocked"], ["stale", "Consent on old terms", "stale"], ["race", "Holder cancellation pending", "pending"], ["cutoff", "Window closed", "blocked"], ["sending", "Waiting for wallet", "pending"], ["done", "Accepted, activation pending", "success"]],
  notes: {
    who: "Provider steward (Sunroot Skills Hub pool operator), wallet on Arbitrum.",
    pre: "Exact consent to the current revision; authenticated escrow evidence received on Arbitrum; inside the acceptance window. Evidence: consent record, escrow receipt (authenticated message), window from the setup record.",
    auth: "Acceptance of one voucher-backed claim.",
    out: "Accepted; destination activation pending until Gnosis confirms. Acceptance and setup abort resolve to one outcome.",
    rec: "No proof: wait (no manual override). Stale consent: holder re-consents. Race: the outcome is shown when known. Closed window: holder cancels.",
    facts: "Upgraded CommitmentPooling voucher acceptance guard: acceptance reverts without exact consent and escrow readiness, on every acceptance path (claimCommitment and acceptClaim). Activation message to GnosisVoucherEscrow; a setup-refunded escrow can't activate, an activated escrow can't receive a setup refund.",
    tags: ["req", "sel"], dec: ["D5"]
  },
  stateNotes: {
    ready: { say: "Each check names its evidence.", sr: "Alert dialog; check list." },
    noproof: { say: "\"Sent\" is not accepted as evidence.", sr: "Failed check read first." },
    stale: { say: "Guard rule shown.", sr: "Failed check read first." },
    race: { say: "Accept remains possible; the race is explained.", sr: "Pending check read." },
    cutoff: { say: "Disabled; holder path named.", sr: "Failed check read first." },
    sending: { say: "Close blocked.", sr: "Status row." },
    done: { say: "Accepted is not activated: the status row says activation follows.", sr: "Status row (polite)." }
  },
  render: function (st, ctx) {
    var blocked = st === "noproof" || st === "stale" || st === "cutoff";
    var c1 = st === "stale" ? GG.checkrow("no", t("s08.stale"), t("s02.staleS")) : GG.checkrow("ok", t("s07.cCons"), t("s02.cTermsS"));
    var c2 = st === "noproof" ? GG.checkrow("no", t("s08.noProof"), t("s08.noProofS")) : GG.checkrow("ok", t("s08.cProof"), t("s08.cProofS"));
    var c3 = st === "cutoff" ? GG.checkrow("no", t("s08.cut"), t("s08.cutS")) : st === "race" ? GG.checkrow("wait", t("s08.race"), t("s08.raceS")) : GG.checkrow("ok", t("s08.cWindow"));
    var flow = st === "sending" ? GG.flowrow("info", "spin", t("s08.sending")) : st === "done" ? GG.flowrow("ok", "check", t("s08.done")) : GG.flowrow("", "info", t("s02.ready"));
    var body = GG.target(t("s08.target")) + flow + GG.afacts([[t("s02.promise"), "Solar basics course, 10 lessons"], [t("s07.holder"), t("s07.holderV")], [t("m07.takes"), GG.vN(100)]]) +
      '<div class="dsec"><h3>' + t("s02.checks") + '</h3><div class="checks">' + c1 + c2 + c3 + "</div></div>" + '<p style="margin:0">' + t("s08.conseq") + "</p>";
    var foot = st === "done" ? GG.abtn(t("c.done"), { fill: true }) : GG.abtn(t("c.cancel"), { disabled: st === "sending" }) + GG.abtn(t("s08.accept"), { fill: true, go: "@sending", disabled: blocked || st === "sending" });
    return GG.ckSunroot("escrow", ctx) + GG.adlg({ title: t("s08.title"), body: body, foot: foot, note: blocked ? "" : t("s02.walletOnce"), alert: true });
  }
});

/* ---------------- S09 Propose the final split (provider and issuer) ---------------- */
GG.T({
  "s09.title": ["End Early and Propose a Split", "Terminar antes y proponer un reparto", "Encerrar antes e propor uma divisão"],
  "s09.r1": ["Delivered", "Entregado", "Entregue"], "s09.r2": ["Split", "Reparto", "Divisão"], "s09.r3": ["Review", "Revisión", "Revisão"],
  "s09.rTarget": ["Writing to Sunroot Skills Hub's pool and its voucher escrow", "Escribe en el fondo común de Sunroot Skills Hub y su depósito de garantía", "Grava no fundo comum da Sunroot Skills Hub e no depósito em garantia"],
  "s09.hDelivered": ["Which lessons were delivered?", "¿Qué clases se dieron?", "Quais aulas foram dadas?"],
  "s09.lessonOk": ["Lesson {n} · proof added {d}", "Clase {n} · prueba añadida el {d}", "Aula {n} · prova adicionada em {d}"],
  "s09.lessonNo": ["Lesson {n} · not delivered", "Clase {n} · no se dio", "Aula {n} · não dada"],
  "s09.countDelivered": ["Lessons delivered", "Clases dadas", "Aulas dadas"],
  "s09.hSplit": ["Split the 100 vouchers in escrow", "Reparte los 100 vales en garantía", "Divida os 100 vales em garantia"],
  "s09.toReserve": ["To Sunroot's reserve", "A la reserva de Sunroot", "Para a reserva da Sunroot"],
  "s09.toLina": ["Back to Lina", "De vuelta a Lina", "De volta para Lina"],
  "s09.sumOk": ["Total 100 of 100", "Total 100 de 100", "Total 100 de 100"],
  "s09.remOk": ["Within your remedy: returning up to 60 is authorized for 3 of 10 lessons", "Dentro de tu solución: se autoriza devolver hasta 60 con 3 de 10 clases", "Dentro da sua solução: devolver até 60 está autorizado com 3 de 10 aulas"],
  "s09.remBad": ["Above the 60 Sunroot authorized. Lower it, or update the authorization first.", "Supera los 60 que autorizó Sunroot. Bájalo o actualiza antes la autorización.", "Acima dos 60 que a Sunroot autorizou. Reduza ou atualize a autorização antes."],
  "s09.noRate": ["Lessons and vouchers are separate. Enter the split your remedy terms set; nothing is calculated per lesson.", "Las clases y los vales van por separado. Escribe el reparto que fijan tus condiciones de solución; no se calcula nada por clase.", "Aulas e vales são separados. Informe a divisão definida pelas condições da solução; nada é calculado por aula."],
  "s09.auth": ["Issuer authorization", "Autorización del emisor", "Autorização do emissor"],
  "s09.authV": ["Signs as Sunroot Skills Hub's Safe on Gnosis · 2 of 3", "Firma como el Safe de Sunroot Skills Hub en Gnosis · 2 de 3", "Assina como o Safe da Sunroot Skills Hub na Gnosis · 2 de 3"],
  "s09.conseq": ["Lina reviews and freezes this. Until she freezes it, you can withdraw or change the proposal. After she freezes it, nobody can change it.", "Lina lo revisa y lo fija. Hasta que lo fije, puedes retirar o cambiar la propuesta. Cuando lo fije, nadie podrá cambiarlo.", "Lina revisa e fixa. Até ela fixar, você pode retirar ou mudar a proposta. Depois que ela fixar, ninguém pode mudar."],
  "s09.send": ["Send Proposal", "Enviar propuesta", "Enviar proposta"],
  "s09.sent": ["Sent to Lina. Waiting for her to freeze it.", "Enviada a Lina. Esperando a que la fije.", "Enviada para Lina. Aguardando ela fixar."],
  "s09.frozen": ["Lina froze the split on Oct 30. Transfers started.", "Lina fijó el reparto el 30 oct. Empezaron las transferencias.", "Lina fixou a divisão em 30 out. As transferências começaram."],
  "s09.next": ["Next", "Siguiente", "Próximo"]
});
GG.SCR("S09", {
  surface: "steward", journey: "vs", title: "Propose the final split (provider and issuer)", prd: "PRD-1297",
  states: [["delivered", "Step 1: delivered units", "default"], ["split", "Step 2: split within remedy", "default"], ["outside", "Split above authorization", "blocked"], ["review", "Step 3: review and authorize", "default"], ["sent", "Sent, waiting for holder", "pending"], ["frozen", "Holder froze it", "success"]],
  notes: {
    who: "Provider steward records delivery and proposes; issuer authority (issuer Safe on Gnosis) authorizes the return portion.",
    pre: "Promise active; delivery evidence attached per unit; remedy terms with authorized return. Evidence: promise evidence records, remedy terms in the terms record.",
    auth: "A proposed final allocation (delivered units, release to reserve, return to holder) and the issuer's authorization for the return.",
    out: "Proposal sent; editable until the holder freezes; read-only after.",
    rec: "Outside the authorization: blocked in the flow. After freeze: only leg retries (S10).",
    facts: "Flow dialog with a fixed rail (interaction-patterns §2). Delivered + returned = presented, enforced on Gnosis. One immutable decision per escrow. Which account submits the proposal and which signs the authorization: confirm against the reconciliation handoff.",
    tags: ["req", "sel", "open"], dec: ["D10"]
  },
  stateNotes: {
    delivered: { say: "Delivered units come from evidence rows, not a free number.", sr: "Step 1 of 3." },
    split: { say: "Two fields; sum and remedy checks inline; no per-lesson calculator.", sr: "Field errors tied to inputs." },
    outside: { say: "Blocked with the authorized limit stated.", sr: "Error text (assertive)." },
    review: { say: "Authorization account and consequence before sending.", sr: "Step 3 of 3." },
    sent: { say: "Waiting for the holder; the proposal is still changeable.", sr: "Status row." },
    frozen: { say: "Read-only.", sr: "Status row." }
  },
  render: function (st, ctx) {
    var step = st === "delivered" ? 0 : st === "split" || st === "outside" ? 1 : 2;
    var rail = '<div class="rail">' + [t("s09.r1"), t("s09.r2"), t("s09.r3")].map(function (r, i) { return '<div class="rs' + (i === step ? " on" : "") + '"><b>' + (i < step ? "✓" : i + 1) + "</b>" + r + "</div>"; }).join("") + '<div class="tgt">' + t("s09.rTarget") + "</div></div>";
    var main;
    if (st === "delivered") {
      var lines = "";
      for (var i = 1; i <= 10; i++) lines += GG.checkrow(i <= 3 ? "ok" : "no", i <= 3 ? t("s09.lessonOk", { n: i, d: t(["m10.d21", "m10.d23", "m10.d28"][i - 1]) }) : t("s09.lessonNo", { n: i }));
      main = '<div class="dsec"><h3>' + t("s09.hDelivered") + '</h3><div class="checks">' + lines + "</div></div>" + GG.afacts([[t("s09.countDelivered"), "3 / 10"]]);
    } else if (st === "split" || st === "outside") {
      var back = st === "outside" ? 70 : 60;
      main = '<div class="dsec"><h3>' + t("s09.hSplit") + "</h3>" +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="fieldA"><label>' + t("s09.toReserve") + '</label><div class="inp"><span>' + (100 - back) + "</span><span>Sunroot</span></div><span class=\"hl\"></span></div>" +
        '<div class="fieldA"><label>' + t("s09.toLina") + '</label><div class="inp"><span>' + back + "</span><span>Sunroot</span></div>" + (st === "outside" ? '<span class="hl err">' + t("s09.remBad") + "</span>" : '<span class="hl"></span>') + "</div></div>" +
        '<div class="checks">' + GG.checkrow("ok", t("s09.sumOk")) + (st === "outside" ? GG.checkrow("no", t("s09.remBad")) : GG.checkrow("ok", t("s09.remOk"))) + "</div>" +
        '<p class="small" style="margin:0;color:var(--muted)">' + t("s09.noRate") + "</p></div>";
    } else {
      var flow = st === "sent" ? GG.flowrow("info", "clock", t("s09.sent")) : st === "frozen" ? GG.flowrow("ok", "lock", t("s09.frozen")) : GG.flowrow("", "info", t("s07.ready"));
      main = flow + GG.afacts([[t("s09.countDelivered"), "3 / 10"], [t("s09.toReserve"), GG.vN(40)], [t("s09.toLina"), GG.vN(60)], [t("s09.auth"), t("s09.authV")]]) + '<p style="margin:0">' + t("s09.conseq") + "</p>";
    }
    var foot = st === "frozen" || st === "sent" ? GG.abtn(t("c.done"), { fill: true }) : GG.abtn(t("c.back"), { disabled: step === 0 }) + GG.abtn(step === 2 ? t("s09.send") : t("s09.next"), { fill: true, go: step === 0 ? "@split" : step === 1 ? "@review" : "@sent", disabled: st === "outside" });
    return GG.ckSunroot("escrow", ctx) + GG.adlg({ lg: true, title: t("s09.title"), sub: "Lina · Solar basics course, 10 lessons", split: true, body: '<div class="dsplit">' + rail + '<div class="db">' + main + "</div></div>", foot: foot });
  }
});

/* ---------------- S10 Voucher escrow in the commitment inspector (legs and recovery) ---------------- */
GG.T({
  "s10.terms": ["Voucher Terms", "Condiciones de vales", "Condições de vales"],
  "s10.sub": ["Offer at Sunroot Skills Hub · taken up by Lina", "Oferta en Sunroot Skills Hub · aceptada por Lina", "Oferta na Sunroot Skills Hub · aceita por Lina"],
  "s10.frozenK": ["Frozen, read-only", "Fijado, solo lectura", "Fixada, somente leitura"],
  "s10.escrow": ["Escrow", "Depósito de garantía", "Depósito em garantia"],
  "s10.e1": ["Setup approved by Sunroot", "Preparación aprobada por Sunroot", "Preparação aprovada pela Sunroot"],
  "s10.e2": ["100 deposited by 0x9A40…41bD", "100 depositados por 0x9A40…41bD", "100 depositados por 0x9A40…41bD"],
  "s10.e3": ["Proof received on Arbitrum", "Prueba recibida en Arbitrum", "Prova recebida na Arbitrum"],
  "s10.e4": ["Accepted · activation confirmed on Gnosis", "Aceptada · activación confirmada en Gnosis", "Aceita · ativação confirmada na Gnosis"],
  "s10.split": ["Final Split", "Reparto final", "Divisão final"],
  "s10.splitV": ["Frozen by Lina, Oct 30 · 3 of 10 lessons · 40 to reserve · 60 back", "Fijado por Lina, 30 oct · 3 de 10 clases · 40 a la reserva · 60 de vuelta", "Fixada por Lina, 30 out · 3 de 10 aulas · 40 para a reserva · 60 de volta"],
  "s10.transfers": ["Transfers", "Transferencias", "Transferências"],
  "s10.rel": ["Release · 40 to Sunroot's reserve", "Liberación · 40 a la reserva de Sunroot", "Liberação · 40 para a reserva da Sunroot"],
  "s10.ref": ["Refund · 60 to Lina's Gnosis wallet", "Reembolso · 60 a la billetera de Gnosis de Lina", "Reembolso · 60 para a carteira da Gnosis de Lina"],
  "s10.sent": ["Sent", "Enviada", "Enviada"],
  "s10.doneG": ["Done on Gnosis", "Hecha en Gnosis", "Concluída na Gnosis"],
  "s10.conf": ["Confirmed", "Confirmada", "Confirmada"],
  "s10.ackWait": ["Done on Gnosis · confirmation not back yet", "Hecha en Gnosis · aún no vuelve la confirmación", "Concluída na Gnosis · confirmação ainda não voltou"],
  "s10.failed": ["Failed · attempt 1", "Fallida · intento 1", "Falhou · tentativa 1"],
  "s10.retry": ["Retry Same Transfer", "Reintentar la misma transferencia", "Tentar a mesma transferência"],
  "s10.retryNote": ["Resends exactly 60 to the same wallet. It can't change the amount or touch the release.", "Reenvía exactamente 60 a la misma billetera. No puede cambiar el importe ni tocar la liberación.", "Reenvia exatamente 60 para a mesma carteira. Não pode mudar o valor nem mexer na liberação."],
  "s10.closure": ["Financial closure", "Cierre financiero", "Fechamento financeiro"],
  "s10.closureOpen": ["Open until both transfers finish", "Abierto hasta que terminen las dos transferencias", "Aberto até as duas transferências terminarem"],
  "s10.closureDone": ["Vouchers settled Oct 30. The promise's kept status and any outside service are separate.", "Vales liquidados el 30 oct. El estado de cumplida de la promesa y cualquier servicio externo van aparte.", "Vales liquidados em 30 out. O status de cumprida da promessa e qualquer serviço externo são separados."],
  "s10.reuse": ["Released vouchers return to Sunroot's reserve for reuse within its budget. Nothing is burned.", "Los vales liberados vuelven a la reserva de Sunroot para reutilizarse dentro de su presupuesto. No se quema nada.", "Os vales liberados voltam para a reserva da Sunroot para reuso dentro do orçamento. Nada é queimado."],
  "s10.aborted": ["Setup canceled by Lina before acceptance · all 100 returned Oct 25, 5:40 PM", "Preparación cancelada por Lina antes de aceptar · los 100 devueltos el 25 oct, 17:40", "Preparação cancelada por Lina antes do aceite · os 100 devolvidos em 25 out, 17:40"]
});
GG.SCR("S10", {
  surface: "steward", journey: "vs", title: "Voucher escrow in the inspector (legs and recovery)", prd: "PRD-1297",
  states: [["inflight", "Both legs sent", "pending"], ["legfail", "Release done, refund failed", "failure"], ["ackwait", "Done on Gnosis, ack pending", "delayed"], ["settled", "Financially closed", "success"], ["aborted", "Setup refunded before acceptance", "recovery"]],
  notes: {
    who: "Provider steward and issuer stewards read; the provider steward (or the holder) can retry a failed leg.",
    pre: "Escrow record and per-leg execution plus acknowledgment states.",
    auth: "Retry of the same leg with the frozen allocation.",
    out: "Source state, destination execution and acknowledgment are three columns of truth: Sent, Done on Gnosis, Confirmed.",
    rec: "Failed leg: retry the same command; amounts and recipients are read-only after freeze.",
    facts: "GnosisVoucherEscrow: independent release and refund legs, terminal only when both settle (a zero leg needs no transfer). Discharged vouchers return to the issuer reserve (no burn). Retry identity is the escrow and leg, not a new message.",
    tags: ["req", "sel"], dec: ["D9"]
  },
  stateNotes: {
    inflight: { say: "Both sent; neither assumed done.", sr: "None." },
    legfail: { say: "One leg done, the other failed; retry targets only the failed leg.", sr: "Error row." },
    ackwait: { say: "Executed but acknowledgment missing: shown as such, not as failure.", sr: "None." },
    settled: { say: "Closure separate from kept status and external services.", sr: "None." },
    aborted: { say: "Pre-acceptance setup refund in the same record.", sr: "None." }
  },
  render: function (st, ctx) {
    var relS = st === "inflight" ? GG.sb("info", t("s10.sent")) : st === "ackwait" ? GG.sb("info", t("s10.ackWait")) : GG.sb("ok", t("s10.conf"));
    var refS = st === "inflight" ? GG.sb("info", t("s10.sent")) : st === "legfail" ? GG.sb("err", t("s10.failed")) : st === "ackwait" ? GG.sb("info", t("s10.ackWait")) : GG.sb("ok", t("s10.conf"));
    var body = '<div class="dsec"><h3>' + t("s10.terms") + "</h3>" + GG.afacts([[t("m03.terms"), t("c.version", { n: 2 })], [t("m07.takes"), GG.vN(100)], [t("m07.missed"), t("m07.missedV")]]) + "</div>" +
      '<div class="dsec"><h3>' + t("s10.escrow") + '</h3><div class="checks">' + GG.checkrow("ok", t("s10.e1")) + GG.checkrow("ok", t("s10.e2")) + GG.checkrow("ok", t("s10.e3")) + (st === "aborted" ? GG.checkrow("ok", t("s10.aborted")) : GG.checkrow("ok", t("s10.e4"))) + "</div></div>";
    if (st !== "aborted") body += '<div class="dsec"><h3>' + t("s10.split") + "</h3>" + GG.afacts([[t("s10.frozenK"), t("s10.splitV")]]) + "</div>" +
      '<div class="dsec"><h3>' + t("s10.transfers") + '</h3><div class="afacts"><div class="afact"><span class="k">' + t("s10.rel") + '</span><span class="v">' + relS + '</span></div><div class="afact"><span class="k">' + t("s10.ref") + '</span><span class="v">' + refS + "</span></div></div>" +
      (st === "legfail" ? '<p class="small" style="margin:0;color:var(--muted)">' + t("s10.retryNote") + "</p>" : "") + '<p class="small" style="margin:0;color:var(--muted)">' + t("s10.reuse") + "</p></div>" +
      '<div class="dsec"><h3>' + t("s10.closure") + "</h3>" + (st === "settled" ? GG.flowrow("ok", "check", t("s10.closureDone")) : GG.flowrow("", "clock", t("s10.closureOpen"))) + "</div>";
    var foot = st === "legfail" ? GG.abtn(t("s06.close")) + GG.abtn(t("s10.retry"), { fill: true, go: "@settled" }) : GG.abtn(t("s06.close"), { fill: true });
    return GG.ckSunroot("escrow", ctx) + GG.adlg({ lg: true, title: "Solar basics course, 10 lessons", sub: t("s10.sub"), body: body, foot: foot });
  }
});

/* ---------------- S11 Admit a gardener as a voucher issuer (proposed) ---------------- */
GG.T({
  "s11.title": ["Admit Mara as a Voucher Issuer", "Admitir a Mara como emisora de vales", "Admitir Mara como emissora de vales"],
  "s11.r1": ["Identity", "Identidad", "Identidade"], "s11.r2": ["Terms", "Condiciones", "Condições"], "s11.r3": ["Cap", "Límite", "Limite"], "s11.r4": ["Review", "Revisión", "Revisão"],
  "s11.policy": ["Proposal: the contracts don't enforce admission, caps or pauses yet. Saving records your decision as garden policy and shows it to members. It doesn't limit issuance.", "Propuesta: los contratos todavía no aplican admisiones, límites ni pausas. Guardar registra tu decisión como política del jardín y la muestra a los miembros. No limita la emisión.", "Proposta: os contratos ainda não aplicam admissões, limites nem pausas. Salvar registra sua decisão como política do jardim e mostra aos membros. Não limita a emissão."],
  "s11.target": ["Recording for Riverside Commons Garden", "Registro para Riverside Commons Garden", "Registro para o Riverside Commons Garden"],
  "s11.issuerId": ["Issuer name", "Nombre del emisor", "Nome do emissor"],
  "s11.issuerIdH": ["Its own issuer, separate from other gardeners in this garden", "Su propio emisor, separado de otros jardineros de este jardín", "Emissor próprio, separado de outros jardineiros deste jardim"],
  "s11.voucher": ["Voucher", "Vale", "Vale"],
  "s11.issuesVia": ["Issues through", "Emite a través de", "Emite por meio de"],
  "s11.issuesViaV": ["Riverside Commons Garden's Safe, until Gnosis passkeys work · Mara stays the named issuer", "El Safe de Riverside Commons Garden, hasta que funcionen las claves de acceso en Gnosis · Mara sigue como emisora", "O Safe do Riverside Commons Garden, até as chaves de acesso funcionarem na Gnosis · Mara continua como emissora"],
  "s11.buys": ["What it buys", "Qué compra", "O que compra"],
  "s11.unit": ["Unit", "Unidad", "Unidade"],
  "s11.capacity": ["Capacity", "Capacidad", "Capacidade"],
  "s11.capacityV": ["30 packets a season", "30 sobres por temporada", "30 pacotes por temporada"],
  "s11.timing": ["Timing", "Horario", "Horário"],
  "s11.timingV": ["Pickups on Saturdays", "Recogida los sábados", "Retirada aos sábados"],
  "s11.present": ["How to present", "Cómo presentarlo", "Como apresentar"],
  "s11.presentV": ["At the seed table, through a promise", "En la mesa de semillas, mediante una promesa", "Na mesa de sementes, por meio de uma promessa"],
  "s11.remedy": ["Remedy", "Solución", "Solução"],
  "s11.remedyV": ["Unused vouchers returned if the library closes", "Vales sin usar devueltos si la biblioteca cierra", "Vales não usados devolvidos se a biblioteca fechar"],
  "s11.cap": ["Outstanding cap", "Límite en circulación", "Limite em circulação"],
  "s11.grow": ["Grows by", "Crece", "Cresce"],
  "s11.growV": ["5 per kept promise", "5 por promesa cumplida", "5 por promessa cumprida"],
  "s11.now": ["Outstanding now", "En circulación ahora", "Em circulação agora"],
  "s11.save": ["Record Admission", "Registrar admisión", "Registrar admissão"],
  "s11.saved": ["Recorded as garden policy. Mara appears as an admitted issuer; issuance isn't limited by this record.", "Registrado como política del jardín. Mara aparece como emisora admitida; este registro no limita la emisión.", "Registrado como política do jardim. Mara aparece como emissora admitida; este registro não limita a emissão."]
});
GG.ckCommunity = function (ctx, issuers) {
  var members = GG.acard({ title: t("s12.members"), rows:
    GG.arow({ name: "Mara", chips: GG.sb("neu", t("c.gardener")) + (issuers ? GG.sb("pol", t("s12.issuerPol")) : ""), meta: t("s12.maraMeta"), acts: GG.abtn(issuers ? t("s12.pause") : t("s12.admit"), { go: issuers ? "S12@pause" : "S11@identity" }) }) +
    GG.arow({ name: "Tomás", chips: GG.sb("neu", t("c.stewardRole")), meta: t("s12.tomasMeta") }) +
    GG.arow({ name: "Lina", chips: GG.sb("neu", t("c.gardener")), meta: t("s12.linaMeta") }) });
  var issuersCard = GG.acard({ title: t("s12.title"), sub: t("s12.sub"), rows:
    GG.arow({ name: "Sunroot Skills Hub", chips: GG.sb("neu", t("s12.hub")) + GG.sb("pol", t("s12.capPol")), meta: t("s12.sunMeta") }) +
    GG.arow({ name: "Mara's Seed Library", chips: GG.sb("neu", t("c.gardener")) + GG.sb("pol", t("s12.capPol")), meta: t("s12.maraCap") }) });
  var main = members, rail = issuersCard;
  if (ctx && ctx.phone) { main = issuersCard + members; rail = ""; }
  return GG.ckShell({ ws: "community", garden: GG.D.home, av: "RC", title: t("c.ws.community"), tabs: [t("s12.members"), t("s12.coord"), t("s12.payouts")], tab: 0, main: main, rail: rail });
};
GG.SCR("S11", {
  surface: "steward", journey: "is", title: "Admit a gardener issuer (proposed, unenforced)", prd: "PRD-1297 / PRD-1323 (status display)",
  states: [["identity", "Step 1: identity", "default"], ["terms", "Step 2: published terms", "default"], ["cap", "Step 3: cap", "default"], ["review", "Step 4: review (policy record)", "default"], ["saved", "Recorded as policy", "success"]],
  notes: {
    who: "Garden steward of the gardener's garden (admission authority to be decided).",
    pre: "Gardener is a member; issuer terms drafted (COM-46 adds terms for gardener issuers and a legal check for individuals).",
    auth: "A policy record of admission, identity, terms and cap. Not an on-chain authority grant.",
    out: "Admitted (policy) chip on the person and in the Voucher Issuers card.",
    rec: "Edit or revoke the policy record; no contract effect either way.",
    facts: "Unresolved: distinct issuer identifier per gardener, garden/Safe/token relationship, admission authority, per-gardener cap isolation, and cap enforcement (mint controller or monitored policy). Until the WebAuthn validator exists on Gnosis, the garden's Safe issues within the gardener's cap. A UI toggle must not look like enforcement.",
    tags: ["ui", "dep", "open"], dec: ["D12"]
  },
  stateNotes: {
    identity: { say: "Banner states the record is policy, not enforcement, on every step.", sr: "Banner read with the dialog description." },
    terms: { say: "Published terms fields mirror the 21 October decision (what it buys, unit, capacity, timing, presentment, remedy).", sr: "None." },
    cap: { say: "Cap and its growth rule shown with current outstanding.", sr: "None." },
    review: { say: "Primary reads \"Record Admission\", not \"Admit\" or \"Enable\".", sr: "None." },
    saved: { say: "Done line restates the limit.", sr: "Status row." }
  },
  render: function (st, ctx) {
    var step = { identity: 0, terms: 1, cap: 2, review: 3, saved: 3 }[st];
    var rail = '<div class="rail">' + [t("s11.r1"), t("s11.r2"), t("s11.r3"), t("s11.r4")].map(function (r, i) { return '<div class="rs' + (i === step ? " on" : "") + '"><b>' + (i < step ? "✓" : i + 1) + "</b>" + r + "</div>"; }).join("") + '<div class="tgt">' + t("s11.target") + "</div></div>";
    var banner = GG.flowrow("pol", "alert", t("s11.policy"));
    var f = function (l, v, h) { return '<div class="fieldA"><label>' + l + '</label><div class="inp"><span>' + v + '</span></div><span class="hl">' + (h || "") + "</span></div>"; };
    var main = banner;
    if (st === "identity") main += f(t("s11.issuerId"), "Mara's Seed Library", t("s11.issuerIdH")) + f(t("s11.voucher"), t("m12.maraTitle"), "Gnosis · 0x7aB2…5e10") + GG.afacts([[t("s11.issuesVia"), t("s11.issuesViaV")]]);
    else if (st === "terms") main += f(t("s11.buys"), "One seed packet from the library") + f(t("s11.unit"), "One seed packet") + f(t("s11.capacity"), t("s11.capacityV")) + f(t("s11.timing"), t("s11.timingV")) + f(t("s11.present"), t("s11.presentV")) + f(t("s11.remedy"), t("s11.remedyV"));
    else if (st === "cap") main += f(t("s11.cap"), "50") + f(t("s11.grow"), t("s11.growV")) + GG.afacts([[t("s11.now"), "5"]]);
    else main += (st === "saved" ? GG.flowrow("ok", "check", t("s11.saved")) : "") + GG.afacts([[t("s11.issuerId"), "Mara's Seed Library"], [t("s11.voucher"), t("m12.maraTitle")], [t("s11.issuesVia"), t("s11.issuesViaV")], [t("s11.buys"), "One seed packet"], [t("s11.capacity"), t("s11.capacityV")], [t("s11.cap"), "50 · " + t("s11.growV")]]);
    var foot = st === "saved" ? GG.abtn(t("c.done"), { fill: true, go: "S12@default" }) : GG.abtn(t("c.back"), { disabled: step === 0 }) + GG.abtn(step === 3 ? t("s11.save") : t("s09.next"), { fill: true, go: "@" + ["terms", "cap", "review", "saved"][step] });
    return GG.ckCommunity(ctx, false) + GG.adlg({ lg: true, title: t("s11.title"), split: true, body: '<div class="dsplit">' + rail + '<div class="db">' + main + "</div></div>", foot: foot });
  }
});

/* ---------------- S12 Voucher issuers, caps and suspension (proposed) ---------------- */
GG.T({
  "s12.members": ["Members", "Miembros", "Membros"],
  "s12.coord": ["Coordination", "Coordinación", "Coordenação"],
  "s12.payouts": ["Payouts", "Pagos", "Pagamentos"],
  "s12.title": ["Voucher Issuers", "Emisores de vales", "Emissores de vales"],
  "s12.sub": ["Who issues vouchers used in this garden, and their published caps. Caps and pauses here are garden policy; the contracts don't enforce them yet.", "Quién emite los vales que se usan en este jardín y sus límites publicados. Los límites y pausas de aquí son política del jardín; los contratos todavía no los aplican.", "Quem emite os vales usados neste jardim e seus limites publicados. Limites e pausas aqui são política do jardim; os contratos ainda não os aplicam."],
  "s12.hub": ["Hub", "Hub", "Hub"],
  "s12.capPol": ["Cap: policy", "Límite: política", "Limite: política"],
  "s12.issuerPol": ["Issuer: policy", "Emisora: política", "Emissora: política"],
  "s12.sunMeta": ["1,240 of 2,000 outstanding · grows with kept promises", "1.240 de 2.000 en circulación · crece con promesas cumplidas", "1.240 de 2.000 em circulação · cresce com promessas cumpridas"],
  "s12.maraCap": ["5 of 50 outstanding · admitted Oct 22 by Tomás", "5 de 50 en circulación · admitida el 22 oct por Tomás", "5 de 50 em circulação · admitida em 22 out por Tomás"],
  "s12.maraMeta": ["Joined Mar 2026 · runs the seed library", "Se unió en mar 2026 · lleva la biblioteca de semillas", "Entrou em mar 2026 · cuida da biblioteca de sementes"],
  "s12.tomasMeta": ["Joined Jan 2026", "Se unió en ene 2026", "Entrou em jan 2026"],
  "s12.linaMeta": ["Joined Feb 2026", "Se unió en feb 2026", "Entrou em fev 2026"],
  "s12.admit": ["Admit as Issuer…", "Admitir como emisora…", "Admitir como emissora…"],
  "s12.pause": ["Record a Pause…", "Registrar una pausa…", "Registrar uma pausa…"],
  "s12.pauseT": ["Record a Pause for Mara's Seed Library?", "¿Registrar una pausa para Mara's Seed Library?", "Registrar uma pausa para Mara's Seed Library?"],
  "s12.pNo": ["Not enforceable yet", "Todavía no se puede aplicar", "Ainda não pode ser aplicada"],
  "s12.pNoS": ["The contracts can't stop issuance from Riverside Commons' Safe or other routes. This records a garden decision and shows it to members and pools.", "Los contratos no pueden detener la emisión desde el Safe de Riverside Commons ni por otras vías. Esto registra una decisión del jardín y la muestra a miembros y fondos comunes.", "Os contratos não conseguem impedir a emissão pelo Safe do Riverside Commons nem por outras vias. Isto registra uma decisão do jardim e mostra a membros e fundos comuns."],
  "s12.pOut": ["Outstanding obligations stay visible", "Las obligaciones pendientes siguen visibles", "As obrigações pendentes continuam visíveis"],
  "s12.pOutS": ["5 vouchers in circulation; promises using them continue to their remedy.", "5 vales en circulación; las promesas que los usan siguen hasta su solución.", "5 vales em circulação; as promessas que os usam seguem até a solução."],
  "s12.record": ["Record Pause", "Registrar pausa", "Registrar pausa"]
});
GG.SCR("S12", {
  surface: "steward", journey: "is", title: "Voucher issuers, caps and pause (proposed, unenforced)", entry: true, prd: "PRD-1297 / PRD-1323 (status)",
  states: [["default", "Issuers card with policy chips", "default"], ["pause", "Record a pause (not enforcement)", "permission"]],
  notes: {
    who: "Garden steward. Independent steward suspension is not enforced by the accepted contracts.",
    pre: "Policy records of admitted issuers; outstanding supply read from Gnosis.",
    auth: "A recorded pause decision (policy), visible to members and pools.",
    out: "Chips say \"policy\"; the pause act is labeled \"Record a Pause\", never \"Pause Issuer\".",
    rec: "Lift the recorded pause. No contract effect.",
    facts: "Outstanding = issuer token supply outside the issuer reserve (Gnosis read). Required but unenforceable stops remain release blockers (PRD-1315/1318). Placement in Community › Members is a proposal.",
    tags: ["ui", "dep", "open"], dec: ["D12"]
  },
  stateNotes: {
    default: { say: "The policy chip is the anti-toggle: no switch implies enforcement.", sr: "Chip text \"Cap: policy\"." },
    pause: { say: "Failed check states what the contracts can't do.", sr: "Failed check read first." }
  },
  render: function (st, ctx) {
    var shell = GG.ckCommunity(ctx, true);
    if (st !== "pause") return shell;
    var body = '<div class="checks">' + GG.checkrow("no", t("s12.pNo"), t("s12.pNoS")) + GG.checkrow("wait", t("s12.pOut"), t("s12.pOutS")) + "</div>";
    return shell + GG.adlg({ title: t("s12.pauseT"), body: GG.target(t("s11.target")) + body, foot: GG.abtn(t("c.cancel")) + GG.abtn(t("s12.record"), { fill: true }) });
  }
});

/* ---------------- S13 Linked rewards in the commitment inspector (PRD-1323) ---------------- */
GG.T({
  "s13.title": ["Teach two compost workshops", "Teach two compost workshops", "Teach two compost workshops"],
  "s13.sub": ["Request at Riverside Commons Garden · taken up by Lina · kept Oct 29", "Petición en Riverside Commons Garden · aceptada por Lina · cumplida el 29 oct", "Pedido no Riverside Commons Garden · aceito por Lina · cumprido em 29 out"],
  "s13.terms": ["Agreed Rewards", "Recompensas acordadas", "Recompensas combinadas"],
  "s13.g": ["G$", "G$", "G$"],
  "s13.gV": ["120.00 G$ · existing payout plan", "120,00 G$ · plan de pagos existente", "120,00 G$ · plano de pagamento existente"],
  "s13.v": ["Vouchers", "Vales", "Vales"],
  "s13.vV": ["20 Sunroot vouchers from Riverside Commons Garden's vouchers", "20 vales de Sunroot de los vales de Riverside Commons Garden", "20 vales da Sunroot dos vales do Riverside Commons Garden"],
  "s13.vMara": ["5 of Mara's Seed Library vouchers, issued within her cap", "5 vales de Mara's Seed Library, emitidos dentro de su límite", "5 vales da Mara's Seed Library, emitidos dentro do limite dela"],
  "s13.approvedBy": ["Approved by Tomás, Oct 20, from this garden's vouchers", "Aprobado por Tomás, 20 oct, de los vales de este jardín", "Aprovado por Tomás, 20 out, dos vales deste jardim"],
  "s13.issuer": ["Issuer", "Emisor", "Emissor"],
  "s13.issuerHub": ["Sunroot Skills Hub · hub issuer", "Sunroot Skills Hub · emisor hub", "Sunroot Skills Hub · emissor hub"],
  "s13.issuerMara": ["Mara's Seed Library · gardener issuer · admitted (policy) · 5 of 50 outstanding", "Mara's Seed Library · emisora jardinera · admitida (política) · 5 de 50 en circulación", "Mara's Seed Library · emissora jardineira · admitida (política) · 5 de 50 em circulação"],
  "s13.recipient": ["Recipient", "Destinatario", "Destinatário"],
  "s13.recipientV": ["Lina · Gnosis wallet 0x9A40…41bD (bound at acceptance)", "Lina · billetera de Gnosis 0x9A40…41bD (vinculada al aceptar)", "Lina · carteira da Gnosis 0x9A40…41bD (vinculada no aceite)"],
  "s13.rewards": ["Rewards", "Recompensas", "Recompensas"],
  "s13.normal": ["One reward done and one pending is normal. Each has its own receipt.", "Que una recompensa esté hecha y otra pendiente es normal. Cada una tiene su comprobante.", "Uma recompensa concluída e outra pendente é normal. Cada uma tem seu recibo."],
  "s13.gConf": ["Confirmed on Celo, Oct 30", "Confirmado en Celo, 30 oct", "Confirmado na Celo, 30 out"],
  "s13.gPend": ["Payout plan finalized · dispatch next", "Plan de pagos finalizado · envío a continuación", "Plano de pagamento finalizado · envio em seguida"],
  "s13.vSent": ["Sent to Gnosis · waiting for delivery", "Enviado a Gnosis · esperando la entrega", "Enviado à Gnosis · aguardando a entrega"],
  "s13.vDone": ["Delivered on Gnosis · confirmed", "Entregado en Gnosis · confirmado", "Entregue na Gnosis · confirmado"],
  "s13.vFail": ["Delivery failed on Gnosis · stored result: allowance too low", "La entrega falló en Gnosis · resultado guardado: autorización insuficiente", "A entrega falhou na Gnosis · resultado salvo: autorização insuficiente"],
  "s13.vRetry": ["Retry Same Delivery", "Reintentar la misma entrega", "Tentar a mesma entrega"],
  "s13.vRetryNote": ["Uses the same reward record. It can't deliver twice or change the amount.", "Usa el mismo registro de recompensa. No puede entregar dos veces ni cambiar el importe.", "Usa o mesmo registro de recompensa. Não pode entregar duas vezes nem mudar o valor."],
  "s13.legacy": ["No voucher reward. This promise was agreed before voucher terms existed.", "Sin recompensa en vales. Esta promesa se acordó antes de que existieran condiciones de vales.", "Sem recompensa em vales. Esta promessa foi combinada antes de existirem condições de vales."]
});
GG.SCR("S13", {
  surface: "steward", journey: "rw", title: "Linked G$ and voucher rewards in the inspector", prd: "PRD-1323",
  states: [["gdone", "G$ confirmed, vouchers in transit", "pending"], ["bothpend", "Both pending", "pending"], ["vfail", "Voucher delivery failed", "failure"], ["both", "Both received", "success"], ["gardener", "Gardener issuer reward", "default"], ["legacy", "Legacy promise (no voucher term)", "default"]],
  notes: {
    who: "Requesting-garden steward (dispatch, retry); issuer steward reads.",
    pre: "Accepted G$ and voucher terms frozen at acceptance; work confirmed kept. Evidence: terms records, payout plan, entitlement and its stored delivery result.",
    auth: "Existing G$ payout acts; retry of the same voucher entitlement.",
    out: "Two independent receipts; never a combined total.",
    rec: "Voucher failure: retry the same entitlement after repair (allowance or cap); a stored success is reconciled without a second delivery.",
    facts: "Entitlement id derived from chain, module, commitment and terms revision (never supplied). GnosisVoucherAdapter dedupes by execution key and entitlement, stores the result before acknowledgment; timeout never proves failure. Legacy commitments have no implied voucher entitlement.",
    tags: ["req", "sel"], dec: ["D11", "D12"]
  },
  stateNotes: {
    gdone: { say: "One done, one pending: stated as normal.", sr: "None." },
    bothpend: { say: "Both pending, independent.", sr: "None." },
    vfail: { say: "Stored failure reason and a same-record retry.", sr: "Error row." },
    both: { say: "Both receipts.", sr: "None." },
    gardener: { say: "For a gardener issuer: admission status and current cap (PRD-1323 Done-when).", sr: "None." },
    legacy: { say: "No implied entitlement for older promises.", sr: "None." }
  },
  render: function (st, ctx) {
    var mara = st === "gardener";
    var terms = '<div class="dsec"><h3>' + t("s13.terms") + "</h3>" + GG.afacts([[t("s13.g"), t("s13.gV")], st === "legacy" ? null : [t("s13.v"), mara ? t("s13.vMara") : t("s13.vV"), t("s13.approvedBy")], st === "legacy" ? null : [t("s13.issuer"), mara ? t("s13.issuerMara") : t("s13.issuerHub")], st === "legacy" ? null : [t("s13.recipient"), t("s13.recipientV")]]) + (st === "legacy" ? '<p class="small" style="margin:0;color:var(--muted)">' + t("s13.legacy") + "</p>" : "") + "</div>";
    var gS = st === "bothpend" ? GG.sb("info", t("s13.gPend")) : GG.sb("ok", t("s13.gConf"));
    var vS = st === "both" ? GG.sb("ok", t("s13.vDone")) : st === "vfail" ? GG.sb("err", t("s13.vFail")) : GG.sb("info", t("s13.vSent"));
    var rewards = '<div class="dsec"><h3>' + t("s13.rewards") + '</h3><div class="afacts"><div class="afact"><span class="k">' + GG.gd(120) + '</span><span class="v">' + gS + "</span></div>" +
      (st === "legacy" ? "" : '<div class="afact"><span class="k">' + (mara ? t("c.vN", { n: 5, i: "Mara's Seed Library" }) : GG.vN(20)) + '</span><span class="v">' + vS + "</span></div>") + "</div>" +
      (st === "vfail" ? '<p class="small" style="margin:0;color:var(--muted)">' + t("s13.vRetryNote") + "</p>" : st === "legacy" ? "" : '<p class="small" style="margin:0;color:var(--muted)">' + t("s13.normal") + "</p>") + "</div>";
    var foot = st === "vfail" ? GG.abtn(t("s06.close")) + GG.abtn(t("s13.vRetry"), { fill: true, go: "@gdone" }) : GG.abtn(t("s06.close"), { fill: true });
    return GG.screens.S03.render("check", ctx) + GG.adlg({ lg: true, title: t("s13.title"), sub: t("s13.sub"), body: terms + rewards, foot: foot });
  }
});
