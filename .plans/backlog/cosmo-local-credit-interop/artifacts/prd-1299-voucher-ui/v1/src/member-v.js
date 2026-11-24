/* Member PWA: the revised voucher service journey. Escrow before activation, exact consent before
   acceptance, one immutable final split per escrow. Sunroot Skills Hub, its voucher, its offer and
   every number here are fictional, including the partial example (3 of 10 lessons; 40 to the
   issuer reserve, 60 back). Sunroot's voucher is menu-priced, so lessons and vouchers never share
   a conversion. */
GG.T({
  "c.vN": ["{n} {i} vouchers", "{n} vales de {i}", "{n} vales de {i}"],
  "c.v1": ["{i} voucher", "Vale de {i}", "Vale de {i}"],
  "c.onGnosis": ["on Gnosis", "en Gnosis", "na Gnosis"],
  "c.oct25cut": ["Oct 25, 5:00 PM", "25 oct, 17:00", "25 out, 17:00"],
  "c.connect": ["Connect Wallet", "Conectar billetera", "Conectar carteira"],
  "c.getV": ["Get Vouchers", "Conseguir vales", "Conseguir vales"]
});
GG.vN = function (n, dp) { return t("c.vN", { n: GG.num(n, dp || 0), i: "Sunroot" }); };

/* ---------------- M07 Offer that takes vouchers ---------------- */
GG.T({
  "m07.kind": ["Offer · {g}", "Ofrecimiento · {g}", "Oferta · {g}"],
  "m07.payV": ["Pay with vouchers", "Pagar con vales", "Pagar com vales"],
  "m07.takes": ["Takes", "Acepta", "Aceita"],
  "m07.takesSub": ["{v} · on Gnosis", "{v} · en Gnosis", "{v} · na Gnosis"],
  "m07.youHold": ["You hold", "Tienes", "Você tem"],
  "m07.inWallet": ["In your Gnosis wallet", "En tu billetera de Gnosis", "Na sua carteira da Gnosis"],
  "m07.window": ["Sunroot accepts within", "Sunroot acepta en", "A Sunroot aceita em até"],
  "m07.windowV": ["3 days after your vouchers are in escrow", "3 días desde que tus vales están en depósito de garantía", "3 dias depois que seus vales estiverem em depósito em garantia"],
  "m07.missed": ["If lessons are missed", "Si faltan clases", "Se faltarem aulas"],
  "m07.missedV": ["The final split returns vouchers to you, up to all 100, as Sunroot authorizes", "El reparto final te devuelve vales, hasta los 100, según autorice Sunroot", "A divisão final devolve vales para você, até os 100, conforme a Sunroot autorizar"],
  "m07.noRate": ["Lessons and vouchers are counted separately. The split isn't a price per lesson.", "Las clases y los vales se cuentan por separado. El reparto no es un precio por clase.", "Aulas e vales são contados separadamente. A divisão não é um preço por aula."],
  "m07.starts": ["Starts", "Empieza", "Começa"],
  "m07.startsV": ["Within 2 weeks of acceptance", "Dentro de las 2 semanas tras aceptar", "Até 2 semanas depois do aceite"],
  "m07.lessons": ["10 lessons", "10 clases", "10 aulas"],
  "m07.short.t": ["You need 20 more Sunroot vouchers", "Te faltan 20 vales de Sunroot", "Faltam 20 vales de Sunroot"],
  "m07.short.b": ["Buy them at Sunroot's voucher exchange or earn them through promises.", "Cómpralos en el intercambio de vales de Sunroot o gánalos con promesas.", "Compre na troca de vales da Sunroot ou ganhe com promessas."],
  "m07.nowal.t": ["Connect the wallet that holds your vouchers", "Conecta la billetera que tiene tus vales", "Conecte a carteira que guarda seus vales"],
  "m07.nowal.b": ["Your vouchers live on Gnosis. Your Green Goods passkey can't sign there yet, so a separate wallet holds them.", "Tus vales están en Gnosis. Tu clave de acceso de Green Goods todavía no puede firmar ahí, así que los guarda otra billetera.", "Seus vales ficam na Gnosis. Sua chave de acesso do Green Goods ainda não assina lá, então outra carteira os guarda."],
  "m07.paused.t": ["Sunroot isn't taking new voucher promises right now", "Sunroot no acepta promesas nuevas con vales por ahora", "A Sunroot não está aceitando novas promessas com vales agora"],
  "m07.paused.b": ["Vouchers you already placed in escrow are not affected.", "No afecta a los vales que ya tienes en depósito de garantía.", "Os vales que você já colocou em depósito em garantia não são afetados."]
});
GG.SCR("M07", {
  surface: "member", journey: "vs", title: "Offer that takes vouchers", prd: "PRD-1297 (terms display also PRD-1324)",
  states: [["default", "Open, enough vouchers", "default"], ["short", "Not enough vouchers", "blocked"], ["nowallet", "No Gnosis wallet connected", "unavailable"], ["paused", "Issuer paused (proposed policy)", "paused"]],
  notes: {
    who: "Gardener (prospective voucher holder). Viewing needs no account.",
    pre: "Offer is Offered with accepted-voucher terms (issuer, unit, amount, terms revision, remedy, acceptance window). Holder balance from the connected Gnosis wallet.",
    auth: "Nothing yet.",
    out: "Ask to Take Up opens voucher setup (M08).",
    rec: "Short balance routes to the exchange or earning; no partial presentment in this slice.",
    facts: "Voucher terms record (VoucherEntitlementModule) keyed by commitment and terms revision; holder balance read from the CLC GiftableToken on Gnosis for the connected address. Issuer pause is a proposed steward policy: its enforcement is unresolved (PRD-1315).",
    tags: ["req", "sel"], dec: ["D7"]
  },
  stateNotes: {
    default: { say: "Voucher amount names issuer, unit and network; remedy and acceptance window are disclosed before any request.", sr: "None." },
    short: { say: "Blocked with a path to get vouchers; never offers mixed G$ top-up.", sr: "Notice title (status)." },
    nowallet: { say: "The passkey account is not assumed to work on Gnosis.", sr: "Notice title (status)." },
    paused: { say: "Member copy states the fact without claiming enforcement; the annotation flags it as a policy record.", sr: "Notice title (status)." }
  },
  render: function (st) {
    var D = GG.D;
    var notice = st === "short" ? GG.notice("warn", "alert", t("m07.short.t"), t("m07.short.b"), GG.btn(t("c.getV"), { kind: "secondary", compact: true, go: "M14@quote" })) :
      st === "nowallet" ? GG.notice("info", "info", t("m07.nowal.t"), t("m07.nowal.b")) :
      st === "paused" ? GG.notice("warn", "pause", t("m07.paused.t"), t("m07.paused.b")) : "";
    var primary = st === "nowallet" ? GG.btn(t("c.connect"), { go: "@default" }) : GG.btn(t("c.askTakeUp"), { go: "M08@terms", disabled: st !== "default" });
    return '<div class="screen nobar"><div class="col">' + GG.topnav("", "M02@sunroot") +
      '<div class="ident"><div class="kind">' + ic("offer", 16) + t("m07.kind", { g: D.sunroot }) + "</div><h1>Solar basics course, 10 lessons</h1>" +
      '<div class="chips">' + GG.pill("ok", t("c.open")) + GG.pill("neu", t("c.approvalNeeded")) + "</div>" +
      '<p class="para">Ten evening lessons on small solar systems, run by Sunroot Skills Hub\'s trainers. Bring a notebook.</p>' + notice + "</div>" +
      GG.sec(t("m03.whatYouGet")) + '<div class="mx16">' + GG.card(GG.facts([
        [t("m03.service"), "Solar basics course"], [t("m03.howMuch"), t("m07.lessons")], [t("m07.starts"), t("m07.startsV")],
        [t("m03.terms"), '<span class="link">' + t("c.versionOn", { n: 2, d: t("c.oct15") }) + "</span>"]
      ])) + "</div>" +
      GG.sec(t("m07.payV")) + '<div class="mx16">' + GG.card(GG.facts([
        [t("m07.takes"), GG.vN(100), t("m07.takesSub", { v: t("c.v1", { i: D.sunroot }) }), "total"],
        [t("m07.youHold"), st === "nowallet" ? "?" : GG.num(st === "short" ? 80 : 130), t("m07.inWallet")],
        [t("m07.window"), t("m07.windowV")], [t("m07.missed"), t("m07.missedV")]
      ]) + '<div class="tech"><span>' + t("m07.noRate") + "</span></div>") + "</div>" +
      "</div></div>" + GG.fixedbar([primary]);
  }
});

