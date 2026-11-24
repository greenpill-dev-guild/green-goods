/* Member PWA: holdings, purchases, the voucher exchange, earned rewards and the scoped Promises
   sheet. The wallet is the member's own account surface, so it may list purchases from any garden;
   the garden-scoped Promises sheet never mixes gardens (PWA hub lock 4). */
GG.T({
  "w.title": ["Your Wallet", "Tu billetera", "Sua carteira"],
  "w.tab.tokens": ["Tokens", "Tokens", "Tokens"],
  "w.tab.vouchers": ["Vouchers", "Vales", "Vales"],
  "w.tab.purchases": ["Purchases", "Compras", "Compras"],
  "w.tab.cookies": ["Cookies", "Galletas", "Cookies"]
});
GG.walletTabs = function (on, badge) {
  return GG.stabs([[t("w.tab.tokens")], [t("w.tab.vouchers")], [t("w.tab.purchases"), badge || ""], [t("w.tab.cookies")]], on);
};

/* ---------------- M12 Wallet › Vouchers (holdings) ---------------- */
GG.T({
  "m12.gnoWallet": ["Gnosis wallet {a}", "Billetera de Gnosis {a}", "Carteira da Gnosis {a}"],
  "m12.inWallet": ["{n} in wallet", "{n} en la billetera", "{n} na carteira"],
  "m12.sunDetail": ["+100 in escrow · Gnosis · used at Sunroot's posted prices", "+100 en depósito de garantía · Gnosis · se usan a los precios de Sunroot", "+100 em depósito em garantia · Gnosis · usados nos preços da Sunroot"],
  "m12.maraTitle": ["Mara's Seed Library voucher", "Vale de Mara's Seed Library", "Vale da Mara's Seed Library"],
  "m12.maraDetail": ["Gnosis · one seed packet · gardener issuer", "Gnosis · un sobre de semillas · emitido por una jardinera", "Gnosis · um pacote de sementes · emitido por uma jardineira"],
  "m12.note": ["Holding vouchers doesn't book a service. Each issuer's offers show what's available.", "Tener vales no reserva un servicio. Los ofrecimientos de cada emisor muestran lo disponible.", "Ter vales não reserva um serviço. As ofertas de cada emissor mostram o que está disponível."],
  "m12.use": ["Use or get vouchers", "Usar o conseguir vales", "Usar ou conseguir vales"],
  "m12.offersTake": ["Offers that take your vouchers", "Ofrecimientos que aceptan tus vales", "Ofertas que aceitam seus vales"],
  "m12.offersTakeD": ["2 in gardens you can visit", "2 en jardines que puedes visitar", "2 em jardins que você pode visitar"],
  "m12.exchange": ["Sunroot voucher exchange", "Intercambio de vales de Sunroot", "Troca de vales da Sunroot"],
  "m12.exchangeD": ["Run by Sunroot Skills Hub · rehearsal", "Lo gestiona Sunroot Skills Hub · ensayo", "Gerida pela Sunroot Skills Hub · ensaio"],
  "m12.empty.t": ["No vouchers yet", "Todavía no tienes vales", "Você ainda não tem vales"],
  "m12.empty.b": ["Earn them through promises, or buy them at a voucher exchange.", "Gánalos con promesas o cómpralos en un intercambio de vales.", "Ganhe com promessas ou compre em uma troca de vales."],
  "m12.nowal.t": ["Connect your Gnosis wallet to see vouchers", "Conecta tu billetera de Gnosis para ver tus vales", "Conecte sua carteira da Gnosis para ver seus vales"],
  "m12.nowal.b": ["Vouchers live on Gnosis. Your passkey account can't hold them there yet.", "Los vales están en Gnosis. Tu cuenta con clave de acceso todavía no puede guardarlos ahí.", "Os vales ficam na Gnosis. Sua conta com chave de acesso ainda não consegue guardá-los lá."],
  "m12.stale.t": ["Balances may be out of date", "Los saldos pueden estar desactualizados", "Os saldos podem estar desatualizados"],
  "m12.stale.b": ["Last read at 8:10 AM. We couldn't refresh. Nothing has been lost; refresh to check.", "Última lectura a las 8:10. No pudimos actualizar. No se perdió nada; actualiza para comprobarlo.", "Última leitura às 8:10. Não conseguimos atualizar. Nada foi perdido; atualize para conferir."],
  "m12.refresh": ["Refresh", "Actualizar", "Atualizar"],
  "m12.asOf": ["as of 8:10 AM", "a las 8:10", "às 8:10"],
  "m12.d.title": ["Sunroot Skills Hub voucher", "Vale de Sunroot Skills Hub", "Vale da Sunroot Skills Hub"],
  "m12.d.issuer": ["Issuer", "Emisor", "Emissor"],
  "m12.d.unit": ["Unit", "Unidad", "Unidade"],
  "m12.d.unitV": ["One Sunroot voucher, used at Sunroot's posted prices", "Un vale de Sunroot, que se usa a los precios publicados de Sunroot", "Um vale da Sunroot, usado nos preços publicados da Sunroot"],
  "m12.d.network": ["Network", "Red", "Rede"],
  "m12.d.wallet": ["In your wallet", "En tu billetera", "Na sua carteira"],
  "m12.d.escrow": ["In escrow", "En depósito de garantía", "Em depósito em garantia"],
  "m12.d.escrowV": ["100 · Solar basics course", "100 · Solar basics course", "100 · Solar basics course"],
  "m12.d.how": ["How you got them", "Cómo los conseguiste", "Como você os conseguiu"],
  "m12.d.earned": ["Earned 80 · kept promises at Sunroot Skills Hub", "Ganaste 80 · promesas cumplidas en Sunroot Skills Hub", "Ganhou 80 · promessas cumpridas na Sunroot Skills Hub"],
  "m12.d.bought": ["Bought 50 · Sunroot voucher exchange, Oct 12. Bought, not earned.", "Compraste 50 · intercambio de vales de Sunroot, 12 oct. Comprados, no ganados.", "Comprou 50 · troca de vales da Sunroot, 12 out. Comprados, não ganhos."],
  "m12.d.useAt": ["Use at an Offer", "Usar en un ofrecimiento", "Usar em uma oferta"],
  "m12.d.exchange": ["Exchange", "Intercambiar", "Trocar"]
});
GG.SCR("M12", {
  surface: "member", journey: "hx", title: "Wallet › Vouchers (holdings)", prd: "PRD-1297",
  states: [["default", "Holdings", "default"], ["detail", "Holding detail", "default"], ["empty", "No vouchers", "empty"], ["nowallet", "No Gnosis wallet", "unavailable"], ["stale", "Balances stale", "stale"], ["loading", "Loading", "loading"]],
  notes: {
    who: "Gardener; reads the connected Gnosis holder address.",
    pre: "Gnosis wallet connected. Balances from the CLC GiftableToken per issuer; escrowed amounts from GnosisVoucherEscrow; provenance from indexed entitlements and swap receipts.",
    auth: "Nothing.",
    out: "Each holding names issuer, unit and network; escrowed vouchers are listed separately from the wallet balance.",
    rec: "Stale reads show their time and never zero out a balance or imply loss.",
    facts: "Holdings are Gnosis balances keyed by token address; issuer and unit come from the issuer's published terms (COM-46). Earned versus bought comes from entitlement receipts versus swap receipts. Service availability is not derived from holdings.",
    tags: ["req", "sel", "ui"], dec: ["D2", "D7", "T1"]
  },
  stateNotes: {
    default: { say: "Proposed new Vouchers tab beside the existing Tokens and Cookies tabs; vouchers are never listed under Tokens.", sr: "Tab \"Vouchers\" selected." },
    detail: { say: "Earned and bought are separate lines; bought is labeled \"not earned\".", sr: "Dialog \"Sunroot Skills Hub voucher\"." },
    empty: { say: "Empty state names both ways to get vouchers.", sr: "Empty-state title (status)." },
    nowallet: { say: "Connect is the only act; no passkey assumption.", sr: "Notice title (status)." },
    stale: { say: "Rows keep values with an as-of time.", sr: "\"Balances may be out of date\" (status)." },
    loading: { say: "Header keeps its height; \"Gathering…\" is announced.", sr: "\"Gathering vouchers\" (polite)." }
  },
  render: function (st) {
    var D = GG.D, rows = "";
    var sun = GG.row({ icon: "sun", title: t("m12.d.title"), pill: ["neu", t("m12.inWallet", { n: 30 })], detail: st === "stale" ? t("m12.asOf") : t("m12.sunDetail"), go: "@detail" });
    var mara = GG.row({ icon: "seed", title: t("m12.maraTitle"), pill: ["neu", t("m12.inWallet", { n: 5 })], detail: st === "stale" ? t("m12.asOf") : t("m12.maraDetail") });
    var body;
    if (st === "empty") body = '<div style="display:grid;justify-items:center;gap:10px;text-align:center;padding:48px 12px"><div class="tile" style="border-radius:20px;width:72px;height:72px">' + ic("ticket", 28) + '</div><p class="h3">' + t("m12.empty.t") + '</p><p class="para">' + t("m12.empty.b") + "</p></div>";
    else if (st === "nowallet") body = GG.notice("info", "wallet", t("m12.nowal.t"), t("m12.nowal.b"), GG.btn(t("c.connect"), { compact: true, go: "@default" }));
    else if (st === "loading") body = '<p class="small">' + t("c.gathering") + "</p>" + [1, 2].map(function () { return '<div class="row" style="cursor:default"><div class="tile"></div><div class="body"><div class="skel" style="width:70%"></div><div class="skel" style="width:30%;height:18px;border-radius:999px"></div><div class="skel" style="width:50%"></div></div></div>'; }).join("");
    else body = '<p class="small">' + t("m12.gnoWallet", { a: D.gnoAddr }) + "</p>" + (st === "stale" ? GG.notice("warn", "refresh", t("m12.stale.t"), t("m12.stale.b"), GG.btn(t("m12.refresh"), { kind: "secondary", compact: true, go: "@default" })) : "") +
      sun + mara + '<p class="small">' + t("m12.note") + '</p><p class="h3">' + t("m12.use") + "</p>" +
      GG.row({ icon: "offer", title: t("m12.offersTake"), detail: t("m12.offersTakeD"), go: "M02@sunroot" }) +
      GG.row({ icon: "swap", title: t("m12.exchange"), detail: t("m12.exchangeD"), go: "M14@quote" });
    var wallet = GG.screens.M01.render("default") + GG.sheet({ tier: "full", title: t("w.title"), tabs: GG.walletTabs(1, 1), body: body });
    if (st !== "detail") return wallet;
    return wallet + GG.sheet({ tier: "tall", title: t("m12.d.title"), body: GG.card(GG.facts([
      [t("m12.d.issuer"), D.sunroot], [t("m12.d.unit"), t("m12.d.unitV")], [t("m12.d.network"), "Gnosis"], [t("m12.d.wallet"), GG.num(30)], [t("m12.d.escrow"), t("m12.d.escrowV")]
    ])) + '<p class="h3">' + t("m12.d.how") + "</p>" + GG.card(GG.ladder([{ s: "done", t: t("m12.d.earned") }, { s: "done", t: t("m12.d.bought") }])), acts: GG.btn(t("m12.d.useAt"), { go: "M02@sunroot" }) + GG.btn(t("m12.d.exchange"), { kind: "secondary", go: "M14@quote" }) });
  }
});

