// Client-side player, shipped as a string into the artifact. One render model:
// every screen state is pre-baked HTML carrying data-hot / data-mark; the
// player injects it and applies context classes (primary / choice / marked /
// quiet in journeys; nav2 / info2 in the explorer). Regex backslashes are
// doubled — this is a template literal.

export const PLAYER_JS = `(function(){
  function $(id){ return document.getElementById(id); }
  var tabs = { play: [$("tab-play"), $("tabbtn-play")], screens: [$("tab-screens"), $("tabbtn-screens")], doc: [$("tab-doc"), $("tabbtn-doc")] };
  function setTab(name){
    Object.keys(tabs).forEach(function(k){
      tabs[k][0].classList.toggle("on", k === name);
      tabs[k][0].hidden = k !== name;
      tabs[k][1].classList.toggle("on", k === name);
      tabs[k][1].setAttribute("aria-selected", String(k === name));
      tabs[k][1].tabIndex = k === name ? 0 : -1;
    });
  }
  $("tabbtn-play").addEventListener("click", function(){ setTab("play"); });
  $("tabbtn-screens").addEventListener("click", function(){ setTab("screens"); });
  $("tabbtn-doc").addEventListener("click", function(){ setTab("doc"); });

  // ---- theme ----
  // Dialect tokens ship both signals: [data-theme="dark"] and a
  // prefers-color-scheme twin gated on :not([data-theme="light"]). Untouched,
  // the artifact follows the OS; the toggle pins an explicit value so dark is
  // reviewable on a light machine (and light on a dark one).
  var themeBtn = $("themebtn");
  function prefersDark(){ return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); }
  function isDark(){
    var t = document.documentElement.getAttribute("data-theme");
    return t ? t === "dark" : prefersDark();
  }
  function syncThemeBtn(){ if (themeBtn) themeBtn.setAttribute("aria-pressed", String(isDark())); }
  if (themeBtn) {
    syncThemeBtn();
    themeBtn.addEventListener("click", function(){
      document.documentElement.setAttribute("data-theme", isDark() ? "light" : "dark");
      syncThemeBtn();
    });
  }
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", syncThemeBtn);
  }

  // The device frames own their scroll; a screen taller than the frame can hide
  // the very control a scene names. Find the owning scroller so the player can
  // bring that control into view instead of leaving the caption pointing at
  // something below the fold.
  function scrollerOf(el){
    var n = el.parentElement;
    while (n && n.classList) {
      if (n.classList.contains("appscroll") || n.classList.contains("mainscroll") ||
          n.classList.contains("webbody") || n.classList.contains("dlg-body")) return n;
      n = n.parentElement;
    }
    return null;
  }
  function revealTarget(dev){
    var el = dev.querySelector("[data-hot].primary") || dev.querySelector("[data-hot].choice") || dev.querySelector(".marked");
    if (!el) return;
    // A named control inside a collapsed disclosure is invisible, and closed
    // <details> content reports phantom geometry — so first open every ancestor
    // disclosure. The state repaints per scene, so this never leaks between
    // scenes or into free explore.
    for (var anc = el.parentElement; anc; anc = anc.parentElement) {
      if (anc.tagName === "DETAILS" && !anc.open) anc.open = true;
    }
    var sc = scrollerOf(el);
    if (!sc || sc.scrollHeight - sc.clientHeight < 8) return;
    var er = el.getBoundingClientRect(), sr = sc.getBoundingClientRect();
    // Centring a control taller than the fold pushes its start off-screen, so
    // tall targets (a long radio group, an evidence list) align to their top.
    var want = er.height >= sr.height
      ? sc.scrollTop + (er.top - sr.top) - 8
      : sc.scrollTop + (er.top - sr.top) - (sr.height - er.height) / 2;
    var top = Math.max(0, Math.min(want, sc.scrollHeight - sc.clientHeight));
    if (Math.abs(top - sc.scrollTop) < 2) return;
    // Assigned, not smooth-scrolled: these scrollers sit inside transformed
    // device stages, where scrollTo({behavior:"smooth"}) is silently dropped.
    sc.scrollTop = top;
  }

  var selectedFlowGroup = "client", selectedScreenSurface = "client";
  function setFlowGroup(group){
    selectedFlowGroup = group;
    document.querySelectorAll('.surface-tab[data-flow-group]').forEach(function(tab){
      var on = tab.getAttribute("data-flow-group") === group;
      tab.classList.toggle("on", on); tab.setAttribute("aria-selected", String(on)); tab.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('.flow-catalog[data-flow-group]').forEach(function(panel){ panel.hidden = panel.getAttribute("data-flow-group") !== group; });
  }
  function setScreenSurface(surface){
    selectedScreenSurface = surface;
    document.querySelectorAll('.surface-tab[data-screen-surface]').forEach(function(tab){
      var on = tab.getAttribute("data-screen-surface") === surface;
      tab.classList.toggle("on", on); tab.setAttribute("aria-selected", String(on)); tab.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('.screen-catalog[data-screen-surface]').forEach(function(panel){ panel.hidden = panel.getAttribute("data-screen-surface") !== surface; });
  }
  document.querySelectorAll('.surface-tab[data-flow-group]').forEach(function(tab){ tab.addEventListener("click", function(){ setFlowGroup(tab.getAttribute("data-flow-group")); }); });
  document.querySelectorAll('.surface-tab[data-screen-surface]').forEach(function(tab){ tab.addEventListener("click", function(){ setScreenSurface(tab.getAttribute("data-screen-surface")); }); });
  setFlowGroup(selectedFlowGroup); setScreenSurface(selectedScreenSurface);

  var SURFACE = { pwa: "Client PWA", admin: "Admin console", editorial: "Editorial website", community: "Community PWA", safe: "Safe app (external)" };

  // ---- shared: screen/state lookup + alias resolution ----
  function resolveRef(ref){
    var at = ref.indexOf("@");
    var base = at === -1 ? ref : ref.slice(0, at);
    var state = at === -1 ? "" : ref.slice(at + 1);
    var al = DATA.aliases[base];
    if (al) {
      var alAt = al.indexOf("@");
      base = alAt === -1 ? al : al.slice(0, alAt);
      if (!state && alAt !== -1) state = al.slice(alAt + 1);
    }
    return { id: base, state: state };
  }
  function screenOf(id){ return DATA.screens[id] || null; }
  function stateOf(scr, v){
    if (!scr) return null;
    for (var i = 0; i < scr.states.length; i++) if (scr.states[i].id === v) return scr.states[i];
    return scr.states[0];
  }
  function paintDevice(dev, scr, st, extraMf){
    dev.className = "device hf s-" + scr.surface + " f-" + scr.frame + ((st.proposed || extraMf) ? " mf" : "");
    dev.setAttribute("role", "group");
    dev.setAttribute("aria-label", scr.title + (scr.states.length > 1 ? " — " + st.label : ""));
    var body = "";
    if (st.proposed || extraMf) body += '<div class="mftag">' + (scr.frame === "ascii" ? "proposed lo-fi" : "proposed") + "</div>";
    dev.innerHTML = body + st.html;
    dev.querySelectorAll("button").forEach(function(el){ if (!el.getAttribute("type")) el.setAttribute("type", "button"); });
    dev.querySelectorAll("[data-hot]").forEach(function(el){
      if (el.closest("[inert]")) return;
      var h = DATA.hots[el.getAttribute("data-hot")];
      if (!el.getAttribute("aria-label") && h) el.setAttribute("aria-label", h.l);
      var nativeSelf = /^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName);
      var nativeChild = el.querySelector && el.querySelector("button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary");
      // A hotspot container that owns a real control must not become a second,
      // nested button. Its native descendant remains the keyboard entry point;
      // clicks and Enter/Space still bubble to the nearest data-hot owner.
      if (!nativeSelf && !nativeChild) {
        el.setAttribute("role", "button");
        el.tabIndex = 0;
      } else if (!nativeSelf) {
        el.removeAttribute("role");
        el.removeAttribute("tabindex");
      }
    });
  }
  function isLiveHot(el){ return !!el && !el.closest("[inert]"); }
  function liveHots(dev){
    return Array.prototype.filter.call(dev.querySelectorAll("[data-hot]"), isLiveHot);
  }
  function eachHot(dev, hid, fn){
    dev.querySelectorAll('[data-hot="' + hid + '"]').forEach(function(el){ if (isLiveHot(el)) fn(el); });
  }
  function paintMarks(dev, marks){
    (marks || []).forEach(function(mid){
      dev.querySelectorAll('[data-hot="' + mid + '"], [data-mark~="' + mid + '"]').forEach(function(el){ el.classList.add("marked"); });
    });
  }
  // Reveal-on-mis-click: a tap that misses every hotspot briefly flashes a ring
  // on all live hotspots so the player sees where the real controls are. The CSS
  // pulses under motion and falls back to a static ring under reduced-motion; the
  // class is stripped after the flash either way.
  var flashTimer = null;
  function flashHots(dev){
    if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
    var els = liveHots(dev);
    els.forEach(function(el){ el.classList.remove("flash"); });
    void dev.offsetWidth; // restart the animation on repeat mis-clicks
    els.forEach(function(el){ el.classList.add("flash"); });
    flashTimer = setTimeout(function(){
      liveHots(dev).forEach(function(el){ el.classList.remove("flash"); });
      flashTimer = null;
    }, 640);
  }
  function goTarget(to){
    if (to.indexOf("screen:") === 0) { setTab("screens"); openScreen(to.slice(7), true); return; }
    var p = to.split(":"); setTab("play"); start(p[0], +p[1]);
  }

  // ---------- journey player ----------
  var curSb = null, curI = 0;
  function findSb(id){ for (var k = 0; k < DATA.sbs.length; k++) if (DATA.sbs[k].id === id) return DATA.sbs[k]; return null; }
  // A flow's home surface is its group — no prose sniffing. Scenes that land
  // elsewhere carry their own surface token and are marked as echoes.
  var HOME = { client: "pwa", admin: "admin", editorial: "editorial" };
  function showHome(){
    curSb = null;
    $("stage").classList.remove("on");
    $("home").style.display = "";
    if (history.replaceState) history.replaceState(null, "", "#play");
  }
  function start(id, ix){
    var sb = findSb(id); if (!sb) return;
    if (sb.reviewVisible) setFlowGroup(sb.reviewGroup);
    curSb = sb; curI = Math.min(Math.max(ix || 0, 0), sb.steps.length - 1);
    $("home").style.display = "none";
    $("stage").classList.add("on");
    render();
  }
  function inspect(label, info, to){
    var el = $("insp");
    el.classList.add("on");
    el.textContent = "";
    var b = document.createElement("b"); b.textContent = label; el.appendChild(b);
    if (info) el.appendChild(document.createTextNode(info));
    var ia = document.createElement("div"); ia.className = "ia";
    if (to) {
      var go = document.createElement("button");
      go.textContent = to.indexOf("screen:") === 0 ? "Open this screen" : "Walk it";
      go.addEventListener("click", function(){ goTarget(to); });
      ia.appendChild(go);
    }
    var x = document.createElement("button"); x.textContent = "Dismiss";
    x.addEventListener("click", function(){ el.classList.remove("on"); });
    ia.appendChild(x);
    el.appendChild(ia);
  }
  function render(){
    var sb = curSb; if (!sb) return;
    var sc = sb.steps[curI];
    $("insp").classList.remove("on");
    $("st-title").textContent = sb.title;
    $("st-persona").textContent = sb.persona;
    var effSurface = sc.surface || HOME[sb.reviewGroup];
    $("st-surface").textContent = SURFACE[effSurface] || "";
    $("st-surface").classList.toggle("echo", !!sc.echo);
    $("st-progress").textContent = "Step " + (curI + 1) + " of " + sb.steps.length;
    var device = $("device");
    var scr = screenOf(sc.f);
    var st = stateOf(scr, sc.v);
    if (!scr || !st) { device.textContent = "screen missing: " + sc.f; return; }
    paintDevice(device, scr, st, !!sc.mf);
    // An echo is the same moment landing on another surface. Reviewers were
    // reading these as screens they were driving, so say so on the frame — the
    // stagebar pill alone is chrome the eye learns to skip.
    if (sc.echo) {
      device.classList.add("echo");
      var etag = document.createElement("div");
      etag.className = "echotag";
      etag.textContent = "Meanwhile — " + (SURFACE[effSurface] || "");
      device.prepend(etag);
    }
    if (sc.hot) eachHot(device, sc.hot.h, function(el){ el.classList.add("primary"); el.setAttribute("aria-label", sc.hot.l + " — advance"); });
    (sc.alts || []).forEach(function(a){ eachHot(device, a.h, function(el){ el.classList.add("choice"); el.setAttribute("aria-label", a.l); }); });
    paintMarks(device, sc.marks);
    liveHots(device).forEach(function(el){
      if (!el.classList.contains("primary") && !el.classList.contains("choice")) el.classList.add("quiet");
    });
    var hint = $("hint");
    // The keyboard/alternatives legend earns its space once per flow; repeating
    // it on every scene turns the caption into chrome the reader learns to skip.
    var legend = curI === 0;
    if (sc.hot) { hint.innerHTML = ""; hint.appendChild(document.createTextNode("tap: ")); var bb = document.createElement("b"); bb.textContent = sc.hot.l; hint.appendChild(bb); if (legend) { var kk = document.createElement("span"); kk.className = "kbd"; kk.textContent = "  (or →) · outlined controls branch · dotted controls explain themselves"; hint.appendChild(kk); } }
    else { hint.innerHTML = ""; hint.appendChild(document.createTextNode("system step ")); if (legend) { var k2 = document.createElement("span"); k2.className = "kbd"; k2.textContent = "(→ to continue) · outlined controls branch · dotted controls explain themselves"; hint.appendChild(k2); } }
    $("st-state").textContent = sc.st || "—";
    $("st-who").textContent = sc.who ? "acting: " + sc.who : "";
    $("st-ev").textContent = sc.ev;
    $("st-cite").textContent = sc.cite || "";
    var noteEl = $("st-note");
    if (sc.note) { noteEl.hidden = false; noteEl.textContent = sc.note; } else { noteEl.hidden = true; }
    var brs = $("st-brs"); brs.textContent = "";
    (sc.br || []).forEach(function(b){
      var el = document.createElement("button");
      el.className = "br";
      el.textContent = "↳ " + b.l;
      el.addEventListener("click", function(){ goTarget(b.to); });
      brs.appendChild(el);
    });
    var dots = $("dots"); dots.textContent = "";
    for (var d = 0; d < sb.steps.length; d++) (function(dd){
      var el = document.createElement("button");
      el.className = "dot" + (dd === curI ? " on" : "");
      el.setAttribute("aria-label", "step " + (dd + 1));
      if (dd === curI) el.setAttribute("aria-current", "step");
      el.addEventListener("click", function(){ curI = dd; render(); });
      dots.appendChild(el);
    })(d);
    $("prevbtn").disabled = curI === 0;
    var last = curI === sb.steps.length - 1;
    $("nextbtn").textContent = last ? "✓" : "›";
    $("nextbtn").setAttribute("aria-label", last ? "Finish flow" : "Next step");
    $("nextbtn").classList.toggle("done", last);
    if (history.replaceState) history.replaceState(null, "", "#" + sb.id + "/" + curI);
    // Synchronous on purpose: getBoundingClientRect/scrollHeight force the
    // layout this needs, and rAF is throttled in background tabs — a scene must
    // never paint with its own named control parked below the fold.
    revealTarget(device);
  }
  function next(){
    if (!curSb) return;
    if (curI < curSb.steps.length - 1) { curI++; render(); }
    else showHome();
  }
  function prev(){ if (curSb && curI > 0) { curI--; render(); } }
  $("backbtn").addEventListener("click", showHome);
  $("nextbtn").addEventListener("click", next);
  $("prevbtn").addEventListener("click", prev);
  $("device").addEventListener("click", function(e){
    if (!curSb) return;
    var el = e.target.closest ? e.target.closest("[data-hot]") : null;
    if (!el || !$("device").contains(el) || !isLiveHot(el)) { flashHots($("device")); return; }
    var hid = el.getAttribute("data-hot");
    var sc = curSb.steps[curI];
    if (sc.hot && sc.hot.h === hid) { next(); return; }
    var alt = null;
    (sc.alts || []).forEach(function(a){ if (a.h === hid) alt = a; });
    if (alt) { goTarget(alt.to); return; }
    var h = DATA.hots[hid];
    inspect(h ? h.l : hid, (h && h.info) || "", h && h.to);
  }, true);
  // Disabled-looking preview controls do not dispatch click in every browser.
  // Pointer-up capture preserves the same "show me the real controls" response.
  $("device").addEventListener("pointerup", function(e){
    if (!curSb || !(e.target.closest && e.target.closest(":disabled"))) return;
    flashHots($("device"));
  }, true);

  // ---------- screens explorer ----------
  var expCur = null, expState = "", expStack = [];
  function expHash(){
    if (history.replaceState) history.replaceState(null, "", "#screens/" + expCur + (expState && expState !== screenOf(expCur).states[0].id ? "@" + expState : ""));
  }
  function openScreen(ref, push){
    var r = resolveRef(ref);
    var scr = screenOf(r.id);
    if (!scr) return;
    if (scr.reviewVisible && scr.surface !== "community") setScreenSurface(scr.surface);
    if (push && expCur) expStack.push(expCur + (expState ? "@" + expState : ""));
    expCur = r.id;
    expState = r.state || scr.states[0].id;
    $("exphome").style.display = "none";
    $("expstage").classList.add("on");
    renderExp();
  }
  function renderExp(){
    var scr = screenOf(expCur);
    var st = stateOf(scr, expState);
    expState = st.id;
    $("exp-key").textContent = scr.id;
    $("exp-title").textContent = scr.title.replace(/^\\s*(?:W\\d+a?|HUBWORK|WFLOW)\\s*[·—:-]\\s*/i, "");
    var chips = $("expstates"); chips.textContent = "";
    if (scr.states.length > 1) {
      scr.states.forEach(function(s2){
        var c = document.createElement("button");
        c.className = "vchip" + (s2.id === st.id ? " on" : "") + (s2.proposed ? " prop" : "");
        c.textContent = s2.label;
        c.setAttribute("aria-pressed", String(s2.id === st.id));
        c.addEventListener("click", function(){ expState = s2.id; renderExp(); });
        chips.appendChild(c);
      });
    }
    var dev = $("expdevice");
    paintDevice(dev, scr, st, false);
    liveHots(dev).forEach(function(el){
      var h = DATA.hots[el.getAttribute("data-hot")];
      el.classList.add(h && h.to ? "nav2" : "info2");
    });
    $("expback").style.visibility = expStack.length ? "visible" : "hidden";
    $("expback").disabled = !expStack.length;
    expInspectClear();
    expHash();
  }
  $("expdevice").addEventListener("click", function(e){
    var el = e.target.closest ? e.target.closest("[data-hot]") : null;
    if (!el || !$("expdevice").contains(el) || !isLiveHot(el)) { flashHots($("expdevice")); return; }
    var hid = el.getAttribute("data-hot");
    var h = DATA.hots[hid];
    if (!h) return;
    if (h.to && h.to.indexOf("screen:") === 0) { expInspect(h.l, h.info || "", null); openScreen(h.to.slice(7), true); }
    else expInspect(h.l, h.info || "", null);
  }, true);
  $("expdevice").addEventListener("pointerup", function(e){
    if (!(e.target.closest && e.target.closest(":disabled"))) return;
    flashHots($("expdevice"));
  }, true);
  function expInspect(label, info, to){
    var el = $("expinsp");
    el.className = "insp on";
    el.textContent = "";
    var b = document.createElement("b"); b.textContent = label + "  "; el.appendChild(b);
    el.appendChild(document.createTextNode(info));
    if (to) {
      var go = document.createElement("button"); go.textContent = "Open flow"; go.className = "walkbtn";
      go.addEventListener("click", function(){ goTarget(to); });
      el.appendChild(go);
    }
  }
  function expInspectClear(){ var el = $("expinsp"); el.textContent = ""; el.className = ""; }
  function expHome(){
    expCur = null; expState = ""; expStack = [];
    $("expstage").classList.remove("on");
    $("exphome").style.display = "";
    if (history.replaceState) history.replaceState(null, "", "#screens");
  }
  $("expall").addEventListener("click", expHome);
  $("expback").addEventListener("click", function(){
    var prevId = expStack.pop();
    if (prevId) { expCur = null; openScreen(prevId, false); }
    else expHome();
    $("expback").style.visibility = expStack.length ? "visible" : "hidden";
    $("expback").disabled = !expStack.length;
  });
  document.querySelectorAll(".sbcard.sc").forEach(function(el){
    el.addEventListener("click", function(){ expStack = []; openScreen(el.getAttribute("data-frame"), false); });
  });
  document.querySelectorAll(".sbcard[data-sb]").forEach(function(el){
    el.addEventListener("click", function(){ start(el.getAttribute("data-sb"), 0); });
  });

  // keyboard + swipe
  document.addEventListener("keydown", function(e){
    var editable = e.target && e.target.closest ? e.target.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])') : null;
    if (editable) return;
    var hot = e.target && e.target.closest ? e.target.closest("[data-hot]") : null;
    if (hot && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault(); hot.click(); return;
    }
    if (e.target && e.target.getAttribute && e.target.getAttribute("role") === "tab") {
      var list = e.target.closest("[role=tablist]");
      if (list && (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End")) {
        var ts = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]:not([disabled])'));
        var ix = ts.indexOf(e.target);
        var nx = e.key === "Home" ? 0 : e.key === "End" ? ts.length - 1 : (ix + (e.key === "ArrowRight" ? 1 : -1) + ts.length) % ts.length;
        ts[nx].focus(); ts[nx].click(); e.preventDefault(); return;
      }
    }
    if (!tabs.play[0].classList.contains("on") || !curSb) return;
    if (e.key === "ArrowRight") { next(); e.preventDefault(); }
    if (e.key === "ArrowLeft") { prev(); e.preventDefault(); }
    if (e.key === "Escape") showHome();
  });
  var swipeX = null;
  function finishSwipe(x){
    if (swipeX === null) return;
    var dx = x - swipeX; swipeX = null;
    if (Math.abs(dx) < 48) return;
    if (dx < 0) next(); else prev();
  }
  if ("PointerEvent" in window) {
    $("stage").addEventListener("pointerdown", function(e){ if (e.button === 0) swipeX = e.clientX; });
    $("stage").addEventListener("pointerup", function(e){ finishSwipe(e.clientX); });
    $("stage").addEventListener("pointercancel", function(){ swipeX = null; });
  } else {
    $("stage").addEventListener("touchstart", function(e){ swipeX = e.changedTouches[0].clientX; }, { passive: true });
    $("stage").addEventListener("touchend", function(e){ finishSwipe(e.changedTouches[0].clientX); }, { passive: true });
  }

  // ---- hash routing ----
  // render()/renderExp() write the hash with replaceState, which fires no
  // hashchange — so this re-runs only for real navigation: Back/Forward, a
  // pasted deep link, an edited address bar. Without the listener the hash and
  // the view diverge the first time a reviewer presses Back, and a hash pasted
  // into an already-open tab does nothing.
  function applyHash(){
    var h = location.hash.replace("#", "");
    if (!h || h === "play") { setTab("play"); if (curSb) showHome(); return; }
    var mPlay = h.match(/^(sb[\\w-]+)\\/(\\d+)$/);
    if (mPlay && findSb(mPlay[1])) { setTab("play"); start(mPlay[1], +mPlay[2]); return; }
    var mScr = h.match(/^screens\\/([\\w.@-]+)$/);
    if (mScr) {
      setTab("screens");
      if (screenOf(resolveRef(mScr[1]).id)) { expStack = []; openScreen(mScr[1], false); }
      else expHome();
      return;
    }
    if (h === "screens") { setTab("screens"); expHome(); return; }
    setTab("doc");
    var t = document.getElementById(h);
    if (t) t.scrollIntoView();
  }
  applyHash();
  window.addEventListener("hashchange", applyHash);

  if ("IntersectionObserver" in window) {
    var links = Array.prototype.slice.call(document.querySelectorAll("nav.doc a[href^='#']"));
    var map = {};
    links.forEach(function(a){ map[a.getAttribute("href").slice(1)] = a; });
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting) {
          links.forEach(function(a){ a.classList.remove("on"); });
          var a = map[en.target.id]; if (a) a.classList.add("on");
        }
      });
    }, { rootMargin: "0px 0px -75% 0px" });
    document.querySelectorAll("#tab-doc section[id]").forEach(function(s){ obs.observe(s); });
  }
})();`;
