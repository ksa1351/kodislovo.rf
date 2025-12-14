(() => {
  const cfg = window.CONTROL_CONFIG || {};
  const mode = cfg.mode || "teacher";
  const dataUrl = cfg.dataUrl || "./variant26_cut.json";

  // 60 минут по умолчанию (можно переопределить в CONTROL_CONFIG.timeLimitMinutes)
  const TIME_LIMIT_MIN = Number(cfg.timeLimitMinutes ?? 60);

  const STORAGE_KEY = "kontrol:" + dataUrl;
  const ID_KEY = STORAGE_KEY + ":identity";
  const START_KEY = STORAGE_KEY + ":startTs";
  const AUTOEXPORTED_KEY = STORAGE_KEY + ":autoExported"; // чтобы не выгружать дважды
  const WARN10_KEY = STORAGE_KEY + ":warn10";
  const WARN5_KEY  = STORAGE_KEY + ":warn5";

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

  // ФИО: каждое слово с большой буквы
  function capitalizeWords(s){
    return String(s || "")
      .split(" ")
      .filter(Boolean)
      .map(w => w ? (w[0].toUpperCase() + w.slice(1)) : "")
      .join(" ");
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

  // === Минимальная шапка: только "Контрольная работа" + нужные кнопки + таймер ===
  function appTemplate(){
    return `
      <header>
        <div class="wrap">
          <h1 id="title">Контрольная работа</h1>

          <div class="btnbar" id="topBtns">
            <button id="prev" class="secondary">← Предыдущее</button>
            <button id="next" class="secondary">Следующее →</button>
            <button id="export" class="secondary">Выгрузить результат</button>
            <button id="reset" class="secondary">Сброс</button>

            <div class="pill" id="timerPill" style="margin-left:auto; display:none">
              <span class="tag">Осталось:</span> <span class="score" id="timer">60:00</span>
            </div>
          </div>

          <div class="sub" id="identityLine" style="margin-top:8px; display:none"></div>
        </div>
      </header>

      <main class="wrap">
        <div class="card" id="timeUpCard" style="display:none">
          <div class="qid">Время вышло</div>
          <div class="qtext">Контрольная работа завершена. Результаты выгружены автоматически.</div>
        </div>

        <div class="card" id="identityCard" style="display:none">
          <div class="qid">Данные ученика</div>
          <div class="qtext">Введите <b>Фамилию и имя</b> и <b>класс</b>. Без этого начать нельзя.</div>
          <div class="ansrow">
            <input id="fio" type="text" placeholder="Фамилия Имя" autocomplete="off">
            <input id="cls" type="text" placeholder="Класс (например: 9А)" autocomplete="off" style="max-width:200px">
            <button id="start">Начать</button>
          </div>
          <div class="qhint" style="margin-top:10px">На выполнение: <b>${TIME_LIMIT_MIN} мин</b>. По окончании времени результат выгружается автоматически.</div>
        </div>

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
  let identity = null;

  let timerId = null;
  let startTs = null;

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

  function saveIdentity(){ localStorage.setItem(ID_KEY, JSON.stringify(identity)); }
  function loadIdentity(){
    try{
      const raw = localStorage.getItem(ID_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch{ return null; }
  }

  function setStartTs(ts){
    startTs = ts;
    localStorage.setItem(START_KEY, String(ts));
  }
  function loadStartTs(){
    const raw = localStorage.getItem(START_KEY);
    const ts = raw ? Number(raw) : NaN;
    return Number.isFinite(ts) ? ts : null;
  }

  function renderTask(t){
    const pts = Number(t.points||1);
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
        <div id="got-${t.id}" data-checked="0" data-points="0" style="display:none"></div>
      </section>
    `;
  }

  function setMark(id, ok){
    const mk = $(`#mk-${id}`);
    if(!mk) return;
    mk.className = "mark " + (ok ? "ok":"bad");
    mk.textContent = ok ? "Верно ✅" : "Неверно ❌";
  }

  function checkTaskById(task){
    const inp = $(`#in-${task.id}`);
    const res = checkAnswer(inp?.value || "", task.answers||[], task.mode||"auto");
    const pts = Number(task.points||1);

    const gotEl = $(`#got-${task.id}`);
    gotEl.dataset.checked = "1";
    gotEl.dataset.points = res.ok ? String(pts) : "0";

    $(`#pt-${task.id}`).textContent = res.ok ? String(pts) : "0";
    setMark(task.id, res.ok);

    return { ok: res.ok, points: res.ok ? pts : 0, max: pts };
  }

  function checkAllSilent(){
    let got = 0, max = 0;
    (data.tasks||[]).forEach((t)=>{
      const r = checkTaskById(t);
      got += r.points;
      max += r.max;
    });
    saveState();
    return { got, max, percent: max ? Math.round(got/max*100) : 0 };
  }

  function allAnswered(){
    return (data.tasks||[]).every(t => normText($(`#in-${t.id}`)?.value || "") !== "");
  }

  function exportResult(force=false){
    if (mode === "student" && cfg.exportOnlyAfterFinish && !force){
      if(!allAnswered()){
        alert("Выгрузка доступна только после выполнения ВСЕХ заданий.");
        return;
      }
    }

    const calc = checkAllSilent();

    const pack = {
      meta: data.meta || {},
      identity: identity || null,
      ts: new Date().toISOString(),
      result: {
        got: calc.got,
        max: calc.max,
        percent: calc.percent,
        grade: percentToGrade(calc.percent),
        timeLimitMinutes: TIME_LIMIT_MIN,
        startedAt: startTs ? new Date(startTs).toISOString() : null,
        finishedAt: new Date().toISOString(),
        autoExport: !!force
      },
      answers: (data.tasks||[]).map(t=>{
        const v = $(`#in-${t.id}`)?.value || "";
        const checked = $(`#got-${t.id}`)?.dataset.checked === "1";
        const points = Number($(`#got-${t.id}`)?.dataset.points || 0);
        return { id: t.id, value: v, checked, points };
      })
    };

    const fioSafe = (identity?.fio || "student").replace(/[^\p{L}\p{N}_-]+/gu,"_");
    const clsSafe = (identity?.cls || "class").replace(/[^\p{L}\p{N}_-]+/gu,"_");
    const fname = `result_${clsSafe}_${fioSafe}.json`;
    downloadFile(fname, JSON.stringify(pack, null, 2), "application/json");
  }

  function lockUIAndHideButtons(){
    // блокируем вводы
    (data.tasks||[]).forEach(t=>{
      const inp = $(`#in-${t.id}`);
      if(inp) inp.disabled = true;
    });

    // прячем/блокируем кнопки
    const btnIds = ["prev","next","export","reset"];
    btnIds.forEach(id=>{
      const b = $("#"+id);
      if(b){
        b.disabled = true;
        b.style.display = "none";
      }
    });

    const top = $("#topBtns");
    if(top) top.style.display = "none";
  }

  function showTimeUpMessage(){
    const c = $("#timeUpCard");
    if(c) c.style.display = "block";
  }

  function onTimeUp(){
    // чтобы не повторять выгрузку
    if (localStorage.getItem(AUTOEXPORTED_KEY) === "1") return;
    localStorage.setItem(AUTOEXPORTED_KEY, "1");

    try { lockUIAndHideButtons(); } catch {}
    try { showTimeUpMessage(); } catch {}

    // форс-выгрузка (даже если не все ответы заполнены)
    try { exportResult(true); } catch {}
  }

  function warnOnce(key, msg){
    if(localStorage.getItem(key) === "1") return;
    localStorage.setItem(key, "1");
    try { alert(msg); } catch {}
  }

  function formatLeft(ms){
    const s = Math.max(0, Math.floor(ms/1000));
    const mm = String(Math.floor(s/60)).padStart(2,"0");
    const ss = String(s%60).padStart(2,"0");
    return `${mm}:${ss}`;
  }

  function startTimerIfNeeded(){
    if (mode !== "student") return;
    if (!Number.isFinite(TIME_LIMIT_MIN) || TIME_LIMIT_MIN <= 0) return;

    const pill = $("#timerPill");
    const out = $("#timer");
    if(pill) pill.style.display = "";
    if(out) out.textContent = `${String(TIME_LIMIT_MIN).padStart(2,"0")}:00`;

    const saved = loadStartTs();
    if(saved) startTs = saved;
    else setStartTs(Date.now());

    const limitMs = TIME_LIMIT_MIN * 60 * 1000;

    // если уже истекло
    const elapsed = Date.now() - startTs;
    if(elapsed >= limitMs){
      if(out) out.textContent = "00:00";
      onTimeUp();
      return;
    }

    clearInterval(timerId);
    timerId = setInterval(() => {
      const left = limitMs - (Date.now() - startTs);

      if(out) out.textContent = formatLeft(left);

      // напоминалки
      if(left <= 10*60*1000 && left > 5*60*1000){
        warnOnce(WARN10_KEY, "Через 10 минут результаты контрольной работы будут автоматически выгружены.");
      }
      if(left <= 5*60*1000 && left > 0){
        warnOnce(WARN5_KEY, "Через 5 минут результаты контрольной работы будут автоматически выгружены.");
      }

      if(left <= 0){
        if(out) out.textContent = "00:00";
        clearInterval(timerId);
        onTimeUp();
      }
    }, 500);
  }

  function resetAll(){
    if(!confirm("Сбросить все ответы?")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ID_KEY);
    localStorage.removeItem(START_KEY);
    localStorage.removeItem(AUTOEXPORTED_KEY);
    localStorage.removeItem(WARN10_KEY);
    localStorage.removeItem(WARN5_KEY);
    location.reload();
  }

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
    $("#title").textContent = "Контрольная работа";

    identity = loadIdentity();
    const needId = (mode === "student" && cfg.requireIdentity);

    // если время уже вышло ранее — сразу показываем экран завершения
    const savedStart = loadStartTs();
    if(mode === "student" && savedStart && Number.isFinite(TIME_LIMIT_MIN) && TIME_LIMIT_MIN > 0){
      const limitMs = TIME_LIMIT_MIN * 60 * 1000;
      if(Date.now() - savedStart >= limitMs){
        // восстановим интерфейс заданий, но заблокируем и покажем сообщение
        buildAndRestore();
        lockUIAndHideButtons();
        showTimeUpMessage();
        onTimeUp();
        return;
      }
    }

    if (needId && (!identity || !identity.fio || !identity.cls)){
      $("#identityCard").style.display = "block";
      $("#identityLine").style.display = "none";
      $("#topBtns").style.display = "none";
      $("#textCard").style.display = "none";

      $("#start").onclick = () => {
        let fio = normText($("#fio").value);
        const cls = normText($("#cls").value).toUpperCase();

        fio = capitalizeWords(fio);

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

        // старт таймера
        setStartTs(Date.now());
        localStorage.removeItem(AUTOEXPORTED_KEY);
        localStorage.removeItem(WARN10_KEY);
        localStorage.removeItem(WARN5_KEY);

        buildAndRestore();
        startTimerIfNeeded();
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
    startTimerIfNeeded();
  }

  function buildAndRestore(){
    const grid = $("#grid");
    grid.innerHTML = (data.tasks||[]).map(renderTask).join("");

    $("#prev").onclick = goPrev;
    $("#next").onclick = goNext;
    $("#export").onclick = () => exportResult(false);
    $("#reset").onclick = resetAll;

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