/* ---------------- M13 Wallet › Purchases ---------------- */
GG.T({
  "m13.aiD": ["Green Goods Community Garden · 450.00 G$ held by Riverside Commons", "Green Goods Community Garden · 450,00 G$ guardados por Riverside Commons", "Green Goods Community Garden · 450,00 G$ guardados pelo Riverside Commons"],
  "m13.solarD": ["Sunroot Skills Hub · 100 Sunroot vouchers in escrow", "Sunroot Skills Hub · 100 vales de Sunroot en depósito de garantía", "Sunroot Skills Hub · 100 vales de Sunroot em depósito em garantia"],
  "m13.printD": ["Hilltop Orchard · 120.00 G$ back on Oct 3", "Hilltop Orchard · 120,00 G$ devueltos el 3 oct", "Hilltop Orchard · 120,00 G$ devolvidos em 3 out"],
  "m13.active": ["In progress", "En curso", "Em andamento"],
  "m13.closed": ["Closed", "Cerradas", "Encerradas"],
  "m13.note": ["Purchases you pay for yourself, with your G$ or your vouchers, in any garden. Garden spending stays with each garden's stewards.", "Compras que pagas tú, con tus G$ o tus vales, en cualquier jardín. Los gastos del jardín los llevan sus responsables.", "Compras que você paga, com seus G$ ou seus vales, em qualquer jardim. Os gastos do jardim ficam com os responsáveis de cada jardim."],
  "m13.empty.t": ["No purchases yet", "Todavía no tienes compras", "Você ainda não tem compras"],
  "m13.empty.b": ["When you pay for an offer with your own G$ or vouchers, it shows here until it settles.", "Cuando pagues un ofrecimiento con tus G$ o tus vales, aparecerá aquí hasta que se cierre.", "Quando você pagar uma oferta com seus G$ ou vales, ela aparece aqui até ser encerrada."]
});
GG.SCR("M13", {
  surface: "member", journey: "hx", title: "Wallet › Purchases (proposed home for personal purchases)", prd: "PRD-1297", entry: true,
  states: [["default", "Purchases in progress", "default"], ["empty", "No purchases", "empty"]],
  notes: {
    who: "Gardener with their Green Goods account.",
    pre: "Indexed claims where the member is the paying claimant (own G$ funding or voucher escrow), across gardens.",
    auth: "Nothing. Rows open the purchase's page in the provider garden as a visit.",
    out: "One row per purchase with its current state; the Purchases tab carries the count of rows that need the member.",
    rec: "None on this screen; each row's page owns recovery.",
    facts: "Account-scoped query over funding records (claimant = member) and voucher escrows (holder = member's bound Gnosis address). Does not mix into garden-scoped sheets.",
    tags: ["ui", "open"], dec: ["D2"]
  },
  stateNotes: {
    default: { say: "Personal spending is labeled as such; garden spending is stated to stay with stewards.", sr: "Tab \"Purchases, 1 needs you\"." },
    empty: { say: "Explains when rows appear.", sr: "Empty-state title (status)." }
  },
  render: function (st) {
    var body = st === "empty" ? '<div style="display:grid;justify-items:center;gap:10px;text-align:center;padding:48px 12px"><div class="tile" style="border-radius:20px;width:72px;height:72px">' + ic("receipt", 28) + '</div><p class="h3">' + t("m13.empty.t") + '</p><p class="para">' + t("m13.empty.b") + "</p></div>" :
      '<p class="small">' + t("m13.note") + '</p><p class="h3">' + t("m13.active") + "</p>" +
      GG.row({ icon: "coins", title: GG.D.aiTitle, pill: ["warn", t("m06.p.short")], detail: t("m13.aiD"), edge: "warn", go: "M06@underpaid" }) +
      GG.row({ icon: "ticket", title: "Solar basics course, 10 lessons", pill: ["info", t("m09.p.waitS")], detail: t("m13.solarD"), go: "M09@ready" }) +
      '<p class="h3">' + t("m13.closed") + "</p>" +
      GG.row({ icon: "coins", title: "Garden journal printing", pill: ["ok", t("m06.p.refunded")], detail: t("m13.printD") });
    return GG.screens.M01.render("needs") + GG.sheet({ tier: "full", title: t("w.title"), tabs: GG.walletTabs(2, st === "empty" ? "" : 1), body: body });
  }
});