/* ---------------- M08 Take up with vouchers: setup ---------------- */
GG.T({
  "m08.title": ["Take Up with Vouchers", "Aceptar con vales", "Aceitar com vales"],
  "m08.s1": ["Terms", "Condiciones", "Condições"], "m08.s2": ["Accounts", "Cuentas", "Contas"], "m08.s3": ["Deposit", "Depósito", "Depósito"], "m08.s4": ["Wait", "Espera", "Espera"],
  "m08.before": ["Before Sunroot accepts", "Antes de que Sunroot acepte", "Antes de a Sunroot aceitar"],
  "m08.b1": ["Your vouchers wait in a Green Goods escrow on Gnosis, held for this promise only.", "Tus vales esperan en un depósito de garantía de Green Goods en Gnosis, solo para esta promesa.", "Seus vales ficam em um depósito em garantia do Green Goods na Gnosis, só para esta promessa."],
  "m08.b2": ["Sunroot has 3 days from when the escrow is ready to accept.", "Sunroot tiene 3 días para aceptar desde que el depósito de garantía está listo.", "A Sunroot tem 3 dias para aceitar a partir de quando o depósito em garantia estiver pronto."],
  "m08.b3": ["Until Sunroot accepts, you can cancel. Your vouchers come back once the cancellation is confirmed. Running out of time doesn't return them on its own.", "Hasta que Sunroot acepte, puedes cancelar. Tus vales vuelven cuando se confirma la cancelación. Que se acabe el plazo no los devuelve por sí solo.", "Até a Sunroot aceitar, você pode cancelar. Seus vales voltam quando o cancelamento é confirmado. O fim do prazo não os devolve sozinho."],
  "m08.after": ["After Sunroot accepts", "Después de que Sunroot acepte", "Depois que a Sunroot aceitar"],
  "m08.a1": ["Setup can't be canceled. If lessons are missed, the agreed remedy returns vouchers through the final split.", "La preparación ya no se puede cancelar. Si faltan clases, la solución acordada devuelve vales en el reparto final.", "A preparação não pode mais ser cancelada. Se faltarem aulas, a solução combinada devolve vales na divisão final."],
  "m08.a2": ["If Sunroot changes the terms, you agree again before anything continues.", "Si Sunroot cambia las condiciones, vuelves a aceptar antes de seguir.", "Se a Sunroot mudar as condições, você aceita de novo antes de continuar."],
  "m08.askOnce": ["Your Green Goods account asks once to agree.", "Tu cuenta de Green Goods te pide una firma para aceptar.", "Sua conta do Green Goods pede uma assinatura para aceitar."],
  "m08.agree": ["Agree to These Terms", "Aceptar estas condiciones", "Aceitar estas condições"],
  "m08.twoAccts": ["Two accounts take part", "Participan dos cuentas", "Duas contas participam"],
  "m08.ggRole": ["Agrees, confirms and freezes the final split", "Acepta, confirma y fija el reparto final", "Aceita, confirma e fixa a divisão final"],
  "m08.ggWho": ["Your Green Goods account", "Tu cuenta de Green Goods", "Sua conta do Green Goods"],
  "m08.ggNote": ["Passkey · Arbitrum and Celo", "Clave de acceso · Arbitrum y Celo", "Chave de acesso · Arbitrum e Celo"],
  "m08.gnoRole": ["Holds and deposits the vouchers", "Guarda y deposita los vales", "Guarda e deposita os vales"],
  "m08.gnoWho": ["Your Gnosis wallet", "Tu billetera de Gnosis", "Sua carteira da Gnosis"],
  "m08.gnoNote": ["Connected · holds {v}", "Conectada · tiene {v}", "Conectada · tem {v}"],
  "m08.gnoNone": ["Not connected", "Sin conectar", "Não conectada"],
  "m08.why.t": ["Why two?", "¿Por qué dos?", "Por que duas?"],
  "m08.why.b": ["Your passkey account can't sign on Gnosis yet, so the wallet that holds your vouchers signs the deposit. The escrow records both, so only you can act on this setup.", "Tu cuenta con clave de acceso todavía no puede firmar en Gnosis, así que la billetera que tiene tus vales firma el depósito. El depósito de garantía registra las dos, y solo tú puedes actuar sobre esta preparación.", "Sua conta com chave de acesso ainda não assina na Gnosis, então a carteira que guarda seus vales assina o depósito. O depósito em garantia registra as duas, e só você pode agir sobre esta preparação."],
  "m08.wrong.t": ["This wallet holds 80 Sunroot vouchers", "Esta billetera tiene 80 vales de Sunroot", "Esta carteira tem 80 vales de Sunroot"],
  "m08.wrong.b": ["You need 100. Switch to the wallet that holds them, or get 20 more.", "Necesitas 100. Cambia a la billetera que los tiene o consigue 20 más.", "Você precisa de 100. Troque para a carteira que os guarda ou consiga mais 20."],
  "m08.prepared": ["Setup prepared on Green Goods", "Preparación registrada en Green Goods", "Preparação registrada no Green Goods"],
  "m08.issuerApproves": ["Sunroot approves this setup", "Sunroot aprueba esta preparación", "A Sunroot aprova esta preparação"],
  "m08.issuerApprovesM": ["Sunroot Skills Hub's stewards sign this on Gnosis", "Los responsables de Sunroot Skills Hub lo firman en Gnosis", "Os responsáveis da Sunroot Skills Hub assinam isso na Gnosis"],
  "m08.issuerApproved": ["Sunroot approved this setup", "Sunroot aprobó esta preparación", "A Sunroot aprovou esta preparação"],
  "m08.youDeposit": ["You deposit {v}", "Depositas {v}", "Você deposita {v}"],
  "m08.waitIssuer.t": ["Waiting for Sunroot", "Esperando a Sunroot", "Aguardando a Sunroot"],
  "m08.waitIssuer.b": ["Sunroot approves each setup before the escrow takes vouchers. You'll get a notification; you can close this.", "Sunroot aprueba cada preparación antes de que el depósito de garantía reciba vales. Te avisaremos; puedes cerrar esto.", "A Sunroot aprova cada preparação antes de o depósito em garantia receber vales. Você vai receber uma notificação; pode fechar isto."],
  "m08.deposit": ["Deposit 100 Vouchers", "Depositar 100 vales", "Depositar 100 vales"],
  "m08.network": ["Network", "Red", "Rede"],
  "m08.escrowTo": ["Green Goods voucher escrow for this promise", "Depósito de garantía de vales de Green Goods para esta promesa", "Depósito em garantia de vales do Green Goods para esta promessa"],
  "m08.feeX": ["About 0.0003 xDAI from your wallet", "Unos 0,0003 xDAI de tu billetera", "Cerca de 0,0003 xDAI da sua carteira"],
  "m08.twice": ["Your wallet asks twice: once to let the escrow take 100 vouchers, once to deposit them.", "Tu billetera te pide dos firmas: una para que el depósito de garantía pueda tomar 100 vales y otra para depositarlos.", "Sua carteira pede duas assinaturas: uma para o depósito em garantia poder pegar 100 vales e outra para depositá-los."],
  "m08.unk.t": ["We can't tell if the deposit went through", "No sabemos si el depósito se completó", "Não sabemos se o depósito foi concluído"],
  "m08.unk.b": ["Check the escrow before trying again, so you don't deposit twice.", "Revisa el depósito de garantía antes de intentarlo otra vez, para no depositar dos veces.", "Confira o depósito em garantia antes de tentar de novo, para não depositar duas vezes."],
  "m08.checkEscrow": ["Check Escrow", "Revisar depósito", "Conferir depósito"],
  "m08.deposited": ["Deposited {v}", "Depositaste {v}", "Você depositou {v}"],
  "m08.depositedM": ["On Gnosis · 11:20 AM", "En Gnosis · 11:20", "Na Gnosis · 11:20"],
  "m08.proof": ["Escrow proof reaches Green Goods", "La prueba del depósito llega a Green Goods", "A prova do depósito chega ao Green Goods"],
  "m08.proofM": ["Sent from Gnosis · not received yet", "Enviada desde Gnosis · aún no recibida", "Enviada da Gnosis · ainda não recebida"],
  "m08.acceptBy": ["Sunroot accepts by {d}", "Sunroot acepta antes del {d}", "A Sunroot aceita até {d}"],
  "m08.safe.t": ["Your vouchers are safe in escrow", "Tus vales están a salvo en el depósito de garantía", "Seus vales estão seguros no depósito em garantia"],
  "m08.safe.b": ["Green Goods needs the escrow's proof before Sunroot can accept. This usually takes minutes. A sent message isn't a received one, so this stays here until it arrives.", "Green Goods necesita la prueba del depósito antes de que Sunroot pueda aceptar. Suele tardar minutos. Un mensaje enviado no es uno recibido, así que esto sigue aquí hasta que llegue.", "O Green Goods precisa da prova do depósito antes de a Sunroot aceitar. Costuma levar minutos. Mensagem enviada não é mensagem recebida, então isto fica aqui até chegar."],
  "m08.today1102": ["Today, 11:02 AM", "Hoy, 11:02", "Hoje, 11:02"],
  "m08.ade": ["Ade · 11:05 AM", "Ade · 11:05", "Ade · 11:05"]
});
GG.SCR("M08", {
  surface: "member", journey: "vs", title: "Take up with vouchers: terms, accounts, deposit", prd: "PRD-1297",
  states: [["terms", "Step 1: exact terms and consent", "default"], ["accounts", "Step 2: which account acts", "default"], ["wrongwallet", "Wallet holds too few", "blocked"], ["nowallet", "Gnosis wallet not connected", "unavailable"], ["approval", "Waiting for issuer approval", "pending"], ["deposit", "Step 3: deposit review", "default"], ["depunknown", "Deposit result uncertain", "delayed"], ["wait", "Step 4: waiting for escrow proof", "pending"]],
  notes: {
    who: "Source buyer (Green Goods account, Arbitrum) consents; voucher holder (Gnosis wallet) deposits; issuer authority (issuer Safe on Gnosis) approves the setup.",
    pre: "Offer revision current; holder balance sufficient; issuer not paused (policy). Evidence: terms record, Gnosis balance, issuer approval record.",
    auth: "Consent to the exact revision, voucher amount, remedy, acceptance window and cancellation rules (Arbitrum). Allowance and deposit of the exact amount into the escrow keyed to this promise (Gnosis).",
    out: "Setup prepared, issuer approved, deposit confirmed, escrow evidence received. Each is its own step; a sent message is shown as sent, never as received.",
    rec: "Uncertain deposit: check the escrow before retrying (holder). Missing issuer approval: wait; the holder can cancel the setup. Wrong wallet: switch wallet or get vouchers.",
    facts: "Selected design: consent recorded before core acceptance (upgraded CommitmentPooling acceptance guard). Setup prepared by VoucherEntitlementModule; issuer approval and deposit on GnosisVoucherEscrow / GnosisVoucherAdapter; authenticated escrow evidence over CCIP to Arbitrum. Exact function names: confirm against the reconciliation handoff.",
    tags: ["req", "sel", "open"], dec: ["D5", "D8"]
  },
  stateNotes: {
    terms: { say: "All lifecycle rules are disclosed before consent, including that the cutoff never refunds by itself.", sr: "Dialog \"Take Up with Vouchers\", step 1 of 4." },
    accounts: { say: "Names which account acts at each step; never assumes the passkey works on Gnosis.", sr: "Heading \"Two accounts take part\"." },
    wrongwallet: { say: "Balance check against the connected holder, before any deposit.", sr: "Notice title (assertive)." },
    nowallet: { say: "Connect is the only act.", sr: "Account card announces \"Not connected\"." },
    approval: { say: "Deposit is disabled until the issuer approves; the member can close and is notified.", sr: "\"Waiting for Sunroot\" (polite)." },
    deposit: { say: "Transaction review names network, holder, escrow, exact amount, fee and two prompts.", sr: "Step 3 of 4." },
    depunknown: { say: "Retry is replaced by an escrow check to prevent a second deposit.", sr: "Notice title (assertive)." },
    wait: { say: "Deposit done; evidence in transit; acceptance window shown.", sr: "\"Your vouchers are safe in escrow\" (polite)." }
  },
  render: function (st) {
    var D = GG.D;
    var idx = st === "terms" ? 0 : ["accounts", "wrongwallet", "nowallet"].indexOf(st) >= 0 ? 1 : st === "wait" ? 3 : 2;
    var body = GG.stepper([t("m08.s1"), t("m08.s2"), t("m08.s3"), t("m08.s4")], idx), acts = "";
    if (st === "terms") {
      body += GG.card(GG.facts([[t("m03.service"), "Solar basics course"], [t("m03.howMuch"), t("m07.lessons")], [t("m07.takes"), GG.vN(100), "", "total"], [t("m03.terms"), t("c.versionOn", { n: 2, d: t("c.oct15") })]])) +
        '<p class="h3">' + t("m08.before") + "</p>" + GG.card(GG.ladder([{ s: "todo", t: t("m08.b1") }, { s: "todo", t: t("m08.b2") }, { s: "todo", t: t("m08.b3") }])) +
        '<p class="h3">' + t("m08.after") + "</p>" + GG.card(GG.ladder([{ s: "todo", t: t("m08.a1") }, { s: "todo", t: t("m08.a2") }])) +
        '<p class="small">' + t("m08.askOnce") + "</p>";
      acts = GG.btn(t("m08.agree"), { go: "@accounts" }) + GG.btn(t("c.cancel"), { kind: "secondary", go: "M07@default" });
    } else if (idx === 1) {
      var gnoNote = st === "nowallet" ? t("m08.gnoNone") : t("m08.gnoNote", { v: GG.vN(st === "wrongwallet" ? 80 : 130) });
      body += '<p class="h3">' + t("m08.twoAccts") + "</p>" +
        GG.acct({ role: t("m08.ggRole"), who: t("m08.ggWho"), addr: D.meAddr, icon: "key", note: t("m08.ggNote") }) +
        GG.acct({ role: t("m08.gnoRole"), who: t("m08.gnoWho"), addr: st === "nowallet" ? "-" : D.gnoAddr, icon: "wallet", gno: true, note: gnoNote }) +
        (st === "wrongwallet" ? GG.notice("warn", "alert", t("m08.wrong.t"), t("m08.wrong.b")) : GG.notice("info", "info", t("m08.why.t"), t("m08.why.b")));
      acts = st === "nowallet" ? GG.btn(t("c.connect"), { go: "@accounts" }) : st === "wrongwallet" ? GG.btn(t("c.continue"), { disabled: true }) + GG.btn(t("c.getV"), { kind: "secondary", go: "M14@quote" }) : GG.btn(t("c.continue"), { go: "@approval" }) + GG.btn(t("c.back"), { kind: "secondary", go: "@terms" });
    } else if (st === "approval" || st === "deposit" || st === "depunknown") {
      var appr = st === "approval" ? { s: "now", t: t("m08.issuerApproves"), m: t("m08.issuerApprovesM") } : { s: "done", t: t("m08.issuerApproved"), m: t("m08.ade") };
      body += GG.card(GG.ladder([{ s: "done", t: t("m08.prepared"), m: t("m08.today1102") }, appr, { s: st === "approval" ? "todo" : "now", t: t("m08.youDeposit", { v: GG.vN(100) }) }]));
      if (st === "approval") { body += GG.notice("info", "clock", t("m08.waitIssuer.t"), t("m08.waitIssuer.b")); acts = GG.btn(t("m08.deposit"), { disabled: true }) + GG.btn(t("c.close"), { kind: "secondary", go: "M09@proof" }); }
      else {
        if (st === "depunknown") body += GG.notice("warn", "clock", t("m08.unk.t"), t("m08.unk.b"));
        body += GG.card(GG.facts([[t("m08.network"), "Gnosis"], [t("m05.from"), t("m08.gnoWho"), D.gnoAddr], [t("m05.to"), t("m08.escrowTo"), "0xE5c0…a1F2"], [t("m05.amount"), GG.vN(100), "", "total"], [t("m04.netFee"), t("m08.feeX")]])) + '<p class="small">' + t("m08.twice") + "</p>";
        acts = st === "depunknown" ? GG.btn(t("m08.checkEscrow"), { go: "@wait" }) : GG.btn(t("m08.deposit"), { go: "@wait" }) + GG.btn(t("c.back"), { kind: "secondary", go: "@accounts" });
      }
    } else {
      body += GG.card(GG.ladder([{ s: "done", t: t("m08.prepared"), m: t("m08.today1102") }, { s: "done", t: t("m08.issuerApproved"), m: t("m08.ade") }, { s: "done", t: t("m08.deposited", { v: GG.vN(100) }), m: t("m08.depositedM") },
        { s: "now", t: t("m08.proof"), m: t("m08.proofM") }, { s: "todo", t: t("m08.acceptBy", { d: t("c.oct25cut") }) }])) + GG.notice("info", "shield", t("m08.safe.t"), t("m08.safe.b"));
      acts = GG.btn(t("c.done"), { go: "M09@proof" });
    }
    return GG.screens.M07.render("default") + GG.sheet({ tier: "full", title: t("m08.title"), desc: "Solar basics course, 10 lessons", body: body, acts: acts });
  }
});

