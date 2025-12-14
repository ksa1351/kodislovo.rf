(() => {
  const cfg = window.CONTROL_CONFIG || {};
  const mode = cfg.mode || "teacher";
  const dataUrl = cfg.dataUrl || "./variant26_cut.json";

  const STORAGE_KEY = "kontrol:" + dataUrl; // автосохранение прогресса
  const ID_KEY = STORAGE_KEY + ":identity";

  const $ = (s, r=document) => r.querySelector(s);

  function percentToGrade(p){
    if (p >= 87) return 5;
    if (p >= 67) return 4;
    if (p >= 42) return 3;
    return 2;
  }

  function normText(s){
    if(s == null) return "";
    return String(s).trim().toLowerCase()
      .replaceAll("ё","е")
      .replace(/[.,;:!?]+$/g,"")
      .replace(/\s+/g," ");
  }
  function normNums(s){
    const raw = normText(s).replace(/[^0-9]/g,"");
    return raw.split("").sort().join("");
  }
  function isNumericKey(key){ return /^[0-9]+$/.test(key); }

  function checkAnswer(user, keys, modeHint){
    const u0 = normText(user);
    if(!u0) return {ok:false};

    const modeUse = modeHint || "auto";
    if (modeUse === "nums" || (modeUse !== "text" && keys.some(isNumericKey))){
      const un = normNums(user);
      const kn = keys.map(k => normNums(k));
      return {ok: kn.includes(un)};
    } else {
      // текст: игнорируем пробелы (для пар/словосочетаний)
      const un = normText(user).replace(/\s/g,"");
      const kn = keys.map(k => normText(k).replace(/\s/g,""));
      return {ok: kn.includes(un)};
    }
  }

  function downloadFile(name, text, type="application/json"){
    const blob = new Blob([text], {type});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
  }

  // Блокировка копирования (best-effort)
  function enableCopyBlock(){
    document.body.classList.add("nocopy");
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
    ["copy","cut","paste","contextmenu","selectstart","dragstart"].forEach(ev => {
      document.addEventListener(ev, stop, true);
    });
    document.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["c","x","a","s","p"].includes(k)) stop(e);
      if (e.key === "PrintScreen") stop(e);
    }, true);
  }

  // Водяной знак (усложняет OCR, но не гарантирует)
  function enableWatermark(text){
    const w = document.createElement("div");
    w.id = "wmark";
    w.innerHTML = `<div class="t">${text}</div>`;
    document.body.appendChild(w);

    let t = 0;
    setInterval(() => {
      t += 1;
      const el = w.querySelector(".t");
      if(!el) return;
      el.style.transform = `translate(-50%,-50%) rotate(-22deg) translate(${Math.sin(t/7)*12}px, ${Math.cos(t/9)*10}px)`;
    }, 250);
  }

  function appTemplate(){
    return `
      <header>
        <div class="wrap">
          <h1 id="title">Контрольная</h1>
          <div class="sub" id="subtitle"></div>

          <div class="btnbar">
            <div class="pill"><span class="tag">Баллы:</span> <span class="score" id="score">0</span>/<span class="score" id="total">0</span></div>
            <div class="pill"><span class="tag">Процент:</span> <span class="score" id="percent">0%</span></div>
            <div class="pill"><span class="tag">Отметка:</span> <span class="score" id="grade">—</span></div>
          </div>

          <div class="btnbar" id="topBtns">
            <button id="prev" class="secondary">← Предыдущее</button>
            <button id="next" class="secondary">Следующее →</button>
            <button id="check">Проверить задание</button>
            <button id="checkAll" class="${mode==="student" ? "secondary" : ""}">Проверить всё</button>
            <button id="export" class="secondary">Выгрузить результат</button>
            <button id="reset" class="secondary">Сброс</button>
            <button id="toggleKeys" class="secondary" style="${mode==="student" ? "display:none" : ""}">Ключи</button>
          </div>

          <div class="sub" id="identityLine" style="margin-top:8px; display:none"></div>
        </div>
      </header>

      <main class="wrap">
        <div class="card" id="identityCard" style="display:none">
          <div class="qid">Данные ученика</div>
          <div class="qtext">Введите <b>Фамилию и имя</b> и <b>класс</b>. Без этого начать нельзя.</div>
          <div class="ansrow">
            <input id="fio" type="text" placeholder="Фамилия Имя" autocomplete="off">
            <input id="cls" type="text" placeholder="Класс (например: 9А)" autocomplete="off" style="max-width:200px">
            <button id="start">Начать</button>
          </div>
          <div class="qhint" style="margin-top:10px">Автосохранение включено. Выгрузка будет доступна после выполнения всего варианта.</div>
        </div>

        <!-- ТЕКСТ (показывается только для нужных заданий по meta.texts.*.range) -->
        <div class="card" id="textCard" style="display:none">
          <div class="qid" id="textTitle">Текст</div>
          <div class="qtext" id="textHtml"></div>
        </div>

        <div class="grid" id="grid"></div>
      </main>
    `;
  }

  let data = null;
  let idx = 0;
  let showKeys = false;
  let identity = null;

  function saveState(){
    const state = {
      idx,
      answers: (data?.tasks||[]).reduce((m,t)=>{
        const inp = $(`#in-${t.id}`);
        const got = $(`#got-${t.id}`);
        m[t.id] = { value: inp?.value || "", checked: got?.dataset.checked === "1", points: Number(got?.dataset.points||0) };
        return m;
      }, {}),
      ts: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch{ return null; }
  }

  function saveIdentity(){
    localStorage.setItem(ID_KEY, JSON.stringify(identity));
  }
  function loadIdentity(){
    try{
      const raw = localStorage.getItem(ID_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch{ return null; }
  }

  function renderTask(t){
    const pts = Number(t.points||1);
    const keyHtml = (t.answers||[]).join(" / ");

    return `
      <section class="card" id="card-${t.id}">
        <div class="qtop">
          <div>
            <div class="qid">Задание ${t.id}</div>
            <div class="qhint">${t.hint||""}</div>
          </div>
          <div class="pill">
            <span class="tag">Баллы:</span>
            <span class="score" id="pt-${t.id}">0</span>/${pts}
          </div>
        </div>

        <div class="qtext">${t.text}</div>

        <div class="ansrow">
          <input type="text" id="in-${t.id}" placeholder="Введите ответ…" autocomplete="off" />
        </div>

        <div class="mark" id="mk-${t.id}"></div>

        <!-- КЛЮЧИ ТОЛЬКО ДЛЯ УЧИТЕЛЯ -->
        ${mode === "teacher" ? `<div class="small" id="key-${t.id}"><b>Ключ:</b> ${keyHtml}</div>` : ``}

        <div id="got-${t.id}" data-checked="0" data-points="0" style="display:none"></div>
      </section>
    `;
  }

  function applyKeysVisibility(){
    if (mode !== "teacher") return;
    (data.tasks||[]).forEach(t=>{
      const el = $(`#key-${t.id}`);
      if(!el) return;
      el.classList.toggle("show", showKeys);
    });
  }

  function updateTotals(){
    const tasks = data.tasks||[];
    const max = tasks.reduce((s,t)=>s+Number(t.points||1),0);
    let got = 0;
    tasks.forEach(t=>{
      got += Number($(`#got-${t.id}`)?.dataset.points || 0);
    });

    $("#total").textContent = String(max);
    $("#score").textContent = String(got);

    const pct = max ? Math.round(got/max*100) : 0;
    $("#percent").textContent = pct + "%";
    $("#grade").textContent = max ? String(percentToGrade(pct)) : "—";
  }

  function setMark(id, ok){
    const mk = $(`#mk-${id}`);
    if(!mk) return;
    mk.className = "mark " + (ok ? "ok":"bad");
    mk.textContent = ok ? "Верно ✅" : "Неверно ❌";
  }

  function checkCurrent(){
    const t = (data.tasks||[])[idx];
    if(!t) return;

    const inp = $(`#in-${t.id}`);
    const res = checkAnswer(inp.value, t.answers||[], t.mode||"auto");
    const pts = Number(t.points||1);

    const gotEl = $(`#got-${t.id}`);
    gotEl.dataset.checked = "1";
    gotEl.dataset.points = res.ok ? String(pts) : "0";

    $(`#pt-${t.id}`).textContent = res.ok ? String(pts) : "0";
    setMark(t.id, res.ok);

    updateTotals();
    saveState();
  }

  function checkAll(){
    (data.tasks||[]).forEach((t, i)=>{
      idx = i;
      checkCurrent();
    });
    idx = Math.min(idx, (data.tasks||[]).length-1);
    showOnlyCurrent();
  }

  function allAnswered(){
    return (data.tasks||[]).every(t => normText($(`#in-${t.id}`)?.value || "") !== "");
  }
  function allChecked(){
    return (data.tasks||[]).every(t => ($(`#got-${t.id}`)?.dataset.checked === "1"));
  }

  function exportResult(){
    if (mode === "student" && cfg.exportOnlyAfterFinish){
      if(!allAnswered() || !allChecked()){
        alert("Выгрузка доступна только после выполнения ВСЕХ заданий и проверки (нажмите «Проверить всё»).");
        return;
      }
    }

    const tasks = data.tasks||[];
    const max = tasks.reduce((s,t)=>s+Number(t.points||1),0);
    let got = 0;

    const pack = {
      meta: data.meta || {},
      identity: identity || null,
      ts: new Date().toISOString(),
      result: { got: 0, max, percent: 0, grade: 0 },
      answers: tasks.map(t=>{
        const v = $(`#in-${t.id}`)?.value || "";
        const checked = $(`#got-${t.id}`)?.dataset.checked === "1";
        const points = Number($(`#got-${t.id}`)?.dataset.points || 0);
        got += points;
        return { id: t.id, value: v, checked, points };
      })
    };

    pack.result.got = got;
    pack.result.percent = max ? Math.round(got/max*100) : 0;
    pack.result.grade = percentToGrade(pack.result.percent);

    const fioSafe = (identity?.fio || "student").replace(/[^\p{L}\p{N}_-]+/gu,"_");
    const clsSafe = (identity?.cls || "class").replace(/[^\p{L}\p{N}_-]+/gu,"_");
    const fname = `result_${clsSafe}_${fioSafe}.json`;

    downloadFile(fname, JSON.stringify(pack, null, 2), "application/json");
  }

  function resetAll(){
    if(!confirm("Сбросить все ответы?")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ID_KEY);
    location.reload();
  }

  // === Тексты: показываем только для нужных заданий по meta.texts.*.range ===
  function updateTextForTask(taskId){
    const textCard = $("#textCard");
    const textHtml = $("#textHtml");
    const textTitle = $("#textTitle");

    if(!textCard || !textHtml) return;

    const texts = data?.meta?.texts;
    if(!texts){
      textCard.style.display = "none";
      textHtml.innerHTML = "";
      if(textTitle) textTitle.textContent = "Текст";
      return;
    }

    let shown = false;
    for (const t of Object.values(texts)) {
      const r = t.range || [];
      const from = Number(r[0]);
      const to = Number(r[1]);

      if (Number.isFinite(from) && Number.isFinite(to) && taskId >= from && taskId <= to) {
        textCard.style.display = "block";
        textHtml.innerHTML = t.html || "";
        if(textTitle) textTitle.textContent = t.title || "Текст";
        shown = true;
        break;
      }
    }

    if(!shown){
      textCard.style.display = "none";
      textHtml.innerHTML = "";
      if(textTitle) textTitle.textContent = "Текст";
    }
  }

  function showOnlyCurrent(){
    const cur = (data.tasks||[])[idx];

    (data.tasks||[]).forEach((t,i)=>{
      const card = $(`#card-${t.id}`);
      if(card) card.style.display = (i===idx) ? "block" : "none";
    });

    if(cur) updateTextForTask(cur.id);
    saveState();
  }

  function goNext(){
    saveState();
    if(idx < (data.tasks||[]).length-1) idx++;
    showOnlyCurrent();
  }
  function goPrev(){
    saveState();
    if(idx > 0) idx--;
    showOnlyCurrent();
  }

  async function loadData(){
    const r = await fetch(dataUrl, {cache:"no-store"});
    if(!r.ok) throw new Error("Не удалось загрузить файл заданий: " + r.status);
    return await r.json();
  }

  async function init(){
    $("#app").innerHTML = appTemplate();

    if (mode === "student" && cfg.blockCopy) enableCopyBlock();

    data = await loadData();

    $("#title").textContent = data.meta?.title || "Контрольная";
    $("#subtitle").textContent = data.meta?.subtitle || "";

    identity = loadIdentity();
    const needId = (mode === "student" && cfg.requireIdentity);

    if (needId && (!identity || !identity.fio || !identity.cls)){
      $("#identityCard").style.display = "block";
      $("#identityLine").style.display = "none";
      $("#topBtns").style.display = "none";
      $("#textCard").style.display = "none";

      $("#start").onclick = () => {
        const fio = normText($("#fio").value);
        const cls = normText($("#cls").value).toUpperCase();
        if(!fio || fio.split(" ").length < 2){
          alert("Введите Фамилию и Имя (через пробел).");
          return;
        }
        if(!cls){
          alert("Введите класс (например: 9А).");
          return;
        }
        identity = { fio, cls };
        saveIdentity();

        $("#identityCard").style.display = "none";
        $("#topBtns").style.display = "";
        $("#identityLine").style.display = "block";
        $("#identityLine").innerHTML = `Ученик: <b>${identity.fio}</b>, класс <b>${identity.cls}</b>`;

        if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);

        buildAndRestore();
      };

      if(identity){
        $("#fio").value = identity.fio;
        $("#cls").value = identity.cls;
      }
      return;
    } else {
      $("#identityLine").style.display = needId ? "block" : "none";
      if(needId){
        $("#identityLine").innerHTML = `Ученик: <b>${identity.fio}</b>, класс <b>${identity.cls}</b>`;
        if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);
      }
    }

    buildAndRestore();
  }

  function buildAndRestore(){
    const grid = $("#grid");
    grid.innerHTML = (data.tasks||[]).map(renderTask).join("");

    $("#prev").onclick = goPrev;
    $("#next").onclick = goNext;
    $("#check").onclick = checkCurrent;

    $("#checkAll").onclick = () => {
      checkAll();
      showOnlyCurrent();
    };

    $("#export").onclick = exportResult;
    $("#reset").onclick = resetAll;

    if (mode === "teacher") {
      $("#toggleKeys").onclick = () => { showKeys = !showKeys; applyKeysVisibility(); };
    }

    const st = loadState();
    if(st){
      idx = Math.max(0, Math.min(st.idx || 0, (data.tasks||[]).length-1));
      Object.entries(st.answers || {}).forEach(([id, v]) => {
        const inp = $(`#in-${id}`);
        if(inp) inp.value = v.value || "";
        const got = $(`#got-${id}`);
        if(got){
          got.dataset.checked = v.checked ? "1":"0";
          got.dataset.points = String(v.points || 0);
        }
        const pt = $(`#pt-${id}`);
        if(pt) pt.textContent = String(v.points || 0);
        if(v.checked){
          setMark(id, (v.points||0) > 0);
        }
      });
    }

    applyKeysVisibility();
    updateTotals();
    showOnlyCurrent();

    (data.tasks||[]).forEach(t=>{
      const inp = $(`#in-${t.id}`);
      if(!inp) return;
      inp.addEventListener("input", () => saveState());
      inp.addEventListener("blur", () => saveState());
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch(err => {
      document.body.innerHTML = `<div class="wrap" style="padding:18px;color:#fff">Ошибка: ${err.message}</div>`;
    });
  });
})();