/* ---------------- M14 Voucher exchange (direct CLC pool swap) ---------------- */
GG.T({
  "m14.title": ["Buy Sunroot Vouchers", "Comprar vales de Sunroot", "Comprar vales da Sunroot"],
  "m14.desc": ["At Sunroot voucher exchange", "En el intercambio de vales de Sunroot", "Na troca de vales da Sunroot"],
  "m14.reh": ["Rehearsal: WXDAI on a local copy of Gnosis. Not live; nothing real is spent.", "Ensayo: WXDAI en una copia local de Gnosis. No es real; no se gasta nada de verdad.", "Ensaio: WXDAI em uma cópia local da Gnosis. Não é real; nada de verdade é gasto."],
  "m14.pay": ["You pay", "Pagas", "Você paga"],
  "m14.payHint": ["This exchange takes WXDAI in the rehearsal. G$ can't be used here.", "Este intercambio acepta WXDAI en el ensayo. Aquí no se pueden usar G$.", "Esta troca aceita WXDAI no ensaio. G$ não pode ser usado aqui."],
  "m14.get": ["You get", "Recibes", "Você recebe"],
  "m14.getHint": ["At least {m} if the price moves", "Al menos {m} si el precio cambia", "Pelo menos {m} se o preço mudar"],
  "m14.exchange": ["Exchange", "Intercambio", "Troca"],
  "m14.runBy": ["Run by Sunroot Skills Hub", "Lo gestiona Sunroot Skills Hub", "Gerida pela Sunroot Skills Hub"],
  "m14.price": ["Price here", "Precio aquí", "Preço aqui"],
  "m14.priceV": ["1 WXDAI = 1 Sunroot voucher", "1 WXDAI = 1 vale de Sunroot", "1 WXDAI = 1 vale da Sunroot"],
  "m14.priceSub": ["This exchange's own price, not a rate anywhere else", "El precio de este intercambio, no una tasa de otro lugar", "O preço desta troca, não uma taxa de outro lugar"],
  "m14.holds": ["Exchange holds", "El intercambio tiene", "A troca tem"],
  "m14.goesTo": ["Goes to", "Va a", "Vai para"],
  "m14.goesToV": ["Your Gnosis wallet", "Tu billetera de Gnosis", "Sua carteira da Gnosis"],
  "m14.changeRec": ["Change recipient", "Cambiar destinatario", "Mudar destinatário"],
  "m14.valid": ["Quote valid for", "Cotización válida por", "Cotação válida por"],
  "m14.notEarned": ["Buying vouchers doesn't book a service or count as earning them.", "Comprar vales no reserva un servicio ni cuenta como ganarlos.", "Comprar vales não reserva um serviço nem conta como ganhá-los."],
  "m14.review": ["Review Swap", "Revisar intercambio", "Revisar troca"],
  "m14.youGetMin": ["You get at least", "Recibes al menos", "Você recebe pelo menos"],
  "m14.recipient": ["Recipient", "Destinatario", "Destinatário"],
  "m14.deadline": ["Deadline", "Plazo", "Prazo"],
  "m14.deadlineV": ["10 minutes after you sign", "10 minutos después de firmar", "10 minutos depois de assinar"],
  "m14.covRe": ["Covered (rehearsal)", "Cubierta (ensayo)", "Coberta (ensaio)"],
  "m14.netLocal": ["Gnosis (local copy for rehearsal)", "Gnosis (copia local para el ensayo)", "Gnosis (cópia local para o ensaio)"],
  "m14.twice": ["Your wallet asks twice: once to let the exchange use 50 WXDAI, once to swap.", "Tu billetera te pide dos firmas: una para que el intercambio use 50 WXDAI y otra para intercambiar.", "Sua carteira pede duas assinaturas: uma para a troca usar 50 WXDAI e outra para trocar."],
  "m14.allow": ["Allow 50 WXDAI", "Permitir 50 WXDAI", "Permitir 50 WXDAI"],
  "m14.allowed": ["Exchange may use 50 WXDAI", "El intercambio puede usar 50 WXDAI", "A troca pode usar 50 WXDAI"],
  "m14.swap": ["Swap", "Intercambiar", "Trocar"],
  "m14.stale.t": ["The price moved", "El precio cambió", "O preço mudou"],
  "m14.stale.b": ["This quote expired. Get a new one before you swap.", "Esta cotización caducó. Pide una nueva antes de intercambiar.", "Esta cotação expirou. Peça uma nova antes de trocar."],
  "m14.newQuote": ["Get New Quote", "Pedir nueva cotización", "Pedir nova cotação"],
  "m14.low.t": ["Not enough in this exchange", "No hay suficientes en este intercambio", "Não há o suficiente nesta troca"],
  "m14.low.b": ["It holds 20 Sunroot vouchers; you asked for 50. Ask for 20 or fewer.", "Tiene 20 vales de Sunroot; pediste 50. Pide 20 o menos.", "Ela tem 20 vales da Sunroot; você pediu 50. Peça 20 ou menos."],
  "m14.rej.b": ["You canceled in your wallet. Nothing was swapped.", "Cancelaste en tu billetera. No se intercambió nada.", "Você cancelou na carteira. Nada foi trocado."],
  "m14.spon.b": ["The fee sponsor didn't respond. Nothing was swapped. Pay the fee from your wallet in xDAI, or try later.", "El patrocinador de la comisión no respondió. No se intercambió nada. Paga la comisión desde tu billetera en xDAI o inténtalo más tarde.", "O patrocinador da taxa não respondeu. Nada foi trocado. Pague a taxa da sua carteira em xDAI ou tente mais tarde."],
  "m14.unk.t": ["We can't tell if the swap went through", "No sabemos si el intercambio se completó", "Não sabemos se a troca foi concluída"],
  "m14.unk.b": ["Check the receipt before buying again. A second swap would buy again.", "Revisa el comprobante antes de volver a comprar. Un segundo intercambio compraría otra vez.", "Confira o recibo antes de comprar de novo. Uma segunda troca compraria outra vez."],
  "m14.checkR": ["Check Receipt", "Revisar comprobante", "Conferir recibo"],
  "m14.found.t": ["Swap found", "Intercambio encontrado", "Troca encontrada"],
  "m14.found.b": ["You received 49.98 Sunroot vouchers at 2:41 PM. No need to swap again.", "Recibiste 49,98 vales de Sunroot a las 14:41. No hace falta intercambiar otra vez.", "Você recebeu 49,98 vales da Sunroot às 14:41. Não precisa trocar de novo."],
  "m14.done.t": ["Bought 49.98 Sunroot vouchers", "Compraste 49,98 vales de Sunroot", "Você comprou 49,98 vales da Sunroot"],
  "m14.done.b": ["They're in your Gnosis wallet. Bought vouchers aren't an earned reward, and buying doesn't book a service.", "Están en tu billetera de Gnosis. Los vales comprados no son una recompensa ganada, y comprar no reserva un servicio.", "Estão na sua carteira da Gnosis. Vales comprados não são recompensa ganha, e comprar não reserva um serviço."],
  "m14.buyMore": ["Buy More", "Comprar más", "Comprar mais"],
  "m14.buyMoreNote": ["Buy More starts a new purchase.", "Comprar más inicia una compra nueva.", "Comprar mais inicia uma nova compra."],
  "m14.pick": ["Pay with", "Pagar con", "Pagar com"],
  "m14.pick.wx": ["WXDAI (rehearsal only)", "WXDAI (solo ensayo)", "WXDAI (somente ensaio)"],
  "m14.pick.mara": ["This exchange doesn't take it", "Este intercambio no lo acepta", "Esta troca não aceita"],
  "m14.pick.g": ["G$ isn't swapped for vouchers. Use G$ where an offer takes it.", "Los G$ no se cambian por vales. Usa G$ donde un ofrecimiento los acepte.", "G$ não é trocado por vales. Use G$ onde uma oferta aceitar."]
});
GG.SCR("M14", {
  surface: "member", journey: "hx", title: "Voucher exchange (direct pool swap)", prd: "PRD-1297",
  states: [["quote", "Fresh quote", "default"], ["assets", "Pay-with choices (no G$)", "default"], ["review", "Transaction review", "default"], ["approved", "Allowance given, ready to swap", "pending"], ["stale", "Quote expired", "stale"], ["low", "Inventory too low", "blocked"], ["rejected", "Signature canceled", "rejected"], ["sponsor", "Sponsorship failed", "failure"], ["unknown", "Result uncertain", "delayed"], ["receipt", "Receipt found", "recovery"], ["done", "Bought", "success"]],
  notes: {
    who: "Buyer with the Gnosis wallet (holder). Recipient may be another address.",
    pre: "Pool lists the voucher and accepts the pay asset directly. Quote from the pool's quoter; inventory from the pool's balance. Evidence: live reads at quote time.",
    auth: "One allowance and one bounded swap: exact pay amount, minimum output, deadline, recipient, network fee.",
    out: "Pending in wallet; success shows received amount; failure states never imply a swap happened.",
    rec: "Uncertain result: receipt lookup before any new purchase (buyer). Stale quote: refresh. Low inventory: lower the amount.",
    facts: "Reused CLC SwapPool bounded swap (minimum output and deadline) and its quoter and limiter. WXDAI is the rehearsal purchase asset only, not the selected live asset. No G$ to voucher conversion, no bridged G$, no mixed checkout, no universal rate, no multihop. A swap receipt is not service delivery and not an earned reward.",
    tags: ["req", "sel", "reh"], dec: ["D7"]
  },
  stateNotes: {
    quote: { say: "Rehearsal banner on top; local price labeled as this exchange's own; minimum output stated.", sr: "Dialog \"Buy Sunroot Vouchers\"; quote timer announced at 10 seconds left, not every second." },
    assets: { say: "Only directly accepted assets are selectable; G$ appears disabled with the reason.", sr: "Radio group \"Pay with\"; disabled options read their reason." },
    review: { say: "Network, amounts, recipient, deadline, fee and prompt count.", sr: "Step heading." },
    approved: { say: "Allowance done; swap is the next prompt.", sr: "\"Exchange may use 50 WXDAI\" (polite)." },
    stale: { say: "Swap disabled until a fresh quote.", sr: "\"The price moved\" (assertive)." },
    low: { say: "Inventory read blocks the swap.", sr: "\"Not enough in this exchange\" (assertive)." },
    rejected: { say: "Nothing swapped.", sr: "Status." },
    sponsor: { say: "Sponsorship failure named.", sr: "Status." },
    unknown: { say: "Buy again is removed until the receipt lookup completes.", sr: "\"We can't tell if the swap went through\" (assertive)." },
    receipt: { say: "Lookup found the swap.", sr: "\"Swap found\" (polite)." },
    done: { say: "Bought, not earned; Buy More warns it buys again.", sr: "\"Bought 49.98 Sunroot vouchers\" (polite)." }
  },
  render: function (st) {
    var D = GG.D, body = GG.rehearsal(t("m14.reh")), acts = "";
    var lead = {
      stale: GG.notice("warn", "refresh", t("m14.stale.t"), t("m14.stale.b")), low: GG.notice("err", "xcirc", t("m14.low.t"), t("m14.low.b")),
      rejected: GG.notice("warn", "alert", t("m05.rej.t"), t("m14.rej.b")), sponsor: GG.notice("warn", "alert", t("m05.spon.t"), t("m14.spon.b")),
      unknown: GG.notice("warn", "clock", t("m14.unk.t"), t("m14.unk.b")), receipt: GG.notice("ok", "check", t("m14.found.t"), t("m14.found.b")),
      done: GG.notice("ok", "check", t("m14.done.t"), t("m14.done.b")), approved: GG.notice("ok", "check", t("m14.allowed"), "")
    }[st] || "";
    if (st === "assets") {
      body += '<p class="h3">' + t("m14.pick") + "</p>" + GG.choice({ on: true, title: "WXDAI", sub: t("m14.pick.wx") }) +
        GG.choice({ off: true, title: t("m12.maraTitle"), sub: t("m14.pick.mara") }) + GG.choice({ off: true, title: "G$", sub: t("m14.pick.g") });
      acts = GG.btn(t("c.continue"), { go: "@quote" });
    } else if (st === "review" || st === "approved" || st === "rejected" || st === "sponsor") {
      body += lead + GG.card(GG.facts([[t("m08.network"), t("m14.netLocal")], [t("m14.pay"), GG.num(50, 2) + " WXDAI"], [t("m14.youGetMin"), GG.vN(49.5, 2), "", "total"],
        [t("m14.recipient"), t("m04.you"), D.gnoAddr], [t("m14.deadline"), t("m14.deadlineV")], [t("m04.netFee"), st === "sponsor" ? "≈ " + GG.num(0.0004, 4) + " xDAI" : t("m14.covRe")]])) +
        GG.card(GG.ladder([{ s: st === "approved" ? "done" : "now", t: t("m14.allow") }, { s: st === "approved" ? "now" : "todo", t: t("m14.swap") }])) + '<p class="small">' + t("m14.twice") + "</p>";
      acts = st === "approved" ? GG.btn(t("m14.swap"), { go: "@done" }) : GG.btn(st === "review" ? t("m14.allow") : t("c.tryagain"), { go: "@approved" }) + GG.btn(t("c.back"), { kind: "secondary", go: "@quote" });
    } else {
      body += lead + '<div class="field"><label>' + t("m14.pay") + '</label><div class="input"><span>' + GG.num(50, 2) + '</span><span class="unit">WXDAI ' + ic("chevd", 14) + '</span></div><div class="hint">' + t("m14.payHint") + "</div></div>" +
        '<div class="field"><label>' + t("m14.get") + '</label><div class="input"><span>' + GG.num(50, 2) + '</span><span class="unit">Sunroot</span></div><div class="hint">' + t("m14.getHint", { m: GG.num(49.5, 2) }) + "</div></div>" +
        GG.card(GG.facts([[t("m14.exchange"), t("m12.exchange"), t("m14.runBy")], [t("m14.price"), t("m14.priceV"), t("m14.priceSub")], [t("m14.holds"), GG.vN(st === "low" ? 20 : 320)],
          [t("m14.goesTo"), t("m14.goesToV"), D.gnoAddr + " · " + t("m14.changeRec")], [t("m14.valid"), st === "stale" ? "0:00" : '<span class="countdown">0:48</span>']])) +
        '<p class="small">' + t("m14.notEarned") + "</p>";
      acts = st === "stale" ? GG.btn(t("m14.newQuote"), { go: "@quote" }) :
        st === "unknown" ? GG.btn(t("m14.checkR"), { go: "@receipt" }) :
        st === "receipt" ? GG.btn(t("c.done"), { go: "M12@default" }) :
        st === "done" ? GG.btn(t("c.done"), { go: "M12@default" }) + GG.btn(t("m14.buyMore"), { kind: "secondary", go: "@quote" }) + '<p class="small" style="text-align:center">' + t("m14.buyMoreNote") + "</p>" :
        GG.btn(t("m14.review"), { go: "@review", disabled: st === "low" });
    }
    return GG.screens.M12.render("default") + GG.sheet({ tier: "full", title: t("m14.title"), desc: t("m14.desc"), body: body, acts: acts });
  }
});