/* ---------------- M09 Your voucher promise (holder's page) ---------------- */
GG.T({
  "m09.kind": ["Your promise · {g}", "Tu promesa · {g}", "Sua promessa · {g}"],
  "m09.vouchers": ["Vouchers", "Vales", "Vales"],
  "m09.v1": ["You agreed to version 2", "Aceptaste la versión 2", "Você aceitou a versão 2"],
  "m09.v2": ["Sunroot approved the setup", "Sunroot aprobó la preparación", "A Sunroot aprovou a preparação"],
  "m09.v3": ["{v} in escrow", "{v} en depósito de garantía", "{v} em depósito em garantia"],
  "m09.v4": ["Escrow proof received by Green Goods", "Green Goods recibió la prueba del depósito", "O Green Goods recebeu a prova do depósito"],
  "m09.v5": ["Sunroot accepts", "Sunroot acepta", "A Sunroot aceita"],
  "m09.v5m": ["By {d} · 2 days left", "Antes del {d} · quedan 2 días", "Até {d} · faltam 2 dias"],
  "m09.v5done": ["Sunroot accepted", "Sunroot aceptó", "A Sunroot aceitou"],
  "m09.v5cross": ["Oct 25, 4:58 PM, before your cancellation arrived", "25 oct, 16:58, antes de que llegara tu cancelación", "25 out, 16:58, antes de seu cancelamento chegar"],
  "m09.v5revised": ["Sunroot can't accept until you agree again", "Sunroot no puede aceptar hasta que vuelvas a aceptar", "A Sunroot não pode aceitar até você aceitar de novo"],
  "m09.v5cut": ["Sunroot didn't accept by {d}", "Sunroot no aceptó antes del {d}", "A Sunroot não aceitou até {d}"],
  "m09.v5cancel": ["Cancellation sent", "Cancelación enviada", "Cancelamento enviado"],
  "m09.v5cancelM": ["If Sunroot accepted first, the promise starts instead", "Si Sunroot aceptó antes, la promesa empieza en su lugar", "Se a Sunroot aceitou antes, a promessa começa no lugar"],
  "m09.v6": ["Promise starts on Gnosis", "La promesa empieza en Gnosis", "A promessa começa na Gnosis"],
  "m09.v7": ["Lessons", "Clases", "Aulas"],
  "m09.v7m": ["{n} of 10 reported", "{n} de 10 informadas", "{n} de 10 informadas"],
  "m09.v7done": ["3 of 10 lessons reported", "3 de 10 clases informadas", "3 de 10 aulas informadas"],
  "m09.v7doneM": ["With 3 proofs", "Con 3 pruebas", "Com 3 provas"],
  "m09.v8": ["You review and freeze the final split", "Revisas y fijas el reparto final", "Você revisa e fixa a divisão final"],
  "m09.v8now": ["Sunroot proposes ending early", "Sunroot propone terminar antes", "A Sunroot propõe encerrar antes"],
  "m09.v8done": ["Split frozen", "Reparto fijado", "Divisão fixada"],
  "m09.v9": ["Vouchers move", "Los vales se mueven", "Os vales são transferidos"],
  "m09.canceled": ["Setup canceled", "Preparación cancelada", "Preparação cancelada"],
  "m09.back": ["{v} back in your Gnosis wallet", "{v} de vuelta en tu billetera de Gnosis", "{v} de volta na sua carteira da Gnosis"],
  "m09.inEscrow": ["In escrow", "En depósito de garantía", "Em depósito em garantia"],
  "m09.escrow": ["Escrow", "Depósito de garantía", "Depósito em garantia"],
  "m09.escrowV": ["Green Goods voucher escrow on Gnosis", "Depósito de garantía de vales de Green Goods en Gnosis", "Depósito em garantia de vales do Green Goods na Gnosis"],
  "m09.acceptByK": ["Accept by", "Aceptar antes del", "Aceitar até"],
  "m09.cancel": ["Cancel Setup", "Cancelar preparación", "Cancelar preparação"],
  "m09.cancelBack": ["Cancel and Get Vouchers Back", "Cancelar y recuperar los vales", "Cancelar e receber os vales de volta"],
  "m09.reviewV3": ["Review Version 3", "Revisar la versión 3", "Revisar a versão 3"],
  "m09.reviewSplit": ["Review Final Split", "Revisar el reparto final", "Revisar a divisão final"],
  "m09.p.waitS": ["Waiting for Sunroot", "Esperando a Sunroot", "Aguardando a Sunroot"],
  "m09.p.waitProof": ["Waiting for escrow proof", "Esperando la prueba del depósito", "Aguardando a prova do depósito"],
  "m09.p.agree": ["Agree to new terms", "Acepta las nuevas condiciones", "Aceite as novas condições"],
  "m09.p.cut": ["Not accepted in time", "No se aceptó a tiempo", "Não foi aceita a tempo"],
  "m09.p.canceling": ["Canceling", "Cancelando", "Cancelando"],
  "m09.p.canceled": ["Canceled · vouchers back", "Cancelada · vales devueltos", "Cancelada · vales devolvidos"],
  "m09.p.started": ["Promise under way", "Promesa en curso", "Promessa em andamento"],
  "m09.p.split": ["Final split to review", "Reparto final por revisar", "Divisão final para revisar"],
  "m09.p.moving": ["Vouchers moving", "Vales en movimiento", "Vales em transferência"],
  "m09.p.retry": ["One transfer needs a retry", "Una transferencia necesita reintento", "Uma transferência precisa de nova tentativa"],
  "m09.p.settled": ["Vouchers settled", "Vales liquidados", "Vales liquidados"],
  "m09.rev.t": ["Sunroot changed the terms", "Sunroot cambió las condiciones", "A Sunroot mudou as condições"],
  "m09.rev.b": ["Version 3 moves the start to within 4 weeks. Your vouchers stay in escrow. Sunroot can't accept until you agree to version 3, or you can cancel.", "La versión 3 pasa el inicio a dentro de 4 semanas. Tus vales siguen en depósito de garantía. Sunroot no puede aceptar hasta que aceptes la versión 3, o puedes cancelar.", "A versão 3 muda o início para até 4 semanas. Seus vales continuam em depósito em garantia. A Sunroot não pode aceitar até você aceitar a versão 3, ou você pode cancelar."],
  "m09.cut.t": ["Your vouchers are still in escrow", "Tus vales siguen en depósito de garantía", "Seus vales continuam em depósito em garantia"],
  "m09.cut.b": ["Time running out doesn't return them on its own. Cancel the setup to get all 100 back.", "Que se acabe el plazo no los devuelve por sí solo. Cancela la preparación para recuperar los 100.", "O fim do prazo não os devolve sozinho. Cancele a preparação para receber os 100 de volta."],
  "m09.cp.t": ["Cancellation on its way", "Cancelación en camino", "Cancelamento a caminho"],
  "m09.cp.b": ["Your cancellation and Sunroot's acceptance can cross. Only one counts, and you'll see which here. Your vouchers can't be both returned and used.", "Tu cancelación y la aceptación de Sunroot pueden cruzarse. Solo cuenta una, y verás cuál aquí. Tus vales no pueden devolverse y usarse a la vez.", "Seu cancelamento e o aceite da Sunroot podem se cruzar. Só um vale, e você verá qual aqui. Seus vales não podem ser devolvidos e usados ao mesmo tempo."],
  "m09.cross.t": ["Sunroot accepted first", "Sunroot aceptó primero", "A Sunroot aceitou primeiro"],
  "m09.cross.b": ["Your cancellation arrived after Sunroot accepted, so the promise has started and your cancellation didn't apply. If something's wrong, report a problem.", "Tu cancelación llegó después de que Sunroot aceptara, así que la promesa empezó y tu cancelación no se aplicó. Si algo va mal, informa un problema.", "Seu cancelamento chegou depois do aceite da Sunroot, então a promessa começou e o cancelamento não foi aplicado. Se algo estiver errado, relate um problema."],
  "m09.split.t": ["Sunroot proposed a final split", "Sunroot propuso un reparto final", "A Sunroot propôs uma divisão final"],
  "m09.split.b": ["Sunroot reported 3 of 10 lessons and proposes ending the course early. Review it before anything moves.", "Sunroot informó 3 de 10 clases y propone terminar el curso antes. Revísalo antes de que se mueva nada.", "A Sunroot informou 3 de 10 aulas e propõe encerrar o curso antes. Revise antes de qualquer transferência."],
  "m09.legs": ["Transfers from the escrow", "Transferencias desde el depósito de garantía", "Transferências do depósito em garantia"],
  "m09.toReserve": ["To Sunroot's reserve · {v}", "A la reserva de Sunroot · {v}", "Para a reserva da Sunroot · {v}"],
  "m09.toYou": ["Back to you · {v}", "De vuelta a ti · {v}", "De volta para você · {v}"],
  "m09.sent": ["Sent to Gnosis", "Enviado a Gnosis", "Enviado à Gnosis"],
  "m09.doneG": ["Done on Gnosis", "Hecho en Gnosis", "Concluído na Gnosis"],
  "m09.failed": ["Didn't complete", "No se completó", "Não foi concluída"],
  "m09.failSub": ["Attempt 1 · Oct 30, 2:14 PM · a retry sends the same 60", "Intento 1 · 30 oct, 14:14 · un reintento envía los mismos 60", "Tentativa 1 · 30 out, 14:14 · uma nova tentativa envia os mesmos 60"],
  "m09.lf.t": ["Your 60 vouchers haven't moved yet", "Tus 60 vales todavía no se movieron", "Seus 60 vales ainda não foram transferidos"],
  "m09.lf.b": ["The transfer to Sunroot's reserve finished; yours didn't. Trying again sends exactly 60 to the same wallet. It can't send more.", "La transferencia a la reserva de Sunroot terminó; la tuya no. Reintentar envía exactamente 60 a la misma billetera. No puede enviar más.", "A transferência para a reserva da Sunroot terminou; a sua não. Tentar de novo envia exatamente 60 para a mesma carteira. Não pode enviar mais."],
  "m09.set.t": ["Settled", "Liquidado", "Liquidado"],
  "m09.set.b": ["Both transfers are done. This settles the vouchers only: the promise's own confirmation and any outside service are separate.", "Las dos transferencias terminaron. Esto liquida solo los vales: la confirmación de la promesa y cualquier servicio externo van aparte.", "As duas transferências terminaram. Isso liquida só os vales: a confirmação da promessa e qualquer serviço externo são separados."],
  "m09.oct30": ["Oct 30", "30 oct", "30 out"],
  "m09.canceledM": ["Oct 25, 5:40 PM", "25 oct, 17:40", "25 out, 17:40"]
});
GG.SCR("M09", {
  surface: "member", journey: "vs", title: "Your voucher promise (holder's page)", prd: "PRD-1297",
  states: [["proof", "Escrow proof in transit", "delayed"], ["ready", "Escrow ready, waiting for acceptance", "pending"], ["revised", "Terms revised: fresh consent", "stale"], ["cutoff", "Acceptance window passed", "delayed"], ["cancelpending", "Cancellation pending", "pending"], ["canceled", "Setup refunded", "success"], ["crossed", "Acceptance won the race", "recovery"], ["started", "Accepted and active", "default"], ["lessons", "Delivery reported, split proposed", "pending"], ["moving", "Frozen, transfers in flight", "pending"], ["legfail", "Release done, refund failed", "failure"], ["settled", "Financially closed", "success"]],
  notes: {
    who: "Voucher holder reads. Acts with the Green Goods account (agree again, cancel, report, review split) and, for retries, any account allowed to resend the same command.",
    pre: "Indexed escrow state (Gnosis), evidence receipt and activation acknowledgment (Arbitrum), acceptance state, deliveries with evidence, frozen allocation and per-leg status.",
    auth: "Cancel setup (before acceptance only), agree to a revised version, open the split review, retry a failed leg with unchanged amounts.",
    out: "Source state, destination execution and acknowledgment are shown separately (sent, done on Gnosis, confirmed). Acceptance and setup abort resolve to one outcome.",
    rec: "Cutoff never refunds automatically; the holder cancels. Cancellation may lose the race to acceptance; the page shows which won. After acceptance, only the service remedy applies. A failed leg is retried with the same allocation by the holder or a steward.",
    facts: "GnosisVoucherEscrow: one escrow per promise; setup refund only before activation; one immutable final allocation; independent release and refund legs; terminal only after both settle. Discharged vouchers return to the issuer reserve for reuse within its budget (no burn). Arbitrum side: VoucherEntitlementModule / VoucherRedemptionModule record evidence, activation and freeze.",
    tags: ["req", "sel"], dec: ["D5", "D9"]
  },
  stateNotes: {
    proof: { say: "Deposit confirmed, evidence message not yet received. Cancel is available (pre-acceptance).", sr: "Pill \"Waiting for escrow proof\"." },
    ready: { say: "Acceptance window with the deadline and remaining days.", sr: "None." },
    revised: { say: "Revised terms block acceptance until fresh consent. The UI can't bypass it.", sr: "\"Sunroot changed the terms\" (assertive)." },
    cutoff: { say: "Window passed: vouchers stay in escrow until the holder cancels. No timer refund.", sr: "\"Your vouchers are still in escrow\" (status)." },
    cancelpending: { say: "The race is explained before the outcome is known; no action offered.", sr: "\"Cancellation on its way\" (polite)." },
    canceled: { say: "Authenticated setup refund: all 100 back.", sr: "None." },
    crossed: { say: "Acceptance arrived first; cancellation did not apply; remedy path offered instead of cancel.", sr: "\"Sunroot accepted first\" (assertive)." },
    started: { say: "Report a Problem replaces Cancel Setup after acceptance.", sr: "None." },
    lessons: { say: "Delivery count with evidence; final split proposal opens M10.", sr: "\"Sunroot proposed a final split\" (status)." },
    moving: { say: "Two legs with their own state.", sr: "None." },
    legfail: { say: "One leg done, the other failed; retry restates the fixed amount.", sr: "\"Your 60 vouchers haven't moved yet\" (assertive)." },
    settled: { say: "Financial closure only; not a kept-promise mark, not an external service activation.", sr: "\"Settled\" (polite)." }
  },
  render: function (st) {
    var D = GG.D;
    var S = {
      v1: { s: "done", t: t("m09.v1"), m: t("m08.today1102") }, v2: { s: "done", t: t("m09.v2"), m: t("m08.ade") }, v3: { s: "done", t: t("m09.v3", { v: GG.vN(100) }), m: t("m08.depositedM") },
      v4: { s: "done", t: t("m09.v4") }, v5: { s: "done", t: t("m09.v5done") }, v6: { s: "done", t: t("m09.v6") }, v7: { s: "done", t: t("m09.v7done"), m: t("m09.v7doneM") }, v8: { s: "done", t: t("m09.v8done"), m: t("m09.oct30") }
    };
    var tail = [{ s: "todo", t: t("m09.v6") }, { s: "todo", t: t("m09.v7") }, { s: "todo", t: t("m09.v8") }, { s: "todo", t: t("m09.v9") }];
    var steps, pill, notice = "", bar = [], legs = "";
    switch (st) {
      case "proof": steps = [S.v1, S.v2, S.v3, { s: "now", t: t("m08.proof"), m: t("m08.proofM") }, { s: "todo", t: t("m09.v5"), m: t("c.oct25cut") }].concat(tail); pill = GG.pill("info", t("m09.p.waitProof"));
        notice = GG.notice("info", "shield", t("m08.safe.t"), t("m08.safe.b")); bar = [GG.btn(t("m09.cancel"), { kind: "secondary", go: "@cancelpending" })]; break;
      case "ready": steps = [S.v1, S.v2, S.v3, S.v4, { s: "now", t: t("m09.v5"), m: t("m09.v5m", { d: t("c.oct25cut") }) }].concat(tail); pill = GG.pill("info", t("m09.p.waitS"));
        bar = [GG.btn(t("m09.cancel"), { kind: "secondary", go: "@cancelpending" })]; break;
      case "revised": steps = [S.v1, S.v2, S.v3, S.v4, { s: "warn", t: t("m09.v5revised") }].concat(tail); pill = GG.pill("warn", t("m09.p.agree"));
        notice = GG.notice("warn", "refresh", t("m09.rev.t"), t("m09.rev.b")); bar = [GG.btn(t("m09.reviewV3"), { go: "M08@terms" }), GG.btn(t("m09.cancel"), { kind: "secondary", go: "@cancelpending" })]; break;
      case "cutoff": steps = [S.v1, S.v2, S.v3, S.v4, { s: "warn", t: t("m09.v5cut", { d: t("c.oct25cut") }) }].concat(tail); pill = GG.pill("warn", t("m09.p.cut"));
        notice = GG.notice("warn", "clock", t("m09.cut.t"), t("m09.cut.b")); bar = [GG.btn(t("m09.cancelBack"), { go: "@cancelpending" })]; break;
      case "cancelpending": steps = [S.v1, S.v2, S.v3, S.v4, { s: "now", t: t("m09.v5cancel"), m: t("m09.v5cancelM") }].concat(tail); pill = GG.pill("info", t("m09.p.canceling"));
        notice = GG.notice("info", "clock", t("m09.cp.t"), t("m09.cp.b")); break;
      case "canceled": steps = [S.v1, S.v2, S.v3, S.v4, { s: "done", t: t("m09.canceled"), m: t("m09.canceledM") }, { s: "done", t: t("m09.back", { v: GG.vN(100) }), m: t("c.onGnosis") }]; pill = GG.pill("ok", t("m09.p.canceled")); break;
      case "crossed": steps = [S.v1, S.v2, S.v3, S.v4, { s: "done", t: t("m09.v5done"), m: t("m09.v5cross") }, S.v6, { s: "now", t: t("m09.v7"), m: t("m09.v7m", { n: 0 }) }, tail[2], tail[3]]; pill = GG.pill("info", t("m09.p.started"));
        notice = GG.notice("info", "info", t("m09.cross.t"), t("m09.cross.b")); bar = [GG.btn(t("c.report"), { kind: "secondary" })]; break;
      case "started": steps = [S.v1, S.v2, S.v3, S.v4, S.v5, S.v6, { s: "now", t: t("m09.v7"), m: t("m09.v7m", { n: 0 }) }, tail[2], tail[3]]; pill = GG.pill("info", t("m09.p.started"));
        bar = [GG.btn(t("c.report"), { kind: "secondary" })]; break;
      case "lessons": steps = [S.v1, S.v2, S.v3, S.v4, S.v5, S.v6, S.v7, { s: "now", t: t("m09.v8"), m: t("m09.v8now") }, tail[3]]; pill = GG.pill("warn", t("m09.p.split"));
        notice = GG.notice("warn", "alert", t("m09.split.t"), t("m09.split.b")); bar = [GG.btn(t("m09.reviewSplit"), { go: "M10@review" })]; break;
      default: {
        var done = st === "settled";
        steps = [S.v1, S.v2, S.v3, S.v4, S.v5, S.v6, S.v7, S.v8, { s: done ? "done" : st === "legfail" ? "warn" : "now", t: t("m09.v9") }];
        pill = st === "moving" ? GG.pill("info", t("m09.p.moving")) : st === "legfail" ? GG.pill("warn", t("m09.p.retry")) : GG.pill("ok", t("m09.p.settled"));
        var relPill = st === "moving" ? GG.pill("info", t("m09.sent")) : GG.pill("ok", t("m09.doneG"));
        var refPill = st === "moving" ? GG.pill("info", t("m09.sent")) : st === "legfail" ? GG.pill("err", t("m09.failed")) : GG.pill("ok", t("m09.doneG"));
        legs = GG.sec(t("m09.legs")) + '<div class="mx16">' + GG.card('<div class="legs">' + GG.leg(t("m09.toReserve", { v: GG.num(40) }), relPill) + GG.leg(t("m09.toYou", { v: GG.num(60) }), refPill, st === "legfail" ? t("m09.failSub") : D.gnoAddr) + "</div>") + "</div>";
        notice = st === "legfail" ? GG.notice("warn", "alert", t("m09.lf.t"), t("m09.lf.b")) : done ? GG.notice("ok", "check", t("m09.set.t"), t("m09.set.b")) : "";
        bar = st === "legfail" ? [GG.btn(t("c.tryagain"), { go: "@settled" })] : [];
      }
    }
    var inEscrow = st === "canceled" ? "0" : st === "settled" ? "0" : GG.vN(100);
    return '<div class="screen nobar"><div class="col">' + GG.topnav("", "M13@default") +
      '<div class="ident"><div class="kind">' + ic("ticket", 16) + t("m09.kind", { g: D.sunroot }) + "</div><h1>Solar basics course, 10 lessons</h1>" +
      '<div class="chips">' + pill + "</div>" + notice + "</div>" + legs +
      GG.sec(t("m09.vouchers")) + '<div class="mx16">' + GG.card(GG.ladder(steps)) + "</div>" +
      '<div class="mx16" style="margin-top:12px">' + GG.card(GG.facts([[t("m09.inEscrow"), inEscrow], [t("m09.escrow"), t("m09.escrowV"), "0xE5c0…a1F2"], [t("m09.acceptByK"), t("c.oct25cut")]])) + "</div>" +
      "</div></div>" + (bar.length ? GG.fixedbar(bar) : "");
  }
});

