/* Member PWA: entry screens and the cross-garden personal G$ purchase.
   Sample people, gardens other than Green Goods Community Garden, amounts, fees, dates and
   addresses are fictional. User-authored content (titles, descriptions) stays in its author's
   language, as it would in the product. */
GG.screens = GG.screens || {};
GG.D = {
  me: "Lina", meAddr: "0x3C1e…7A2e", gnoAddr: "0x9A40…41bD", homeSafe: "0xA77c…19F0",
  home: "Riverside Commons Garden", homeShort: "Riverside Commons", ggcg: "Green Goods Community Garden",
  hill: "Hilltop Orchard", vida: "Vida Nova Collective", sunroot: "Sunroot Skills Hub",
  aiTitle: "AI assistant membership, 1 month", aiDesc: "One month of the Green Goods AI assistant for gardeners: field-note help, translation and species lookups. Green Goods sets up access after your request is accepted and paid.", price: 450, gross: 452.26, fee: 2.26, short: 440,
  steward: "Tomás", provSteward: "Joy", issuerSigner: "Ade", ref: "GG-7F3A"
};
/* Relative targets ("@state") resolve to the screen that drew them, even when a screen is drawn
   behind another screen's sheet or dialog. */
GG.SCR = function (id, def) {
  var draw = def.render;
  def.id = id;
  def.render = function (st, ctx) { return draw.call(def, st, ctx).replace(/data-go="@/g, 'data-go="' + id + "@"); };
  GG.screens[id] = def;
};

GG.T({
  "c.close": ["Close", "Cerrar", "Fechar"],
  "c.back": ["Back", "Atrás", "Voltar"],
  "c.tab.home": ["Home", "Inicio", "Início"],
  "c.tab.garden": ["Garden", "Jardín", "Jardim"],
  "c.tab.profile": ["Profile", "Perfil", "Perfil"],
  "c.wallet": ["Wallet", "Billetera", "Carteira"],
  "c.promises": ["Promises", "Promesas", "Promessas"],
  "c.yourwork": ["Your Work", "Tu trabajo", "Seu trabalho"],
  "c.notifications": ["Notifications", "Notificaciones", "Notificações"],
  "c.offline": ["You're offline", "Estás sin conexión", "Você está offline"],
  "c.ws.hub": ["Hub", "Hub", "Hub"],
  "c.ws.garden": ["Garden", "Jardín", "Jardim"],
  "c.ws.community": ["Community", "Comunidad", "Comunidade"],
  "c.ws.actions": ["Actions", "Acciones", "Ações"],
  "c.cancel": ["Cancel", "Cancelar", "Cancelar"],
  "c.continue": ["Continue", "Continuar", "Continuar"],
  "c.tryagain": ["Try Again", "Intentar de nuevo", "Tentar novamente"],
  "c.done": ["Done", "Listo", "Concluído"],
  "c.seeall": ["See all", "Ver todo", "Ver tudo"],
  "c.open": ["Open", "Abierta", "Aberta"],
  "c.approvalNeeded": ["Approval needed", "Requiere aprobación", "Precisa de aprovação"],
  "c.offer": ["Offer", "Ofrecimiento", "Oferta"],
  "c.request": ["Request", "Petición", "Pedido"],
  "c.kept": ["Kept", "Cumplida", "Cumprida"],
  "c.draft": ["Draft", "Borrador", "Rascunho"],
  "c.approved": ["Approved", "Aprobado", "Aprovado"],
  "c.askTakeUp": ["Ask to Take Up", "Pedir aceptarla", "Pedir para aceitá-la"],
  "c.withdraw": ["Withdraw Request", "Retirar solicitud", "Retirar solicitação"],
  "c.confirmKept": ["Confirm Kept", "Confirmar cumplido", "Confirmar cumprido"],
  "c.notYet": ["Not Yet", "Todavía no", "Ainda não"],
  "c.report": ["Report a Problem", "Informar un problema", "Relatar um problema"],
  "c.exploreGardens": ["Explore Gardens", "Explorar jardines", "Explorar jardins"],
  "c.gardener": ["Gardener", "Jardinero", "Jardineiro"],
  "c.stewardRole": ["Steward", "Responsable", "Responsável"],
  "c.awaiting": ["Awaiting review", "En revisión", "Em análise"],
  "c.gathering": ["Gathering…", "Reuniendo…", "Reunindo…"],
  "c.waitingAccount": ["Confirm in your account", "Confírmalo en tu cuenta", "Confirme na sua conta"],
  "c.viewCeloscan": ["View on Celoscan", "Ver en Celoscan", "Ver no Celoscan"],
  "c.version": ["Version {n}", "Versión {n}", "Versão {n}"],
  "c.versionOn": ["Version {n} · {d}", "Versión {n} · {d}", "Versão {n} · {d}"],
  "c.oct18": ["Oct 18", "18 oct", "18 out"],
  "c.oct15": ["Oct 15", "15 oct", "15 out"],
  "c.oct23": ["Oct 23", "23 oct", "23 out"],
  "c.oct22t": ["Oct 22, 11:30 AM", "22 oct, 11:30", "22 out, 11:30"]
});

/* ---------------- M01 Home ---------------- */
GG.T({
  "m01.recent": ["Recent Activity", "Actividad reciente", "Atividade recente"],
  "m01.continue": ["Continue", "Continuar", "Continuar"],
  "m01.takePart": ["Take Part", "Participa", "Participe"],
  "m01.d.approved": ["Tomás · 2h ago", "Tomás · hace 2 h", "Tomás · há 2 h"],
  "m01.d.kept": ["You received 300.00 G$ · Oct 19", "Recibiste 300,00 G$ · 19 oct", "Você recebeu 300,00 G$ · 19 out"],
  "m01.d.req": ["Pays 120 G$ + 20 Sunroot vouchers", "Paga 120 G$ + 20 vales de Sunroot", "Paga 120 G$ + 20 vales de Sunroot"],
  "m01.d.draft": ["Saved on this phone", "Guardado en este teléfono", "Salvo neste celular"],
  "m01.promisesHere": ["Promises in this garden", "Promesas en este jardín", "Promessas neste jardim"],
  "m01.d.promisesHere": ["4 open · 1 takes vouchers", "4 abiertas · 1 acepta vales", "4 abertas · 1 aceita vales"],
  "m01.otherGardens": ["What other gardens offer", "Lo que ofrecen otros jardines", "O que outros jardins oferecem"],
  "m01.d.otherGardens": ["Visiting doesn't change your garden", "Visitar no cambia tu jardín", "Visitar não muda seu jardim"],
  "m01.toast": ["Your payment needs you: send the rest", "Tu pago te necesita: envía lo que falta", "Seu pagamento precisa de você: envie o restante"]
});
GG.SCR("M01", {
  surface: "member", journey: "entry", title: "Home (active garden)", entry: true, prd: "PRD-1297",
  states: [["default", "Lina's Home", "default"], ["needs", "Wallet badge: purchase needs Lina", "pending"], ["offline", "Offline", "offline"]],
  notes: {
    who: "Gardener (buyer and voucher holder), Green Goods account.",
    pre: "Active garden from the device preference (PWA hub lock 8). Rows from the garden-scoped indexer queries.",
    auth: "Nothing. Entry screen.",
    out: "Rows open their records. The wallet launcher's badge counts personal purchases and voucher setups that need the member.",
    rec: "Offline: the shell's strip overlays the header; nothing below it moves (DL-085 / PWA lock).",
    facts: "No new reads on Home. The wallet badge reads the member's purchase and escrow states (account-scoped, not garden-scoped).",
    tags: ["ui"], dec: ["D2"]
  },
  stateNotes: {
    default: { say: "Unchanged Home journal. Voucher terms appear only as a request's detail line (\"Pays 120 G$ + 20 Sunroot vouchers\"); unlike assets are never summed.", sr: "None (page load)." },
    needs: { say: "A personal purchase that needs the member raises a count on the Wallet launcher, not in Continue (which keeps drafts and uploads) and not in Promises (scoped to the active garden; the purchase lives in another garden's pool).", sr: "Badge label: \"Wallet, 1 needs you\"." },
    offline: { say: "Offline strip. Purchases and voucher actions never queue (see M04, M05, M14).", sr: "\"You're offline\" from the shell's live region." }
  },
  render: function (st) {
    var D = GG.D;
    var h = (st === "offline" ? GG.offline() : "") + '<div class="screen"><div class="col">' +
      GG.homeHeader({ wb: st === "needs" ? 1 : 0, pb: 0, yb: 1, wgo: "M13@default", pgo: "M16@default" }) +
      GG.sec(t("m01.recent"), '<span class="link">' + t("c.seeall") + "</span>") +
      '<div class="list">' +
      GG.row({ icon: "work", title: "Compost bay turned", pill: ["ok", t("c.approved")], detail: t("m01.d.approved"), edge: "ok" }) +
      GG.row({ icon: "promise", title: "Teach the seed-saving course", pill: ["ok", t("c.kept")], detail: t("m01.d.kept") }) +
      GG.row({ icon: "request", tileKind: "req", title: "Teach two compost workshops", pill: ["info", t("c.open")], detail: t("m01.d.req"), go: "M15@open" }) +
      "</div>" + GG.sec(t("m01.continue")) + '<div class="list">' +
      GG.row({ icon: "work", title: "Mulch the north beds", pill: ["neu", t("c.draft")], detail: t("m01.d.draft") }) +
      "</div>" + GG.sec(t("m01.takePart")) + '<div class="list">' +
      GG.row({ icon: "promise", title: t("m01.promisesHere"), detail: t("m01.d.promisesHere"), go: "M16@default" }) +
      GG.row({ icon: "globe", title: t("m01.otherGardens"), detail: t("m01.d.otherGardens"), go: "M02@ggcg" }) +
      "</div></div></div>" + GG.appbar(0);
    return h;
  }
});

/* ---------------- M02 Visiting another garden ---------------- */
GG.T({
  "m02.visiting": ["Visiting · your garden is still {g}", "De visita · tu jardín sigue siendo {g}", "Visitando · seu jardim continua sendo {g}"],
  "m02.tab.promises": ["Promises", "Promesas", "Promessas"],
  "m02.tab.work": ["Work", "Trabajo", "Trabalho"],
  "m02.tab.about": ["About", "Acerca de", "Sobre"],
  "m02.d.ai": ["450 G$ · your own G$ · approval needed", "450 G$ · tus propios G$ · requiere aprobación", "450 G$ · seus próprios G$ · precisa de aprovação"],
  "m02.d.web": ["Garden payment only", "Solo pago del jardín", "Somente pagamento do jardim"],
  "m02.d.translate": ["Pays 200 G$", "Paga 200 G$", "Paga 200 G$"],
  "m02.d.solar": ["Takes 100 Sunroot vouchers", "Acepta 100 vales de Sunroot", "Aceita 100 vales de Sunroot"],
  "m02.d.battery": ["Takes 20 Sunroot vouchers · 6 places left", "Acepta 20 vales de Sunroot · quedan 6 plazas", "Aceita 20 vales de Sunroot · restam 6 vagas"]
});
GG.SCR("M02", {
  surface: "member", journey: "entry", title: "Visiting a provider garden", entry: true, prd: "PRD-1297",
  states: [["ggcg", "Green Goods Community Garden (AI membership)", "default"], ["sunroot", "Sunroot Skills Hub (voucher offers)", "default"], ["loading", "Loading", "loading"]],
  notes: {
    who: "Gardener, visiting. Any account can view.",
    pre: "Opened from Explore or a link. Visiting never changes the active garden (PWA hub lock 6).",
    auth: "Nothing.",
    out: "Offer rows show how they can be paid: garden payment, the member's own G$, or vouchers (issuer and amount).",
    rec: "Loading keeps the list header's height with \"Gathering…\" (DL-056).",
    facts: "Offer payment terms: the opted-in personal G$ route flag on the Individual Offer (upgraded CommitmentPooling) and accepted-voucher terms (VoucherEntitlementModule terms record), both indexed per offer and revision.",
    tags: ["sel", "ui"]
  },
  stateNotes: {
    ggcg: { say: "The AI membership offer shows its price and both route facts in the detail line: own G$ accepted, approval needed.", sr: "None." },
    sunroot: { say: "Voucher offers name issuer and amount (\"Takes 100 Sunroot vouchers\"). No G$ equivalent is shown.", sr: "None." },
    loading: { say: "Skeleton rows hold the loaded layout.", sr: "\"Gathering promises\" (polite)." }
  },
  render: function (st) {
    var D = GG.D, sun = st === "sunroot";
    var name = sun ? D.sunroot : D.ggcg;
    var rows = st === "loading" ? [1, 2, 3].map(function () { return '<div class="row" style="cursor:default"><div class="tile"></div><div class="body"><div class="skel" style="width:70%"></div><div class="skel" style="width:30%;height:18px;border-radius:999px"></div><div class="skel" style="width:50%"></div></div></div>'; }).join("") :
      sun ? GG.row({ icon: "offer", title: "Solar basics course, 10 lessons", pill: ["ok", t("c.open")], detail: t("m02.d.solar"), go: "M07@default" }) +
        GG.row({ icon: "offer", title: "Battery safety workshop", pill: ["ok", t("c.open")], detail: t("m02.d.battery") }) :
        GG.row({ icon: "offer", title: D.aiTitle, pill: ["ok", t("c.open")], detail: t("m02.d.ai"), go: "M03@default" }) +
        GG.row({ icon: "offer", title: "Website check-up, 1 hour", pill: ["ok", t("c.open")], detail: t("m02.d.web") }) +
        GG.row({ icon: "request", tileKind: "req", title: "Translate the field guide to Portuguese", pill: ["info", t("c.open")], detail: t("m02.d.translate") });
    return '<div class="screen nobar"><div class="col"><div class="banner"><div class="over"><button type="button" class="rb" aria-label="' + t("c.back") + '"' + GG.go("M01@default") + ">" + ic("back", 18) + '</button><span class="rb">' + ic("ext", 18) + "</span></div></div>" +
      '<div class="gtitle"><h1>' + name + '</h1><div class="visit">' + ic("info", 14) + t("m02.visiting", { g: D.homeShort }) + "</div></div>" +
      '<div class="gtabs"><span class="on">' + t("m02.tab.promises") + "</span><span>" + t("m02.tab.work") + "</span><span>" + t("m02.tab.about") + "</span></div>" +
      '<div style="height:12px"></div>' + (st === "loading" ? '<div class="countline" style="padding:0 16px 8px;font-size:14px;color:var(--muted)">' + t("c.gathering") + "</div>" : "") +
      '<div class="list">' + rows + "</div></div></div>";
  }
});

/* ---------------- M03 Offer that takes the member's own G$ ---------------- */
GG.T({
  "m03.kind": ["Offer · {g}", "Ofrecimiento · {g}", "Oferta · {g}"],
    "m03.whatYouGet": ["What you get", "Lo que recibes", "O que você recebe"],
  "m03.service": ["Service", "Servicio", "Serviço"],
  "m03.howMuch": ["How much", "Cuánto", "Quanto"],
  "m03.howMuchV": ["1 month, for 1 person", "1 mes, para 1 persona", "1 mês, para 1 pessoa"],
  "m03.terms": ["Terms", "Condiciones", "Condições"],
  "m03.price": ["Price", "Precio", "Preço"],
  "m03.howPay": ["How you pay", "Cómo pagas", "Como você paga"],
  "m03.ownG": ["With your own G$", "Con tus propios G$", "Com seus próprios G$"],
  "m03.ownGsub": ["You pay from your wallet. Your home garden's stewards hold the payment until the promise settles. You don't need to join Green Goods Community Garden.", "Pagas desde tu billetera. Los responsables de tu jardín guardan el pago hasta que la promesa se cierre. No necesitas unirte a Green Goods Community Garden.", "Você paga pela sua carteira. Os responsáveis do seu jardim guardam o pagamento até a promessa ser encerrada. Você não precisa entrar no Green Goods Community Garden."],
  "m03.approval": ["Green Goods Community Garden reviews each request before it starts.", "Green Goods Community Garden revisa cada solicitud antes de empezar.", "O Green Goods Community Garden analisa cada solicitação antes de começar."],
  "m03.noGarden.t": ["Join a garden first", "Primero únete a un jardín", "Primeiro entre em um jardim"],
  "m03.noGarden.b": ["To pay with your own G$, you need a home garden. Its stewards hold your payment until the promise settles.", "Para pagar con tus propios G$ necesitas un jardín. Sus responsables guardan tu pago hasta que la promesa se cierre.", "Para pagar com seus próprios G$ você precisa de um jardim. Os responsáveis dele guardam seu pagamento até a promessa ser encerrada."],
  "m03.routeOff.t": ["This offer takes garden payments only", "Este ofrecimiento solo acepta pagos de jardines", "Esta oferta só aceita pagamentos de jardins"],
  "m03.routeOff.b": ["A steward of your garden can take it up for the garden.", "Un responsable de tu jardín puede aceptarlo para el jardín.", "Um responsável do seu jardim pode aceitá-la para o jardim."],
  "m03.paused.t": ["Not taking new promises right now", "Ahora no acepta promesas nuevas", "Não está aceitando novas promessas agora"],
  "m03.paused.b": ["Green Goods Community Garden paused new promises. Nothing you hold is affected.", "Green Goods Community Garden pausó las promesas nuevas. No afecta a nada de lo que tienes.", "O Green Goods Community Garden pausou novas promessas. Nada do que você tem é afetado."],
  "m03.stale.t": ["We couldn't refresh this offer", "No pudimos actualizar este ofrecimiento", "Não conseguimos atualizar esta oferta"],
  "m03.stale.b": ["The price or terms may have changed since 9:40 AM. Refresh before you ask.", "El precio o las condiciones pueden haber cambiado desde las 9:40. Actualiza antes de pedir.", "O preço ou as condições podem ter mudado desde 9:40. Atualize antes de pedir."]
});
GG.SCR("M03", {
  surface: "member", journey: "gd", title: "Offer that takes your own G$", prd: "PRD-1297",
  states: [["default", "Open, own-G$ route", "default"], ["nogarden", "No home garden", "unavailable"], ["routeoff", "Route not offered", "unavailable"], ["paused", "Provider pool paused", "paused"], ["stale", "Couldn't refresh", "stale"]],
  notes: {
    who: "Gardener (prospective buyer), Green Goods account. Viewing needs no membership in the provider garden.",
    pre: "Offer is Offered, approval-gated, and the provider opted in to the personal G$ route for this Individual Offer. Evidence: indexed offer record at its current terms revision.",
    auth: "Nothing yet. Reads exact terms, service units and price.",
    out: "Ask to Take Up opens the payment setup (M04).",
    rec: "Stale: the primary stays off until a fresh read succeeds; stale data never enables payment.",
    facts: "Upgraded CommitmentPooling: opted-in personal G$ route flag and approval gate on the Individual Offer; terms revision id and terms CID. Price in G$ (consideration). No USD figure anywhere.",
    tags: ["req", "sel"], dec: []
  },
  stateNotes: {
    default: { say: "Price is in G$ only. The route card says who holds the payment (home garden stewards) before anything is signed.", sr: "None." },
    nogarden: { say: "The buyer must belong to a home garden; joining the provider garden is not required.", sr: "Notice title read on arrival (status)." },
    routeoff: { say: "Provider did not opt in: no personal route, and no hint of one.", sr: "Notice title (status)." },
    paused: { say: "Pool paused: action disabled, existing promises unaffected.", sr: "Notice title (status)." },
    stale: { say: "Last good read is shown with its time; Ask is disabled until Try Again succeeds.", sr: "\"We couldn't refresh this offer\" (status)." }
  },
  render: function (st) {
    var D = GG.D;
    var notice = st === "nogarden" ? GG.notice("warn", "alert", t("m03.noGarden.t"), t("m03.noGarden.b"), GG.btn(t("c.exploreGardens"), { kind: "secondary", compact: true })) :
      st === "routeoff" ? GG.notice("info", "info", t("m03.routeOff.t"), t("m03.routeOff.b")) :
      st === "paused" ? GG.notice("warn", "pause", t("m03.paused.t"), t("m03.paused.b")) :
      st === "stale" ? GG.notice("warn", "refresh", t("m03.stale.t"), t("m03.stale.b"), GG.btn(t("c.tryagain"), { kind: "secondary", compact: true, go: "@default" })) : "";
    var bar = st === "routeoff" ? "" : GG.fixedbar([GG.btn(t("c.askTakeUp"), { go: "M04@garden", disabled: st !== "default" })]);
    return '<div class="screen nobar"><div class="col">' + GG.topnav("", "M02@ggcg") +
      '<div class="ident"><div class="kind">' + ic("offer", 16) + t("m03.kind", { g: D.ggcg }) + "</div><h1>" + D.aiTitle + '</h1><div class="chips">' + GG.pill("ok", t("c.open")) + GG.pill("neu", t("c.approvalNeeded")) + "</div>" +
      '<p class="para">' + GG.D.aiDesc + "</p>" + notice + "</div>" +
      GG.sec(t("m03.whatYouGet")) + '<div class="mx16">' + GG.card(GG.facts([
        [t("m03.service"), "AI assistant membership"], [t("m03.howMuch"), t("m03.howMuchV")],
        [t("m03.terms"), '<span class="link">' + t("c.versionOn", { n: 3, d: t("c.oct18") }) + "</span>"], [t("m03.price"), GG.gd(D.price), "", "total"]
      ])) + "</div>" +
      (st === "routeoff" ? "" : GG.sec(t("m03.howPay")) + '<div class="mx16">' + GG.card('<div class="cardpad"><div class="h3" style="display:flex;gap:8px;align-items:center">' + ic("coins", 18) + t("m03.ownG") + '</div><p class="para">' + t("m03.ownGsub") + '</p><p class="small">' + t("m03.approval") + "</p></div>") + "</div>") +
      "</div></div>" + bar;
  }
});

/* ---------------- M04 Pay with your G$: setup and consent ---------------- */
GG.T({
  "m04.title": ["Pay with Your G$", "Pagar con tus G$", "Pagar com seus G$"],
  "m04.s1": ["Garden", "Jardín", "Jardim"], "m04.s2": ["Details", "Detalles", "Detalhes"], "m04.s3": ["Review", "Revisión", "Revisão"],
  "m04.whichGarden": ["Which garden holds your payment?", "¿Qué jardín guarda tu pago?", "Qual jardim guarda seu pagamento?"],
  "m04.whichGardenSub": ["Its stewards check that your payment arrived and hold it for this promise.", "Sus responsables comprueban que tu pago llegó y lo guardan para esta promesa.", "Os responsáveis dele confirmam que seu pagamento chegou e o guardam para esta promessa."],
  "m04.activeGarden": ["Your active garden", "Tu jardín activo", "Seu jardim ativo"],
  "m04.youSteward": ["You steward this garden", "Eres responsable de este jardín", "Você é responsável por este jardim"],
  "m04.pendingSub": ["Your request to join is waiting. Pick a garden you belong to.", "Tu solicitud para unirte está pendiente. Elige un jardín al que pertenezcas.", "Sua solicitação para entrar está pendente. Escolha um jardim do qual você faz parte."],
  "m04.provNote": ["Green Goods Community Garden provides the service. You don't need to join it.", "Green Goods Community Garden presta el servicio. No necesitas unirte.", "O Green Goods Community Garden presta o serviço. Você não precisa entrar nele."],
  "m04.none.t": ["No garden can hold this payment", "Ningún jardín puede guardar este pago", "Nenhum jardim pode guardar este pagamento"],
  "m04.none.b": ["You aren't a member of a garden yet. Join one to pay with your own G$.", "Todavía no eres miembro de ningún jardín. Únete a uno para pagar con tus propios G$.", "Você ainda não faz parte de nenhum jardim. Entre em um para pagar com seus próprios G$."],
  "m04.recipient": ["Who gets the service", "Quién recibe el servicio", "Quem recebe o serviço"],
  "m04.you": ["You", "Tú", "Você"],
  "m04.giftLater": ["Buying for someone else isn't available yet.", "Todavía no se puede comprar para otra persona.", "Ainda não é possível comprar para outra pessoa."],
  "m04.refundTo": ["Where refunds go", "A dónde van los reembolsos", "Para onde vão os reembolsos"],
  "m04.refundAcct": ["Your account on Celo", "Tu cuenta en Celo", "Sua conta na Celo"],
  "m04.refundNote": ["Refunds go back to the account you pay from.", "Los reembolsos vuelven a la cuenta desde la que pagas.", "Os reembolsos voltam para a conta de onde você paga."],
  "m04.extra": ["If more than {p} arrives, {g} may keep the extra as a top-up.", "Si llega más de {p}, {g} puede quedarse lo que sobre como recarga.", "Se chegar mais de {p}, o {g} pode ficar com o excedente como reforço."],
  "m04.extraNote": ["Leave this off to get any extra back.", "Déjalo sin marcar para recuperar lo que sobre.", "Deixe desmarcado para receber o excedente de volta."],
  "m04.summary": ["What you're agreeing to", "Lo que aceptas", "O que você está aceitando"],
  "m04.provider": ["Provider", "Proveedor", "Prestador"],
  "m04.heldBy": ["Held by", "Lo guarda", "Guardado por"],
  "m04.heldByV": ["{g} stewards", "Responsables de {g}", "Responsáveis do {g}"],
  "m04.serviceFor": ["Service for", "Servicio para", "Serviço para"],
  "m04.payment": ["Payment", "Pago", "Pagamento"],
  "m04.youSend": ["You send", "Envías", "Você envia"],
  "m04.tokenFee": ["G$ token fee", "Comisión del token G$", "Taxa do token G$"],
  "m04.tokenFeeNote": ["Read from the token when you send", "Se consulta al token cuando envías", "Consultada no token quando você envia"],
  "m04.receives": ["{g} receives", "{g} recibe", "{g} recebe"],
  "m04.netFee": ["Network fee", "Comisión de red", "Taxa de rede"],
  "m04.covered": ["Covered by Green Goods", "La cubre Green Goods", "Coberta pelo Green Goods"],
  "m04.ifExtra": ["If extra arrives", "Si llega de más", "Se chegar a mais"],
  "m04.extraBack": ["Comes back to you", "Vuelve a ti", "Volta para você"],
  "m04.custodyT": ["Where your G$ waits", "Dónde esperan tus G$", "Onde seus G$ ficam"],
  "m04.custodyB": ["You send G$ on Celo to {g}'s shared account, a Safe its stewards control. It stays set aside for this promise until it pays the provider's team or comes back to you. Your garden's stewards hold it; code alone doesn't lock it.", "Envías G$ en Celo a la cuenta compartida de {g}, un Safe que controlan sus responsables. Queda reservado para esta promesa hasta que pague al equipo del proveedor o vuelva a ti. Lo guardan los responsables de tu jardín; el código por sí solo no lo bloquea.", "Você envia G$ na Celo para a conta compartilhada do {g}, um Safe controlado pelos responsáveis. O valor fica reservado para esta promessa até pagar a equipe do prestador ou voltar para você. Os responsáveis do seu jardim o guardam; o código sozinho não o bloqueia."],
  "m04.next": ["What happens next", "Qué pasa después", "O que acontece depois"],
  "m04.n1": ["You agree to these exact terms", "Aceptas estas condiciones exactas", "Você aceita estas condições exatas"],
  "m04.n2": ["You send G$ on Celo", "Envías G$ en Celo", "Você envia G$ na Celo"],
  "m04.n3": ["A {g} steward checks it arrived", "Un responsable de {g} comprueba que llegó", "Um responsável do {g} confirma que chegou"],
  "m04.n4": ["Green Goods Community Garden decides", "Green Goods Community Garden decide", "O Green Goods Community Garden decide"],
  "m04.n5": ["Paid out when you confirm, or the full recorded amount comes back", "Se paga cuando lo confirmas, o vuelve el importe registrado completo", "É pago quando você confirma, ou o valor registrado volta inteiro"],
  "m04.prompts": ["Your account asks twice: once to agree, once to send.", "Tu cuenta te pedirá dos firmas: una para aceptar y otra para enviar.", "Sua conta vai pedir duas assinaturas: uma para aceitar e outra para enviar."],
  "m04.agree": ["Agree and Continue", "Aceptar y continuar", "Aceitar e continuar"],
  "m04.waiting": ["Waiting for your account…", "Esperando a tu cuenta…", "Aguardando sua conta…"],
  "m04.waitingB": ["Your account is asking you to agree to version 3.", "Tu cuenta te pide aceptar la versión 3.", "Sua conta está pedindo que você aceite a versão 3."],
  "m04.rej.t": ["Nothing was agreed", "No se aceptó nada", "Nada foi aceito"],
  "m04.rej.b": ["You canceled the signature. Nothing was agreed or sent.", "Cancelaste la firma. No se aceptó ni se envió nada.", "Você cancelou a assinatura. Nada foi aceito nem enviado."],
  "m04.changed.t": ["This offer just changed", "Este ofrecimiento acaba de cambiar", "Esta oferta acabou de mudar"],
  "m04.changed.b": ["It's now version 4, at 480.00 G$. Review the new terms before you agree.", "Ahora es la versión 4, por 480,00 G$. Revisa las nuevas condiciones antes de aceptar.", "Agora é a versão 4, por 480,00 G$. Revise as novas condições antes de aceitar."],
  "m04.reviewV4": ["Review Version 4", "Revisar la versión 4", "Revisar a versão 4"],
  "m04.off.t": ["Payments wait for a connection", "Los pagos esperan a tener conexión", "Pagamentos esperam a conexão"],
  "m04.off.b": ["You're offline. Agreements and payments never wait in the queue. Continue when you're back online.", "Estás sin conexión. Los acuerdos y pagos nunca quedan en cola. Continúa cuando vuelvas a tener conexión.", "Você está offline. Acordos e pagamentos nunca ficam na fila. Continue quando estiver online de novo."]
});
GG.SCR("M04", {
  surface: "member", journey: "gd", title: "Pay with your G$: garden, details, consent", prd: "PRD-1297",
  states: [["garden", "Step 1: buyer garden", "default"], ["none", "No eligible garden", "empty"], ["details", "Step 2: recipient, refunds, extra", "default"], ["review", "Step 3: review and agree", "default"], ["signing", "Waiting for signature", "pending"], ["rejected", "Signature canceled", "rejected"], ["changed", "Terms changed while reviewing", "stale"], ["offline", "Offline", "offline"]],
  notes: {
    who: "Buyer (gardener) with their Green Goods account. The buyer garden is one where they hold a member role; the provider garden is not required.",
    pre: "Offer opted in and approval-gated; buyer garden has an active registered Celo Safe (settlement account). Evidence: indexed garden roles and settlement account registry.",
    auth: "Exact consent: provider, buyer garden, service recipient, terms revision, service units, price, refund destination and the top-up choice. Signed once on Arbitrum (claim with pledge).",
    out: "Pending: account prompt. Success: request recorded with a pledge (funding Pledged). Failure: nothing recorded; inputs kept.",
    rec: "Rejected or changed terms: buyer retries; consent is never reused across revisions. Offline: the primary is disabled; nothing queues.",
    facts: "Upgraded CommitmentPooling claim records consent to the exact revision; upgraded SettlementModule records the pledge (buyer garden, expected net amount, immutable refund account, top-up consent). Token fee read live from canonical G$ before showing the gross.",
    tags: ["req", "sel", "ui"], dec: ["D3", "D6"]
  },
  stateNotes: {
    garden: { say: "Only gardens where the member holds a role are selectable; a pending join request is shown but disabled with its reason.", sr: "Radio group \"Which garden holds your payment?\"." },
    none: { say: "Empty state in the step's content region (DL-035).", sr: "Empty-state title (status)." },
    details: { say: "Recipient is the buyer in this slice; refund destination is the paying account; the top-up checkbox is off by default (only an express choice keeps extra).", sr: "Checkbox announces its full sentence." },
    review: { say: "One screen holds every consented fact, the gross, fee and net, custody in plain words, the order of events and the prompt count.", sr: "Heading \"What you're agreeing to\"; totals read as label and value." },
    signing: { say: "Primary shows progress and stays focusable; close is blocked while in flight.", sr: "\"Confirm in your account\" (polite)." },
    rejected: { say: "Nothing recorded; the same review returns with inputs intact.", sr: "\"Nothing was agreed\" (status)." },
    changed: { say: "A revision bump during review invalidates the screen; consent is never carried across revisions.", sr: "\"This offer just changed\" (assertive)." },
    offline: { say: "Monetary actions don't queue offline; the job queue is not used for this flow.", sr: "\"Payments wait for a connection\" (status)." }
  },
  render: function (st) {
    var D = GG.D;
    var stepIdx = st === "garden" || st === "none" ? 0 : st === "details" ? 1 : 2;
    var body = GG.stepper([t("m04.s1"), t("m04.s2"), t("m04.s3")], stepIdx), acts = "";
    if (st === "garden") {
      body += '<div><p class="h3">' + t("m04.whichGarden") + '</p><p class="small">' + t("m04.whichGardenSub") + "</p></div>" +
        GG.choice({ on: true, title: D.home, sub: t("m04.activeGarden"), chip: t("c.gardener") }) +
        GG.choice({ title: D.hill, sub: t("m04.youSteward"), chip: t("c.stewardRole") }) +
        GG.choice({ off: true, title: D.vida, sub: t("m04.pendingSub"), chip: t("c.awaiting") }) +
        '<p class="small">' + ic("info", 14) + " " + t("m04.provNote") + "</p>";
      acts = GG.btn(t("c.continue"), { go: "@details" });
    } else if (st === "none") {
      body += '<div style="display:grid;justify-items:center;gap:10px;text-align:center;padding:40px 12px"><div class="tile" style="border-radius:20px;width:72px;height:72px">' + ic("plant", 28) + '</div><p class="h3">' + t("m04.none.t") + '</p><p class="para">' + t("m04.none.b") + "</p></div>";
      acts = GG.btn(t("c.exploreGardens"), {});
    } else if (st === "details") {
      body += '<p class="h3">' + t("m04.recipient") + "</p>" + GG.acct({ role: t("m04.serviceFor"), who: t("m04.you") + " · " + D.me, addr: "lina.greengoods.eth" }) + '<p class="small">' + t("m04.giftLater") + "</p>" +
        '<p class="h3">' + t("m04.refundTo") + "</p>" + GG.acct({ role: t("m04.refundAcct"), who: D.me, addr: D.meAddr, icon: "key", note: t("m04.refundNote") }) +
        GG.chk(false, t("m04.extra", { p: GG.gd(D.price), g: D.homeShort })) + '<p class="small">' + t("m04.extraNote") + "</p>";
      acts = GG.btn(t("c.continue"), { go: "@review" }) + GG.btn(t("c.back"), { kind: "secondary", go: "@garden" });
    } else {
      var lead = st === "signing" ? GG.notice("info", "clock", t("m04.waiting"), t("m04.waitingB")) :
        st === "rejected" ? GG.notice("warn", "alert", t("m04.rej.t"), t("m04.rej.b")) :
        st === "changed" ? GG.notice("warn", "refresh", t("m04.changed.t"), t("m04.changed.b")) :
        st === "offline" ? GG.notice("", "globe", t("m04.off.t"), t("m04.off.b")) : "";
      body += lead + '<p class="h3">' + t("m04.summary") + "</p>" + GG.card(GG.facts([
        [t("m04.provider"), D.ggcg], [t("m04.heldBy"), t("m04.heldByV", { g: D.homeShort })], [t("m04.serviceFor"), t("m04.you")],
        [t("m03.terms"), t("c.versionOn", { n: 3, d: t("c.oct18") })], [t("m03.service"), t("m03.howMuchV")], [t("m03.price"), GG.gd(D.price), "", "total"]
      ])) + '<p class="h3">' + t("m04.payment") + "</p>" + GG.card(GG.facts([
        [t("m04.youSend"), GG.gd(D.gross), "", "total"], [t("m04.tokenFee"), GG.gd(D.fee), t("m04.tokenFeeNote")], [t("m04.receives", { g: D.homeShort }), GG.gd(D.price)],
        [t("m04.netFee"), t("m04.covered")], [t("m04.ifExtra"), t("m04.extraBack")], [t("m04.refundTo"), D.meAddr, "Celo"]
      ])) + GG.card('<div class="cardpad"><div class="h3" style="display:flex;gap:8px;align-items:center">' + ic("shield", 18) + t("m04.custodyT") + '</div><p class="para">' + t("m04.custodyB", { g: D.home }) + "</p></div>") +
        '<p class="h3">' + t("m04.next") + "</p>" + GG.card(GG.ladder([{ s: "todo", t: t("m04.n1") }, { s: "todo", t: t("m04.n2") }, { s: "todo", t: t("m04.n3", { g: D.homeShort }) }, { s: "todo", t: t("m04.n4") }, { s: "todo", t: t("m04.n5") }])) +
        '<p class="small">' + t("m04.prompts") + "</p>";
      acts = st === "changed" ? GG.btn(t("m04.reviewV4"), { go: "M03@default" }) + GG.btn(t("c.cancel"), { kind: "secondary" }) :
        st === "rejected" ? GG.btn(t("c.tryagain"), { go: "@signing" }) + GG.btn(t("c.back"), { kind: "secondary", go: "@details" }) :
        GG.btn(st === "signing" ? t("m04.waiting") : t("m04.agree"), { go: "M05@ready", disabled: st === "signing" || st === "offline" }) + GG.btn(t("c.back"), { kind: "secondary", go: "@details", disabled: st === "signing" });
    }
    return (st === "offline" ? GG.offline() : "") + GG.screens.M03.render("default") + GG.sheet({ tier: "full", title: t("m04.title"), body: body, acts: acts });
  }
});

/* ---------------- M05 Send G$ on Celo (transaction review) ---------------- */
GG.T({
  "m05.title": ["Send G$ on Celo", "Enviar G$ en Celo", "Enviar G$ na Celo"],
  "m05.desc": ["Pays for: {o}", "Paga: {o}", "Paga: {o}"],
  "m05.from": ["From", "Desde", "De"],
  "m05.yourAcct": ["Your account", "Tu cuenta", "Sua conta"],
  "m05.to": ["To", "A", "Para"],
  "m05.toV": ["{g}'s Safe", "Safe de {g}", "Safe do {g}"],
  "m05.registered": ["Registered for this garden", "Registrado para este jardín", "Registrado para este jardim"],
  "m05.amount": ["Amount", "Importe", "Valor"],
  "m05.arrives": ["Arrives", "Llega", "Chega"],
  "m05.reference": ["Reference", "Referencia", "Referência"],
  "m05.refNote": ["Links this payment to your request", "Vincula este pago a tu solicitud", "Vincula este pagamento à sua solicitação"],
  "m05.send": ["Send {a}", "Enviar {a}", "Enviar {a}"],
  "m05.low.t": ["Not enough G$", "No tienes suficientes G$", "G$ insuficiente"],
  "m05.low.b": ["You have 300.12 G$. This payment needs {a} including the token fee.", "Tienes 300,12 G$. Este pago necesita {a} con la comisión del token.", "Você tem 300,12 G$. Este pagamento precisa de {a} com a taxa do token."],
  "m05.wallet.b": ["Your account is asking you to approve sending {a}.", "Tu cuenta te pide aprobar el envío de {a}.", "Sua conta está pedindo que você aprove o envio de {a}."],
  "m05.waiting": ["Waiting…", "Esperando…", "Aguardando…"],
  "m05.sent.t": ["Sent", "Enviado", "Enviado"],
  "m05.sent.b": ["{g}'s Safe received the transfer on Celo. A steward checks it next; you don't need to do anything.", "El Safe de {g} recibió la transferencia en Celo. Ahora la revisa un responsable; no necesitas hacer nada.", "O Safe do {g} recebeu a transferência na Celo. Um responsável confere em seguida; você não precisa fazer nada."],
  "m05.rej.t": ["Not sent", "No se envió", "Não enviado"],
  "m05.rej.b": ["You canceled in your account. No G$ left your wallet.", "Cancelaste en tu cuenta. No salió ningún G$ de tu billetera.", "Você cancelou na sua conta. Nenhum G$ saiu da sua carteira."],
  "m05.spon.t": ["Network fee not covered", "No se cubrió la comisión de red", "Taxa de rede não coberta"],
  "m05.spon.b": ["Green Goods couldn't cover the network fee right now. Nothing was sent. You can pay about 0.004 CELO yourself, or try later.", "Green Goods no pudo cubrir la comisión de red ahora. No se envió nada. Puedes pagar unos 0,004 CELO tú, o intentarlo más tarde.", "O Green Goods não conseguiu cobrir a taxa de rede agora. Nada foi enviado. Você pode pagar cerca de 0,004 CELO, ou tentar mais tarde."],
  "m05.payFee": ["Pay the Fee Myself", "Pagar la comisión yo", "Pagar a taxa eu mesmo"],
  "m05.later": ["Try Later", "Intentar más tarde", "Tentar mais tarde"],
  "m05.unk.t": ["We can't tell if it went through", "No sabemos si se completó", "Não sabemos se foi concluído"],
  "m05.unk.b": ["Your account didn't return a result. Check before sending again, so you don't pay twice.", "Tu cuenta no devolvió un resultado. Compruébalo antes de volver a enviar, para no pagar dos veces.", "Sua conta não retornou um resultado. Confira antes de enviar de novo, para não pagar duas vezes."],
  "m05.check": ["Check Transfer", "Comprobar transferencia", "Conferir transferência"],
  "m05.found.t": ["Transfer found", "Transferencia encontrada", "Transferência encontrada"],
  "m05.found.b": ["{a} reached {g}'s Safe at 10:52 AM. No need to send again.", "{a} llegaron al Safe de {g} a las 10:52. No hace falta volver a enviar.", "{a} chegaram ao Safe do {g} às 10:52. Não precisa enviar de novo."],
  "m05.nf.t": ["No transfer found", "No se encontró ninguna transferencia", "Nenhuma transferência encontrada"],
  "m05.nf.b": ["Nothing with reference GG-7F3A reached the Safe in the last 2 hours. It's safe to send.", "No llegó nada con la referencia GG-7F3A al Safe en las últimas 2 horas. Puedes enviar sin riesgo.", "Nada com a referência GG-7F3A chegou ao Safe nas últimas 2 horas. Pode enviar com segurança."],
  "m05.off.b": ["You're offline. Send when you're back online; nothing is saved to send later.", "Estás sin conexión. Envía cuando vuelvas a tener conexión; no se guarda nada para enviar después.", "Você está offline. Envie quando estiver online de novo; nada fica salvo para enviar depois."]
});
GG.SCR("M05", {
  surface: "member", journey: "gd", title: "Send G$ on Celo (transaction review)", prd: "PRD-1297",
  states: [["ready", "Ready to send", "default"], ["low", "Not enough G$", "blocked"], ["wallet", "Waiting for the account", "pending"], ["sent", "Sent", "success"], ["rejected", "Signature canceled", "rejected"], ["sponsor", "Sponsorship failed", "failure"], ["unknown", "Result uncertain", "delayed"], ["found", "Lookup: transfer found", "recovery"], ["notfound", "Lookup: nothing found", "recovery"], ["offline", "Offline", "offline"]],
  notes: {
    who: "Buyer with their Green Goods account on Celo (passkey smart account).",
    pre: "Request recorded with a pledge. The destination is the buyer garden's registered Safe from the settlement account registry, never typed. Evidence: registry read plus live G$ fee read.",
    auth: "One canonical G$ transfer: gross amount, token fee, net arrival, network fee and sponsorship, and a reference that binds it to the request.",
    out: "Pending in the account; success shows the transfer hash; failure states never imply funds moved.",
    rec: "Uncertain result: look up the transfer by reference before allowing another send (buyer). Sponsorship failure: pay the fee or retry later (buyer). Nothing queues offline.",
    facts: "Celo canonical G$ transfer to the registered Safe. This screen proves only \"payment sent\"; deposit recording is a separate steward attestation (S04). Lookup reads Celo transfer logs by sender, Safe and amount window.",
    tags: ["req", "sel", "ui"], dec: ["D6"]
  },
  stateNotes: {
    ready: { say: "Gross, fee and net on separate lines; the Safe is named as the garden's, with its registration as the trust cue.", sr: "Dialog \"Send G$ on Celo\"." },
    low: { say: "Blocked before signing; withdraw stays available in the purchase page.", sr: "\"Not enough G$\" (assertive)." },
    wallet: { say: "Waiting on the account prompt; close disabled.", sr: "\"Confirm in your account\" (polite)." },
    sent: { say: "Sent is not checked: the copy says a steward checks next.", sr: "\"Sent\" (polite)." },
    rejected: { say: "User-canceled signature. No retry pressure.", sr: "\"Not sent\" (status)." },
    sponsor: { say: "Sponsorship failure is named; nothing sent; two honest options.", sr: "\"Network fee not covered\" (assertive)." },
    unknown: { say: "Send is replaced by Check Transfer so a second payment can't happen by reflex.", sr: "\"We can't tell if it went through\" (assertive)." },
    found: { say: "Lookup found the transfer; flow continues as sent.", sr: "\"Transfer found\" (polite)." },
    notfound: { say: "Only a negative lookup re-enables Send.", sr: "\"No transfer found\" (polite)." },
    offline: { say: "Disabled; no queued payment.", sr: "\"Payments wait for a connection\" (status)." }
  },
  render: function (st) {
    var D = GG.D, A = GG.gd(D.gross);
    var lead = {
      low: GG.notice("err", "xcirc", t("m05.low.t"), t("m05.low.b", { a: A })),
      wallet: GG.notice("info", "clock", t("c.waitingAccount"), t("m05.wallet.b", { a: A })),
      sent: GG.notice("ok", "check", t("m05.sent.t"), t("m05.sent.b", { g: D.home })),
      rejected: GG.notice("warn", "alert", t("m05.rej.t"), t("m05.rej.b")),
      sponsor: GG.notice("warn", "alert", t("m05.spon.t"), t("m05.spon.b")),
      unknown: GG.notice("warn", "clock", t("m05.unk.t"), t("m05.unk.b")),
      found: GG.notice("ok", "check", t("m05.found.t"), t("m05.found.b", { a: A, g: D.home })),
      notfound: GG.notice("info", "info", t("m05.nf.t"), t("m05.nf.b")),
      offline: GG.notice("", "globe", t("m04.off.t"), t("m05.off.b"))
    }[st] || "";
    var body = lead + GG.card(GG.facts([
      [t("m05.from"), t("m05.yourAcct"), D.meAddr], [t("m05.to"), t("m05.toV", { g: D.home }), D.homeSafe + " · " + t("m05.registered")],
      [t("m05.amount"), A, "", "total"], [t("m04.tokenFee"), GG.gd(D.fee)], [t("m05.arrives"), GG.gd(D.price)],
      [t("m04.netFee"), st === "sponsor" ? "≈ " + GG.num(0.004, 3) + " CELO" : t("m04.covered")], [t("m05.reference"), D.ref, t("m05.refNote")]
    ]) + GG.tech(["<span>Celo · G$ <code>0x62B8…9c7A</code></span>", st === "sent" || st === "found" ? "<span>Tx <code>0x8e41…07c1</code> · " + t("c.viewCeloscan") + "</span>" : ""]));
    var acts = st === "sent" || st === "found" ? GG.btn(t("c.done"), { go: "M06@sent" }) :
      st === "rejected" ? GG.btn(t("c.tryagain"), { go: "@wallet" }) + GG.btn(t("c.cancel"), { kind: "secondary" }) :
      st === "sponsor" ? GG.btn(t("m05.payFee"), { go: "@wallet" }) + GG.btn(t("m05.later"), { kind: "secondary", go: "M06@requested" }) :
      st === "unknown" ? GG.btn(t("m05.check"), { go: "@found" }) + GG.btn(t("c.viewCeloscan"), { kind: "secondary" }) :
      GG.btn(st === "wallet" ? t("m05.waiting") : t("m05.send", { a: A }), { go: "@wallet", disabled: st === "low" || st === "wallet" || st === "offline" }) + GG.btn(t("c.cancel"), { kind: "secondary", disabled: st === "wallet" });
    return (st === "offline" ? GG.offline() : "") + GG.screens.M03.render("default") + GG.sheet({ tier: "tall", title: t("m05.title"), desc: t("m05.desc", { o: D.aiTitle }), body: body, acts: acts });
  }
});

/* ---------------- M06 Your purchase (buyer's promise page) ---------------- */
GG.T({
  "m06.kind": ["Your purchase · {g}", "Tu compra · {g}", "Sua compra · {g}"],
  "m06.where": ["Where things stand", "Cómo va", "Como está"],
  "m06.l1": ["You agreed to version 3", "Aceptaste la versión 3", "Você aceitou a versão 3"],
  "m06.l1m": ["Today, 10:40 AM", "Hoy, 10:40", "Hoje, 10:40"],
  "m06.l2": ["Payment sent: {a}", "Pago enviado: {a}", "Pagamento enviado: {a}"],
  "m06.l2m": ["On Celo · 10:52 AM", "En Celo · 10:52", "Na Celo · 10:52"],
  "m06.l3": ["A {g} steward checks it arrived", "Un responsable de {g} comprueba que llegó", "Um responsável do {g} confere se chegou"],
  "m06.l3wait": ["Waiting 2 days · only {g} stewards can check it", "Esperando 2 días · solo los responsables de {g} pueden comprobarlo", "Aguardando há 2 dias · só os responsáveis do {g} podem conferir"],
  "m06.l3done": ["Deposit checked: {a}", "Depósito comprobado: {a}", "Depósito conferido: {a}"],
  "m06.l3doneM": ["By Tomás, a steward · a person's check, not automatic proof", "Por Tomás, responsable · lo comprobó una persona, no es una prueba automática", "Por Tomás, responsável · conferido por uma pessoa, não é prova automática"],
  "m06.l3short": ["Steward found {a} of {p}", "El responsable encontró {a} de {p}", "O responsável encontrou {a} de {p}"],
  "m06.l4": ["Green Goods Community Garden accepts", "Green Goods Community Garden acepta", "O Green Goods Community Garden aceita"],
  "m06.l4done": ["Green Goods Community Garden accepted", "Green Goods Community Garden aceptó", "O Green Goods Community Garden aceitou"],
  "m06.l4fail": ["Green Goods Community Garden declined", "Green Goods Community Garden rechazó", "O Green Goods Community Garden recusou"],
  "m06.l5": ["Your deposit is applied to this promise", "Tu depósito se aplica a esta promesa", "Seu depósito é aplicado a esta promessa"],
  "m06.l5now": ["{g} applies it next", "{g} lo aplica a continuación", "O {g} aplica em seguida"],
  "m06.l6": ["Access is set up", "Se activa el acceso", "O acesso é ativado"],
  "m06.l6m": ["Outside the app, reported by Green Goods", "Fuera de la app, lo informa Green Goods", "Fora do app, informado pelo Green Goods"],
  "m06.l6done": ["Access active", "Acceso activo", "Acesso ativo"],
  "m06.l6doneM": ["Reported by Green Goods, Oct 24", "Informado por Green Goods, 24 oct", "Informado pelo Green Goods, 24 out"],
  "m06.l7": ["You confirm it was kept", "Confirmas que se cumplió", "Você confirma que foi cumprida"],
  "m06.l8": ["Paid out to the provider's team", "Se paga al equipo del proveedor", "Pago à equipe do prestador"],
  "m06.l8m": ["Under its payout plan · sent to Celo, waiting for confirmation", "Según su plan de pagos · enviado a Celo, esperando confirmación", "Conforme o plano de pagamento · enviado à Celo, aguardando confirmação"],
  "m06.l8done": ["Oct 30 · confirmed on Celo", "30 oct · confirmado en Celo", "30 out · confirmado na Celo"],
  "m06.r1": ["Refund queued: {a}", "Reembolso en cola: {a}", "Reembolso na fila: {a}"],
  "m06.r2": ["Refund sent on Celo", "Reembolso enviado en Celo", "Reembolso enviado na Celo"],
  "m06.r2fail": ["Didn't complete on Celo · attempt 1", "No se completó en Celo · intento 1", "Não foi concluído na Celo · tentativa 1"],
  "m06.r3": ["Refund received", "Reembolso recibido", "Reembolso recebido"],
  "m06.r3m": ["Oct 25 · to 0x3C1e…7A2e", "25 oct · a 0x3C1e…7A2e", "25 out · para 0x3C1e…7A2e"],
  "m06.w1": ["You withdrew your request", "Retiraste tu solicitud", "Você retirou sua solicitação"],
  "m06.w2": ["A payment arrived after you withdrew: {a}", "Llegó un pago después de que retiraras: {a}", "Chegou um pagamento depois que você retirou: {a}"],
  "m06.w3": ["A steward records it and sends it back", "Un responsable lo registra y lo devuelve", "Um responsável registra e devolve"],
  "m06.p.send": ["Send your payment", "Envía tu pago", "Envie seu pagamento"],
  "m06.p.check": ["Waiting for a check", "Esperando la comprobación", "Aguardando conferência"],
  "m06.p.short": ["10.00 G$ short", "Faltan 10,00 G$", "Faltam 10,00 G$"],
  "m06.p.provider": ["Waiting for the provider", "Esperando al proveedor", "Aguardando o prestador"],
  "m06.p.terms": ["Terms changed", "Cambiaron las condiciones", "As condições mudaram"],
  "m06.p.accepted": ["Accepted, not yet applied", "Aceptada, sin aplicar", "Aceita, ainda não aplicada"],
  "m06.p.setup": ["Access being set up", "Activando el acceso", "Ativando o acesso"],
  "m06.p.active": ["Access active", "Acceso activo", "Acesso ativo"],
  "m06.p.refunding": ["Declined · refund on its way", "Rechazada · reembolso en camino", "Recusada · reembolso a caminho"],
  "m06.p.refundLate": ["Refund delayed", "Reembolso con retraso", "Reembolso atrasado"],
  "m06.p.refunded": ["Refunded", "Reembolsada", "Reembolsada"],
  "m06.p.late": ["Late payment · refund owed", "Pago tardío · se debe reembolsar", "Pagamento atrasado · reembolso devido"],
  "m06.sendG": ["Send G$", "Enviar G$", "Enviar G$"],
  "m06.sendMore": ["Send 10.00 G$ More", "Enviar 10,00 G$ más", "Enviar mais 10,00 G$"],
  "m06.short.t": ["Your payment is 10.00 G$ short", "A tu pago le faltan 10,00 G$", "Faltam 10,00 G$ no seu pagamento"],
  "m06.short.b": ["Send the rest so a steward can record it. If you withdraw instead, a steward returns what arrived; that return happens outside the promise record.", "Envía lo que falta para que un responsable lo registre. Si en cambio retiras la solicitud, un responsable devuelve lo que llegó; esa devolución queda fuera del registro de la promesa.", "Envie o restante para que um responsável registre. Se você retirar a solicitação, um responsável devolve o que chegou; essa devolução fica fora do registro da promessa."],
  "m06.stale.t": ["The offer changed to version 4", "El ofrecimiento cambió a la versión 4", "A oferta mudou para a versão 4"],
  "m06.stale.b": ["Your request is for version 3, so it can't be accepted as it is. Version 4 costs 480.00 G$. Agree again and send 30.00 G$ more, or withdraw and get your 450.00 G$ back.", "Tu solicitud es para la versión 3, así que no se puede aceptar tal cual. La versión 4 cuesta 480,00 G$. Acepta de nuevo y envía 30,00 G$ más, o retírala y recupera tus 450,00 G$.", "Sua solicitação é para a versão 3, então não pode ser aceita assim. A versão 4 custa 480,00 G$. Aceite de novo e envie mais 30,00 G$, ou retire e receba seus 450,00 G$ de volta."],
  "m06.acc.t": ["Accepted doesn't mean paid", "Aceptada no significa pagada", "Aceita não quer dizer paga"],
  "m06.acc.b": ["Green Goods Community Garden accepted your request. Your deposit is applied to the promise next; until then the service doesn't start.", "Green Goods Community Garden aceptó tu solicitud. Ahora se aplica tu depósito a la promesa; hasta entonces el servicio no empieza.", "O Green Goods Community Garden aceitou sua solicitação. Em seguida seu depósito é aplicado à promessa; até lá o serviço não começa."],
  "m06.dec.t": ["Your {a} comes back", "Tus {a} vuelven a ti", "Seus {a} voltam para você"],
  "m06.dec.b": ["The full recorded amount returns to 0x3C1e…7A2e on Celo. {g}'s stewards send it.", "El importe registrado completo vuelve a 0x3C1e…7A2e en Celo. Lo envían los responsables de {g}.", "O valor registrado inteiro volta para 0x3C1e…7A2e na Celo. Os responsáveis do {g} enviam."],
  "m06.rf.t": ["Your refund is delayed", "Tu reembolso se retrasó", "Seu reembolso atrasou"],
  "m06.rf.b": ["The transfer didn't complete. {g}'s stewards retry the same refund; it can't be paid twice. You don't need to do anything.", "La transferencia no se completó. Los responsables de {g} reintentan el mismo reembolso; no se puede pagar dos veces. No necesitas hacer nada.", "A transferência não foi concluída. Os responsáveis do {g} tentam de novo o mesmo reembolso; ele não pode ser pago duas vezes. Você não precisa fazer nada."],
  "m06.late.t": ["Your payment arrived after you withdrew", "Tu pago llegó después de retirar la solicitud", "Seu pagamento chegou depois que você retirou"],
  "m06.late.b": ["{g}'s stewards record it and return the full amount to you.", "Los responsables de {g} lo registran y te devuelven el importe completo.", "Os responsáveis do {g} registram e devolvem o valor inteiro para você."],
  "m06.off.t": ["Showing what we knew at 10:58 AM", "Mostrando lo que sabíamos a las 10:58", "Mostrando o que sabíamos às 10:58"],
  "m06.off.b": ["You're offline. This page updates when you're back online. Nothing here has failed.", "Estás sin conexión. Esta página se actualiza al volver la conexión. Aquí no ha fallado nada.", "Você está offline. Esta página atualiza quando você voltar a ficar online. Nada aqui falhou."],
  "m06.payCard": ["Payment", "Pago", "Pagamento"],
  "m06.paidFrom": ["Paid from", "Pagado desde", "Pago com"],
  "m06.paidFromV": ["Your own G$, not garden funds", "Tus propios G$, no fondos del jardín", "Seus próprios G$, não fundos do jardim"],
  "m06.recorded": ["Recorded", "Registrado", "Registrado"],
  "m06.notYet": ["Not yet", "Todavía no", "Ainda não"],
  "m06.outcome": ["Outcome", "Resultado", "Resultado"],
  "m06.outcomeV": ["Pays the provider's team when you confirm, or comes back to you. Never both.", "Paga al equipo del proveedor cuando lo confirmas, o vuelve a ti. Nunca las dos cosas.", "Paga a equipe do prestador quando você confirma, ou volta para você. Nunca os dois."],
  "m06.access": ["Access to the AI assistant", "Acceso al asistente de IA", "Acesso ao assistente de IA"],
  "m06.accessNot": ["Not active yet", "Aún no está activo", "Ainda não está ativo"],
  "m06.accessNote": ["Green Goods turns access on outside the app and reports it here. Paying doesn't turn it on by itself.", "Green Goods activa el acceso fuera de la app y lo informa aquí. Pagar no lo activa por sí solo.", "O Green Goods ativa o acesso fora do app e informa aqui. Pagar não ativa sozinho."]
});
GG.SCR("M06", {
  surface: "member", journey: "gd", title: "Your purchase (status and recovery)", prd: "PRD-1297",
  states: [["requested", "Request sent, payment not sent", "pending"], ["sent", "Sent, waiting for steward check", "delayed"], ["underpaid", "Underpaid", "recovery"], ["checked", "Checked, waiting for provider", "pending"], ["stale", "Terms changed after consent", "stale"], ["accepted", "Accepted, deposit not applied", "pending"], ["applied", "Applied, access not active", "pending"], ["active", "Access reported active", "default"], ["payout", "Kept, payout in progress", "pending"], ["done", "Paid out", "success"], ["declined", "Declined, refund queued", "recovery"], ["refundfail", "Refund failed, being retried", "failure"], ["refunded", "Refunded", "success"], ["late", "Deposit after withdrawal", "recovery"], ["offline", "Offline (last known)", "offline"]],
  notes: {
    who: "Buyer reads; acts with the Green Goods account (send, withdraw, confirm). Buyer-garden stewards and the provider act elsewhere (S03 to S06).",
    pre: "Indexed request, pledge/funding state, provider decision, payout plan and refund child, plus the provider's access report.",
    auth: "Send, send the difference, withdraw (before acceptance), agree to a new revision, confirm kept.",
    out: "Each fact is its own ladder step: payment sent, steward-verified deposit, provider acceptance, funding applied, access, confirmation, payout. A refund branch replaces the last steps. Payout and refund are exclusive.",
    rec: "Refund failure: buyer-garden stewards requeue the same refund (no second payment). Late deposit: steward records then refunds. Underpaid: buyer sends the difference or withdraws; returning an unrecorded underpayment is a Safe action outside the record (dependency).",
    facts: "Funding states map to Pledged, DepositRecorded, Consumed, Closed, RefundQueued, Refunded, Withdrawn (settlement spec) extended for the buyer-garden route. Payout uses the existing payout plan (contributor consideration by recognition), not a lump sum to the provider Safe. Access status is a provider report from the external integration, never inferred from payment.",
    tags: ["req", "sel", "ui", "open"], dec: ["D1", "D3", "D4"]
  },
  stateNotes: {
    requested: { say: "Request recorded, no payment yet.", sr: "Pill \"Send your payment\" is the page status (status region)." },
    sent: { say: "Wait is shown as metadata with who can act, not as an alarm (DL-044 spirit).", sr: "None beyond the pill." },
    underpaid: { say: "Short payment can't be recorded below the price; the member sends the rest or withdraws. The off-record return is called out.", sr: "\"Your payment is 10.00 G$ short\" (status)." },
    checked: { say: "Verified by a person; copy never calls it automatic proof.", sr: "Ladder step text." },
    stale: { say: "Consent is for v3; v4 needs fresh consent and possibly a top-up payment.", sr: "\"The offer changed to version 4\" (assertive)." },
    accepted: { say: "Provider acceptance alone doesn't mean funding is available.", sr: "\"Accepted doesn't mean paid\" (status)." },
    applied: { say: "Funding applied; access is a separate integration status.", sr: "None." },
    active: { say: "Access reported active by the provider, with source and date; Confirm Kept follows the existing confirm flow.", sr: "None." },
    payout: { say: "Payout in progress under the provider's payout plan; sent is not confirmed.", sr: "None." },
    done: { say: "Closed: payout confirmed by acknowledgment.", sr: "None." },
    declined: { say: "Refund of the full recorded net deposit, sent by buyer-garden stewards.", sr: "\"Your 450,00 G$ comes back\" (status)." },
    refundfail: { say: "Failure is named, owner named, double payment ruled out.", sr: "\"Your refund is delayed\" (status)." },
    refunded: { say: "Terminal refund outcome.", sr: "None." },
    late: { say: "Deposit after withdrawal becomes a recorded refund obligation.", sr: "\"Your payment arrived after you withdrew\" (status)." },
    offline: { say: "Last known state with its time; nothing implies failure.", sr: "\"Showing what we knew at 10:58 AM\" (status)." }
  },
  render: function (st) {
    var D = GG.D, A = GG.gd(D.gross), P = GG.gd(D.price);
    var L = {
      l1: { s: "done", t: t("m06.l1"), m: t("m06.l1m") },
      l2: { s: "done", t: t("m06.l2", { a: A }), m: t("m06.l2m") },
      l3: { s: "done", t: t("m06.l3done", { a: P }), m: t("m06.l3doneM") },
      l4: { s: "done", t: t("m06.l4done") },
      l5: { s: "done", t: t("m06.l5") },
      l6: { s: "done", t: t("m06.l6done"), m: t("m06.l6doneM") },
      l7: { s: "done", t: t("m06.l7") },
      l8: { s: "done", t: t("m06.l8"), m: t("m06.l8done") }
    };
    function todo(k, txt, m) { return { s: "todo", t: txt, m: m }; }
    var steps, pill, notice = "", bar = [];
    var base = [L.l1, L.l2, L.l3, L.l4, L.l5, L.l6, L.l7, L.l8];
    var future = [todo(0, t("m06.l3", { g: D.homeShort })), todo(0, t("m06.l4")), todo(0, t("m06.l5")), todo(0, t("m06.l6"), t("m06.l6m")), todo(0, t("m06.l7")), todo(0, t("m06.l8"))];
    switch (st) {
      case "requested":
        steps = [L.l1, { s: "now", t: t("m06.p.send") }].concat(future); pill = GG.pill("warn", t("m06.p.send"));
        bar = [GG.btn(t("m06.sendG"), { go: "M05@ready" }), GG.btn(t("c.withdraw"), { kind: "secondary" })]; break;
      case "sent": case "offline":
        steps = [L.l1, L.l2, { s: "now", t: t("m06.l3", { g: D.homeShort }), m: t("m06.l3wait", { g: D.homeShort }) }].concat(future.slice(1)); pill = GG.pill("info", t("m06.p.check"));
        bar = [GG.btn(t("c.withdraw"), { kind: "secondary", disabled: st === "offline" })];
        if (st === "offline") notice = GG.notice("", "globe", t("m06.off.t"), t("m06.off.b")); break;
      case "underpaid":
        steps = [L.l1, L.l2, { s: "warn", t: t("m06.l3short", { a: GG.gd(D.short), p: P }) }].concat(future.slice(1)); pill = GG.pill("warn", t("m06.p.short"));
        notice = GG.notice("warn", "alert", t("m06.short.t"), t("m06.short.b")); bar = [GG.btn(t("m06.sendMore"), { go: "M05@ready" }), GG.btn(t("c.withdraw"), { kind: "secondary" })]; break;
      case "checked":
        steps = [L.l1, L.l2, L.l3, { s: "now", t: t("m06.l4") }].concat(future.slice(2)); pill = GG.pill("info", t("m06.p.provider"));
        bar = [GG.btn(t("c.withdraw"), { kind: "secondary", go: "@declined" })]; break;
      case "stale":
        steps = [L.l1, L.l2, L.l3, { s: "warn", t: t("m06.p.terms") }].concat(future.slice(2)); pill = GG.pill("warn", t("m06.p.terms"));
        notice = GG.notice("warn", "refresh", t("m06.stale.t"), t("m06.stale.b")); bar = [GG.btn(t("m04.reviewV4"), { go: "M04@review" }), GG.btn(t("c.withdraw"), { kind: "secondary", go: "@declined" })]; break;
      case "accepted":
        steps = [L.l1, L.l2, L.l3, L.l4, { s: "now", t: t("m06.l5"), m: t("m06.l5now", { g: D.homeShort }) }].concat(future.slice(3)); pill = GG.pill("info", t("m06.p.accepted"));
        notice = GG.notice("info", "info", t("m06.acc.t"), t("m06.acc.b")); break;
      case "applied":
        steps = [L.l1, L.l2, L.l3, L.l4, L.l5, { s: "now", t: t("m06.l6"), m: t("m06.l6m") }].concat(future.slice(4)); pill = GG.pill("info", t("m06.p.setup")); break;
      case "active":
        steps = [L.l1, L.l2, L.l3, L.l4, L.l5, L.l6, { s: "now", t: t("m06.l7") }, future[5]]; pill = GG.pill("ok", t("m06.p.active"));
        bar = [GG.btn(t("c.confirmKept"), { go: "@payout" }), GG.btn(t("c.notYet"), { kind: "secondary" })]; break;
      case "payout":
        steps = base.slice(0, 7).concat([{ s: "now", t: t("m06.l8"), m: t("m06.l8m") }]); pill = GG.pill("ok", t("c.kept")); break;
      case "done":
        steps = base; pill = GG.pill("ok", t("c.kept")); break;
      case "declined": case "refundfail": case "refunded":
        steps = [L.l1, L.l2, L.l3, { s: "fail", t: t("m06.l4fail"), m: t("c.oct23") }, { s: "done", t: t("m06.r1", { a: P }) },
          st === "declined" ? { s: "now", t: t("m06.r2") } : st === "refundfail" ? { s: "fail", t: t("m06.r2"), m: t("m06.r2fail") } : { s: "done", t: t("m06.r2") },
          st === "refunded" ? { s: "done", t: t("m06.r3"), m: t("m06.r3m") } : { s: "todo", t: t("m06.r3") }];
        pill = st === "declined" ? GG.pill("warn", t("m06.p.refunding")) : st === "refundfail" ? GG.pill("err", t("m06.p.refundLate")) : GG.pill("ok", t("m06.p.refunded"));
        notice = st === "declined" ? GG.notice("info", "info", t("m06.dec.t", { a: P }), t("m06.dec.b", { g: D.home })) : st === "refundfail" ? GG.notice("warn", "alert", t("m06.rf.t"), t("m06.rf.b", { g: D.home })) : ""; break;
      case "late":
        steps = [L.l1, { s: "done", t: t("m06.w1"), m: t("c.oct22t") }, { s: "warn", t: t("m06.w2", { a: A }) }, { s: "now", t: t("m06.w3") }, { s: "todo", t: t("m06.r3") }];
        pill = GG.pill("warn", t("m06.p.late")); notice = GG.notice("info", "info", t("m06.late.t"), t("m06.late.b", { g: D.home })); break;
    }
    var recorded = ["requested", "sent", "underpaid", "late", "offline"].indexOf(st) >= 0 ? t("m06.notYet") : P;
    var html = (st === "offline" ? GG.offline() : "") + '<div class="screen nobar"><div class="col">' + GG.topnav("", "M13@default") +
      '<div class="ident"><div class="kind">' + ic("coins", 16) + t("m06.kind", { g: D.ggcg }) + "</div><h1>" + D.aiTitle + '</h1><div class="chips">' + pill + "</div>" + notice + "</div>" +
      GG.sec(t("m06.where")) + '<div class="mx16">' + GG.card(GG.ladder(steps)) + "</div>" +
      GG.sec(t("m06.payCard")) + '<div class="mx16">' + GG.card(GG.facts([
        [t("m06.paidFrom"), t("m06.paidFromV")], [t("m04.heldBy"), t("m04.heldByV", { g: D.homeShort })],
        [t("m06.recorded"), recorded, recorded === P ? t("m06.l3doneM") : ""], [t("m06.outcome"), t("m06.outcomeV")]
      ])) + "</div>" +
      GG.sec(t("m06.access")) + '<div class="mx16">' + GG.card('<div class="cardpad"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span class="h3">AI assistant</span>' +
        (st === "active" || st === "payout" || st === "done" ? GG.pill("ok", t("m06.l6done")) : GG.pill("neu", t("m06.accessNot"))) + '</div><p class="small">' + t("m06.accessNote") + "</p></div>") + "</div>" +
      "</div></div>" + (bar.length ? GG.fixedbar(bar) : "");
    return html;
  }
});