/* ---------------- M15 A request that pays G$ and vouchers (linked rewards) ---------------- */
GG.T({
  "m15.kind": ["Request · {g}", "Petición · {g}", "Pedido · {g}"],
  "m15.pays": ["What it pays", "Lo que paga", "O que paga"],
  "m15.gFrom": ["From Riverside Commons Garden · on Celo", "De Riverside Commons Garden · en Celo", "Do Riverside Commons Garden · na Celo"],
  "m15.vFrom": ["From Riverside Commons Garden's vouchers · on Gnosis", "De los vales de Riverside Commons Garden · en Gnosis", "Dos vales do Riverside Commons Garden · na Gnosis"],
  "m15.never": ["Two rewards, each tracked on its own. They're never added together.", "Dos recompensas, cada una con su seguimiento. Nunca se suman.", "Duas recompensas, cada uma acompanhada separadamente. Nunca são somadas."],
  "m15.takeUp": ["Take Up", "Aceptar", "Aceitar"],
  "m15.consentT": ["Agree to These Rewards", "Acepta estas recompensas", "Aceite estas recompensas"],
  "m15.gTo": ["To your account on Celo", "A tu cuenta en Celo", "Para sua conta na Celo"],
  "m15.vTo": ["To your Gnosis wallet", "A tu billetera de Gnosis", "Para sua carteira da Gnosis"],
  "m15.again": ["If the garden changes these, you'll agree again first.", "Si el jardín los cambia, primero volverás a aceptar.", "Se o jardim mudar isso, você aceita de novo antes."],
  "m15.agreeTake": ["Agree and Take Up", "Aceptar y aceptarla", "Aceitar e assumir"],
  "m15.nog.t": ["Add a Gnosis wallet to receive vouchers", "Añade una billetera de Gnosis para recibir vales", "Adicione uma carteira da Gnosis para receber vales"],
  "m15.nog.b": ["You can't agree to a voucher reward without a wallet to receive it.", "No puedes aceptar una recompensa en vales sin una billetera donde recibirla.", "Você não pode aceitar uma recompensa em vales sem uma carteira para recebê-la."],
  "m15.rewards": ["Rewards", "Recompensas", "Recompensas"],
  "m15.received": ["Received", "Recibido", "Recebido"],
  "m15.onWay": ["On the way", "En camino", "A caminho"],
  "m15.onWaySub": ["Sent to Gnosis · waiting for delivery", "Enviado a Gnosis · esperando la entrega", "Enviado à Gnosis · aguardando a entrega"],
  "m15.gSub": ["Oct 30 · on Celo", "30 oct · en Celo", "30 out · na Celo"],
  "m15.vSub": ["Oct 30 · in your Gnosis wallet", "30 oct · en tu billetera de Gnosis", "30 out · na sua carteira da Gnosis"],
  "m15.delayed": ["Delayed", "Con retraso", "Atrasado"],
  "m15.delayedSub": ["Delivery didn't complete. Riverside Commons Garden's stewards retry; it can't arrive twice.", "La entrega no se completó. Los responsables de Riverside Commons Garden reintentan; no puede llegar dos veces.", "A entrega não foi concluída. Os responsáveis do Riverside Commons Garden tentam de novo; não pode chegar duas vezes."],
  "m15.separate": ["Using vouchers for a service is a separate step.", "Usar los vales en un servicio es otro paso.", "Usar os vales em um serviço é outra etapa."],
  "m15.work": ["Your work", "Tu trabajo", "Seu trabalho"],
  "m15.workKept": ["Confirmed kept · Oct 29", "Confirmada como cumplida · 29 oct", "Confirmada como cumprida · 29 out"]
});
GG.SCR("M15", {
  surface: "member", journey: "rw", title: "Request that pays G$ and vouchers (linked rewards)", prd: "PRD-1324", entry: false,
  states: [["open", "Open request", "default"], ["consent", "Exact reward consent", "default"], ["nognosis", "No Gnosis wallet to receive", "blocked"], ["kept", "Kept: G$ received, vouchers pending", "pending"], ["both", "Both rewards received", "success"], ["vfail", "Voucher delivery delayed", "failure"]],
  notes: {
    who: "Gardener (contributor) with the Green Goods account; voucher recipient is the bound Gnosis address.",
    pre: "Request with G$ consideration and a voucher payment term, both at a terms revision. Evidence: commitment terms and voucher terms record.",
    auth: "Exact consent to both rewards, each with amount, source, network and recipient, before acceptance.",
    out: "After confirmation, each reward has its own pending / received / delayed state. Work completion is separate from both.",
    rec: "Voucher delivery failure: requesting-garden stewards retry the same entitlement (no second delivery). G$ follows the existing payout recovery.",
    facts: "G$ through the existing payout plan (SettlementModule unchanged for this reward). Voucher payment from the requesting garden's own vouchers under its steward's approval (VoucherEntitlementModule entitlement id derived from chain, module, commitment and terms revision; GnosisVoucherAdapter delivers once, stores the result before acknowledgment).",
    tags: ["req", "sel"], dec: ["D11"]
  },
  stateNotes: {
    open: { say: "Two lines, two assets, two sources; no total.", sr: "None." },
    consent: { say: "Consent lists each reward's recipient account.", sr: "Dialog \"Agree to These Rewards\"." },
    nognosis: { say: "Consent blocked until a recipient exists.", sr: "Notice title (assertive)." },
    kept: { say: "G$ received while vouchers are still in transit; both states are normal.", sr: "None." },
    both: { say: "Both received; using vouchers is a separate step.", sr: "None." },
    vfail: { say: "Voucher reward delayed with owner named and no double delivery.", sr: "Pill text read with the row." }
  },
  render: function (st) {
    var page = '<div class="screen nobar"><div class="col">' + GG.topnav("", "M01@default") +
      '<div class="ident"><div class="kind">' + ic("request", 16) + t("m15.kind", { g: GG.D.home }) + "</div><h1>Teach two compost workshops</h1>" +
      '<div class="chips">' + (st === "kept" || st === "both" || st === "vfail" ? GG.pill("ok", t("c.kept")) : GG.pill("info", t("c.open"))) + "</div>" +
      '<p class="para">Two Saturday workshops on hot composting for new gardeners. Bring the thermometer from the shed.</p></div>';
    if (st === "kept" || st === "both" || st === "vfail") {
      var vp = st === "kept" ? GG.pill("info", t("m15.onWay")) : st === "both" ? GG.pill("ok", t("m15.received")) : GG.pill("warn", t("m15.delayed"));
      var vs = st === "kept" ? t("m15.onWaySub") : st === "both" ? t("m15.vSub") : t("m15.delayedSub");
      page += GG.sec(t("m15.work")) + '<div class="mx16">' + GG.card(GG.facts([[t("m15.work"), t("m15.workKept")]])) + "</div>" +
        GG.sec(t("m15.rewards")) + '<div class="mx16">' + GG.card('<div class="legs">' + GG.leg(GG.gd(120), GG.pill("ok", t("m15.received")), t("m15.gSub")) + GG.leg(GG.vN(20), vp, vs) + '</div><div class="tech"><span>' + t("m15.separate") + "</span></div>") + "</div>";
    } else {
      page += GG.sec(t("m15.pays")) + '<div class="mx16">' + GG.card('<div class="legs">' + GG.leg(GG.gd(120), "", t("m15.gFrom")) + GG.leg(GG.vN(20), "", t("m15.vFrom")) + '</div><div class="tech"><span>' + t("m15.never") + "</span></div>") + "</div>";
    }
    page += "</div></div>" + (st === "open" ? GG.fixedbar([GG.btn(t("m15.takeUp"), { go: "@consent" })]) : "");
    if (st !== "consent" && st !== "nognosis") return page;
    var body = GG.card(GG.facts([[t("m15.gTo"), GG.gd(120), GG.D.meAddr], [t("m15.vTo"), GG.vN(20), st === "nognosis" ? t("m08.gnoNone") : GG.D.gnoAddr], [t("m03.terms"), t("c.version", { n: 1 })]])) +
      (st === "nognosis" ? GG.notice("warn", "wallet", t("m15.nog.t"), t("m15.nog.b")) : "") + '<p class="small">' + t("m15.again") + "</p>";
    return page + GG.sheet({ tier: "half", title: t("m15.consentT"), body: body, acts: st === "nognosis" ? GG.btn(t("c.connect"), { go: "@consent" }) + GG.btn(t("c.cancel"), { kind: "secondary", go: "@open" }) : GG.btn(t("m15.agreeTake"), { go: "@kept" }) + GG.btn(t("c.cancel"), { kind: "secondary", go: "@open" }) });
  }
});