/* ---------------- M10 Review and freeze the final split ---------------- */
GG.T({
  "m10.title": ["Review the Final Split", "Revisa el reparto final", "Revise a divisão final"],
  "m10.delivered": ["Lessons delivered", "Clases dadas", "Aulas dadas"],
  "m10.reports": ["Sunroot reports", "Sunroot informa", "A Sunroot informa"],
  "m10.reportsV": ["{n} of 10 lessons", "{n} de 10 clases", "{n} de 10 aulas"],
  "m10.proofs": ["{n} proofs attached", "{n} pruebas adjuntas", "{n} provas anexadas"],
  "m10.received": ["I received these 3 lessons", "Recibí estas 3 clases", "Recebi estas 3 aulas"],
  "m10.receivedNone": ["I confirm no lessons were delivered", "Confirmo que no se dio ninguna clase", "Confirmo que nenhuma aula foi dada"],
  "m10.yourV": ["Your {v}", "Tus {v}", "Seus {v}"],
  "m10.toReserve": ["To Sunroot's reserve", "A la reserva de Sunroot", "Para a reserva da Sunroot"],
  "m10.reuse": ["Sunroot can reuse these within its budget", "Sunroot puede reutilizarlos dentro de su presupuesto", "A Sunroot pode reutilizá-los dentro do orçamento"],
  "m10.toYou": ["Back to you", "De vuelta a ti", "De volta para você"],
  "m10.toWallet": ["To your Gnosis wallet {a}", "A tu billetera de Gnosis {a}", "Para sua carteira da Gnosis {a}"],
  "m10.total": ["Total", "Total", "Total"],
  "m10.inRemedy.t": ["Within the agreed remedy", "Dentro de la solución acordada", "Dentro da solução combinada"],
  "m10.inRemedy.b": ["Sunroot authorized returning up to 60 vouchers for missed lessons.", "Sunroot autorizó devolver hasta 60 vales por clases no dadas.", "A Sunroot autorizou devolver até 60 vales por aulas não dadas."],
  "m10.noRate": ["Lessons and vouchers are counted separately. This split comes from Sunroot's remedy terms, not a price per lesson.", "Las clases y los vales se cuentan por separado. Este reparto sale de la solución de Sunroot, no de un precio por clase.", "Aulas e vales são contados separadamente. Esta divisão vem da solução da Sunroot, não de um preço por aula."],
  "m10.final.t": ["Freezing is final", "Fijarlo es definitivo", "Fixar é definitivo"],
  "m10.final.b": ["After you freeze, nobody can change these amounts or where they go. Two transfers then run on their own. If one fails, it's retried with these same amounts.", "Cuando lo fijes, nadie podrá cambiar estos importes ni su destino. Después se hacen dos transferencias por separado. Si una falla, se reintenta con los mismos importes.", "Depois de fixar, ninguém pode mudar estes valores nem o destino. Duas transferências acontecem separadamente. Se uma falhar, é repetida com os mesmos valores."],
  "m10.approve": ["I approve {n} delivered lessons and this split.", "Apruebo {n} clases dadas y este reparto.", "Aprovo {n} aulas dadas e esta divisão."],
  "m10.freeze": ["Freeze Split", "Fijar el reparto", "Fixar a divisão"],
  "m10.out.t": ["Sunroot hasn't authorized this return", "Sunroot no autorizó esta devolución", "A Sunroot não autorizou esta devolução"],
  "m10.out.b": ["The proposal returns 70, but Sunroot authorized up to 60. Ask Sunroot to fix the proposal before you freeze.", "La propuesta devuelve 70, pero Sunroot autorizó hasta 60. Pide a Sunroot que corrija la propuesta antes de fijarla.", "A proposta devolve 70, mas a Sunroot autorizou até 60. Peça à Sunroot para corrigir a proposta antes de fixar."],
  "m10.frozen.t": ["Split frozen", "Reparto fijado", "Divisão fixada"],
  "m10.frozen.b": ["These amounts can't change. The transfers start now.", "Estos importes no pueden cambiar. Las transferencias empiezan ahora.", "Estes valores não podem mudar. As transferências começam agora."],
  "m10.lessonLine": ["Lesson {n} · {d} · photo and note", "Clase {n} · {d} · foto y nota", "Aula {n} · {d} · foto e nota"],
  "m10.d21": ["Oct 21", "21 oct", "21 out"], "m10.d23": ["Oct 23", "23 oct", "23 out"], "m10.d28": ["Oct 28", "28 oct", "28 out"]
});
GG.SCR("M10", {
  surface: "member", journey: "vs", title: "Review and freeze the final split (irreversible)", prd: "PRD-1297",
  states: [["review", "Partial: review (unchecked)", "default"], ["ready", "Partial: both confirmations checked", "default"], ["outside", "Proposal outside the remedy", "blocked"], ["full", "Full discharge (10 of 10)", "default"], ["none", "Full return (0 of 10)", "default"], ["signing", "Waiting for signature", "pending"], ["frozen", "Frozen (read-only)", "success"]],
  notes: {
    who: "Voucher holder, as the promise's counterparty, with the Green Goods account. Issuer authority has already authorized the return portion.",
    pre: "Promise accepted and active. Provider reported delivered units with evidence and proposed a split within the agreed remedy, with issuer authorization. Evidence: delivery records and the authorization record.",
    auth: "Two explicit confirmations: delivered service units (3 of 10 lessons), and the full voucher allocation (40 to the issuer reserve, 60 back). Then one irreversible freeze.",
    out: "Pending in the account; success freezes one allocation and starts two independent transfers; failure keeps the review open with inputs intact.",
    rec: "Not Yet routes to the existing not-yet / dispute path. After freeze, amounts and recipients are read-only; only retries of the same legs remain.",
    facts: "One immutable settlement decision per escrow: full discharge, full return or the approved partial split, with delivered + returned = presented. Holder approval is its own record; core Fulfilled, a swap receipt or returned vouchers never substitute for it. Selected design: VoucherRedemptionModule (Arbitrum) freezes; GnosisVoucherEscrow executes. Confirm the freezing account against the reconciliation handoff.",
    tags: ["req", "sel", "open"], dec: ["D9", "D10"]
  },
  stateNotes: {
    review: { say: "Freeze stays disabled until both checkboxes are on. The bar is labeled with both numbers so color is not the only cue.", sr: "Dialog \"Review the Final Split\"; split bar has a text label." },
    ready: { say: "Both confirmations given; the destructive-weight action is the only primary.", sr: "Checkbox states read as checked." },
    outside: { say: "A proposal beyond the issuer's authorized return is blocked before signing.", sr: "\"Sunroot hasn't authorized this return\" (assertive)." },
    full: { say: "Full discharge: all 100 to the reserve, nothing back.", sr: "None." },
    none: { say: "Full return: no lessons, all 100 back; confirmation wording changes.", sr: "None." },
    signing: { say: "Close blocked while signing.", sr: "\"Confirm in your account\" (polite)." },
    frozen: { say: "Read-only facts with a lock; Done returns to the promise page and its legs.", sr: "\"Split frozen\" (polite)." }
  },
  render: function (st) {
    var D = GG.D;
    var n = st === "full" ? 10 : st === "none" ? 0 : 3, a = st === "full" ? 100 : st === "none" ? 0 : st === "outside" ? 30 : 40, b = 100 - a;
    var checked = ["ready", "signing", "frozen", "full", "none"].indexOf(st) >= 0;
    var proofList = n > 0 && n < 10 ? '<div class="tech" style="border-top:0;padding-top:0">' + [1, 2, 3].map(function (i) { return "<span>" + t("m10.lessonLine", { n: i, d: t(["m10.d21", "m10.d23", "m10.d28"][i - 1]) }) + "</span>"; }).join("") + "</div>" : "";
    var body = (st === "frozen" ? GG.notice("ok", "lock", t("m10.frozen.t"), t("m10.frozen.b")) : st === "signing" ? GG.notice("info", "clock", t("c.waitingAccount"), "") : "") +
      '<p class="h3">' + t("m10.delivered") + "</p>" + GG.card(GG.facts([[t("m10.reports"), t("m10.reportsV", { n: n }), n ? t("m10.proofs", { n: n }) : ""]]) + proofList) +
      (st === "frozen" ? "" : GG.chk(checked, n ? t("m10.received") : t("m10.receivedNone"))) +
      '<p class="h3">' + t("m10.yourV", { v: GG.vN(100) }) + "</p>" + GG.splitbar(a, b, 100, t("m10.toReserve"), t("m10.toYou")) +
      GG.card(GG.facts([[t("m10.toReserve"), GG.num(a), t("m10.reuse")], [t("m10.toYou"), GG.num(b), t("m10.toWallet", { a: D.gnoAddr })], [t("m10.total"), GG.num(100), "", "total"]])) +
      (st === "outside" ? GG.notice("err", "xcirc", t("m10.out.t"), t("m10.out.b")) : n > 0 && n < 10 ? GG.notice("ok", "shield", t("m10.inRemedy.t"), t("m10.inRemedy.b")) : "") +
      '<p class="small">' + t("m10.noRate") + "</p>" +
      (st === "frozen" ? "" : GG.notice("warn", "lock", t("m10.final.t"), t("m10.final.b")) + GG.chk(checked, t("m10.approve", { n: n })));
    var acts = st === "frozen" ? GG.btn(t("c.done"), { go: "M09@moving" }) :
      GG.btn(st === "signing" ? t("c.waitingAccount") : t("m10.freeze"), { kind: "danger", go: st === "ready" || st === "full" || st === "none" ? "@frozen" : "", disabled: !(st === "ready" || st === "full" || st === "none") }) +
      GG.btn(t("c.notYet"), { kind: "secondary", disabled: st === "signing" });
    return GG.screens.M09.render("lessons") + GG.sheet({ tier: "full", title: t("m10.title"), desc: "Solar basics course, 10 lessons", body: body, acts: acts });
  }
});