/* ---------------- M16 Promises sheet (active garden) with payment terms on rows ---------------- */
GG.T({
  "m16.live": ["Live", "Activas", "Ativas"], "m16.over": ["Over Time", "Recurrentes", "Recorrentes"], "m16.confirm": ["To Confirm", "Por confirmar", "Para confirmar"],
  "m16.d.req": ["Pays 120 G$ + 20 Sunroot vouchers", "Paga 120 G$ + 20 vales de Sunroot", "Paga 120 G$ + 20 vales de Sunroot"],
  "m16.d.bike": ["Takes 5 of Mara's Seed Library vouchers", "Acepta 5 vales de Mara's Seed Library", "Aceita 5 vales da Mara's Seed Library"],
  "m16.d.swap": ["No payment · anyone in the garden", "Sin pago · cualquiera del jardín", "Sem pagamento · qualquer pessoa do jardim"],
  "m16.count": ["4 promises", "4 promesas", "4 promessas"],
  "m16.d.barrel": ["Pays 60 G$", "Paga 60 G$", "Paga 60 G$"]
});
GG.SCR("M16", {
  surface: "member", journey: "rw", title: "Promises sheet: payment terms on rows", prd: "PRD-1324", entry: true,
  states: [["default", "Live promises", "default"]],
  notes: {
    who: "Gardener; active garden only.",
    pre: "Garden-scoped promise query plus each promise's payment terms.",
    auth: "Nothing.",
    out: "Rows keep the locked item anatomy; payment terms live in the detail line and never sum unlike assets.",
    rec: "Existing list loading and error anatomy (DL-056).",
    facts: "Offer accepted-voucher terms and Request reward terms from the voucher terms record, by revision.",
    tags: ["req", "sel"]
  },
  stateNotes: { default: { say: "\"Pays\" on requests, \"Takes\" on offers, with issuer named.", sr: "None." } },
  render: function () {
    var body = '<p class="small">' + t("m16.count") + "</p>" +
      GG.row({ icon: "request", tileKind: "req", title: "Teach two compost workshops", pill: ["info", t("c.open")], detail: t("m16.d.req"), go: "M15@open" }) +
      GG.row({ icon: "offer", title: "Tool library: bike repair hour", pill: ["ok", t("c.open")], detail: t("m16.d.bike") }) +
      GG.row({ icon: "offer", title: "Seedling swap table", pill: ["ok", t("c.open")], detail: t("m16.d.swap") }) +
      GG.row({ icon: "request", tileKind: "req", title: "Fix the rain barrel overflow", pill: ["info", t("c.open")], detail: t("m16.d.barrel") });
    return GG.screens.M01.render("default") + GG.sheet({ tier: "full", title: t("c.promises"), tabs: GG.stabs([[t("m16.live")], [t("m16.over")], [t("m16.confirm")]], 0), body: body });
  }
});
