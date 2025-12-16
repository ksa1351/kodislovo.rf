(() => {
  const cfg = window.CONTROL_CONFIG || {};
  const mode = cfg.mode || "student";
  const dataUrl = cfg.dataUrl || "./variant26_cut.json";

  // ==== обязательное для облака ====
  // cfg.submitUrl = "https://functions.yandexcloud.net/<ID_ФУНКЦИИ>"

  // ==== таймер ====
  const DURATION_MIN = Number(cfg.durationMinutes || 60);
  const WARN_10 = 10 * 60 * 1000;
  const WARN_5 = 5 * 60 * 1000;

  // ==== storage ====
  const STORAGE_KEY = "kontrol:" + dataUrl;
  const ID_KEY = STORAGE_KEY + ":identity";
  const TIMER_KEY = STORAGE_KEY + ":timer";
  const SENT_KEY = STORAGE_KEY + ":sent";

  const $ = (s, r = document) => r.querySelector(s);

  function percentToGrade(p) {
    if (p >= 87) return 5;
    if (p >= 67) return 4;
    if (p >= 42) return 3;
    return 2;
  }

  function normText(s) {
    if (s == null) return "";
    return String(s)
      .trim()
      .toLowerCase()
      .replaceAll("ё", "е")
      .replace(/[.,;:!?]+$/g, "")
      .replace(/\s+/g, " ");
  }

  function normNums(s) {
    const raw = normText(s).replace(/[^0-9]/g, "");
    return raw.split("").sort().join("");
  }

  function isNumericKey(key) {
    return /^[0-9]+$/.test(key);
  }

  function checkAnswer(user, keys, modeHint) {
    const u0 = normText(user);
    if (!u0) return { ok: false };

    const modeUse = modeHint || "auto";
    if (modeUse === "nums" || (modeUse !== "text" && (keys || []).some(isNumericKey))) {
      const un = normNums(user);
      const kn = (keys || []).map((k) => normNums(k));
      return { ok: kn.includes(un) };
    } else {
      const un = normText(user).replace(/\s/g, "");
      const kn = (keys || []).map((k) => normText(k).replace(/\s/g, ""));
      return { ok: kn.includes(un) };
    }
  }

  // best-effort: блокировка копирования
  function enableCopyBlock() {
    document.body.classList.add("nocopy");
    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };
    ["copy", "cut", "paste", "contextmenu", "selectstart", "dragstart"].forEach((ev) => {
      document.addEventListener(ev, stop, true);
    });
    document.addEventListener(
      "keydown",
      (e) => {
        const k = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && ["c", "x", "a", "s", "p"].includes(k)) stop(e);
        if (e.key === "PrintScreen") stop(e);
      },
      true
    );
  }

  // водяной знак (если нужно)
  function enableWatermark(text) {
    const w = document.createElement("div");
    w.id = "wmark";
    w.innerHTML = `<div class="t">${text}</div>`;
    document.body.appendChild(w);

    let t = 0;
    setInterval(() => {
      t += 1;
      const el = w.querySelector(".t");
      if (!el) return;
      el.style.transform = `translate(-50%,-50%) rotate(-22deg) translate(${Math.sin(t / 7) * 12}px, ${Math.cos(t / 9) * 10}px)`;
    }, 250);
  }

  // ====== КАПИТАЛИЗАЦИЯ ФИО ======
  function capWord(w) {
    const s = String(w || "").trim();
    if (!s) return "";
    // первая буква + остальное как есть (в нижний)
    return s[0].toUpperCase() + s.slice(1).toLowerCase();
  }

  function normalizeFioInput(raw) {
    // "ковалева   светлана" -> "Ковалева Светлана"
    const parts = String(raw || "")
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean)
      .slice(0, 3); // на всякий случай: ФИО
    return parts.map(capWord).join(" ");
  }

  function normalizeClassInput(raw) {
    // "10а" -> "10А"
    return String(raw || "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, 6);
  }

  function appTemplate() {
    return `
      <header>
        <div class="wrap">
          <h1 id="title">Контрольная работа</h1>

          <div class="btnbar" id="topBtns">
            <button id="prev" class="secondary">← Предыдущее</button>
            <button id="next" class="secondary">Следующее →</button>
            <button id="export">Выгрузить результат</button>
            <button id="reset" class="secondary">Сброс</button>
          </div>

          <div class="sub" id="identityLine" style="margin-top:8px; display:none"></div>
          <div class="sub" id="timerLine" style="margin-top:6px; display:none"></div>
        </div>
      </header>

      <main class="wrap">
        <div class="card" id="identityCard" style="display:none">
          <div class="qid">Данные ученика</div>
          <div class="qtext">Введите <b>Фамилию и имя</b> и <b>класс</b>.</div>
          <div class="ansrow">
            <input id="fio" type="text" placeholder="Фамилия Имя" autocomplete="off">
            <input id="cls" type="text" placeholder="Класс (например: 10А)" autocomplete="off" style="max-width:220px">
            <button id="start">Начать</button>
          </div>
          <div class="qhint" style="margin-top:10px">60 минут. За 10 и 5 минут до конца появятся напоминания. По истечении времени результаты будут автоматически отправлены.</div>
        </div>

        <div class="card" id="textCard" style="display:none">
          <div class="qid">Текст</div>
          <div class="qtext" id="textHtml"></div>
        </div>

        <div class="grid" id="grid"></div>
      </main>
    `;
  }

  let data = null;
  let idx = 0;
  let identity = null;

  // защита от повторной отправки
  let submitInFlight = false;
  let submitDone = false;
  let sentHash = null;

  // таймер
  let timer = {
    startedAt: null,
    durationMs: DURATION_MIN * 60 * 1000,
    warned10: false,
    warned5: false,
    finished: false,
  };
  let timerTick = null;

  function saveState() {
    const state = {
      idx,
      answers: (data?.tasks || []).reduce((m, t) => {
        const inp = $(`#in-${t.id}`);
        const got = $(`#got-${t.id}`);
        m[t.id] = {
          value: inp?.value || "",
          checked: got?.dataset.checked === "1",
          points: Number(got?.dataset.points || 0),
        };
        return m;
      }, {}),
      ts: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveIdentity() {
    localStorage.setItem(ID_KEY, JSON.stringify(identity));
  }

  function loadIdentity() {
    try {
      const raw = localStorage.getItem(ID_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveTimer() {
    localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  }

  function loadTimer() {
    try {
      const raw = localStorage.getItem(TIMER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSent() {
    localStorage.setItem(SENT_KEY, JSON.stringify({ submitDone, sentHash, ts: new Date().toISOString() }));
  }

  function loadSent() {
    try {
      const raw = localStorage.getItem(SENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function renderTask(t) {
    const pts = Number(t.points || 1);
    return `
      <section class="card" id="card-${t.id}">
        <div class="qtop">
          <div>
            <div class="qid">Задание ${t.id}</div>
            <div class="qhint">${t.hint || ""}</div>
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

  function setMark(id, ok) {
    const mk = $(`#mk-${id}`);
    if (!mk) return;
    mk.className = "mark " + (ok ? "ok" : "bad");
    mk.textContent = ok ? "Верно ✅" : "Неверно ❌";
  }

  function checkOne(t) {
    const inp = $(`#in-${t.id}`);
    const res = checkAnswer(inp.value, t.answers || [], t.mode || "auto");
    const pts = Number(t.points || 1);

    const gotEl = $(`#got-${t.id}`);
    gotEl.dataset.checked = "1";
    gotEl.dataset.points = res.ok ? String(pts) : "0";

    $(`#pt-${t.id}`).textContent = res.ok ? String(pts) : "0";
    setMark(t.id, res.ok);
  }

  function checkAll() {
    (data.tasks || []).forEach((t) => checkOne(t));
    saveState();
  }

  function allAnswered() {
    return (data.tasks || []).every((t) => normText($(`#in-${t.id}`)?.value || "") !== "");
  }

  function allChecked() {
    return (data.tasks || []).every((t) => $(`#got-${t.id}`)?.dataset.checked === "1");
  }

  function computeTotals() {
    const tasks = data.tasks || [];
    const max = tasks.reduce((s, t) => s + Number(t.points || 1), 0);
    let got = 0;
    tasks.forEach((t) => {
      got += Number($(`#got-${t.id}`)?.dataset.points || 0);
    });
    const percent = max ? Math.round((got / max) * 100) : 0;
    return { got, max, percent, grade: percentToGrade(percent) };
  }

  function showOnlyCurrent() {
    (data.tasks || []).forEach((t, i) => {
      const card = $(`#card-${t.id}`);
      if (card) card.style.display = i === idx ? "block" : "none";
    });
    const current = (data.tasks || [])[idx];
    if (current) updateTextCardForTaskId(Number(current.id));
    saveState();
  }

  function goNext() {
    saveState();
    if (idx < (data.tasks || []).length - 1) idx++;
    showOnlyCurrent();
  }

  function goPrev() {
    saveState();
    if (idx > 0) idx--;
    showOnlyCurrent();
  }

  async function loadData() {
    const r = await fetch(dataUrl, { cache: "no-store" });
    if (!r.ok) throw new Error("Не удалось загрузить файл заданий: " + r.status);
    return await r.json();
  }

  // ====== облако ======
  function stableStringify(obj) {
    // простой стабильный stringify для хэша
    return JSON.stringify(obj, Object.keys(obj).sort());
  }

  async function sha256Hex(str) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function buildResultPack() {
    const tasks = data.tasks || [];
    const answers = tasks.map((t) => {
      const v = $(`#in-${t.id}`)?.value || "";
      const checked = $(`#got-${t.id}`)?.dataset.checked === "1";
      const points = Number($(`#got-${t.id}`)?.dataset.points || 0);
      return { id: t.id, value: v, checked, points };
    });

    const totals = computeTotals();

    return {
      meta: data.meta || {},
      variant: (data?.meta?.variant || cfg.variant || "unknown"),
      identity: identity || null,
      ts: new Date().toISOString(),
      result: totals,
      answers,
    };
  }

  async function submitResultToCloud(pack) {
    const url = cfg.submitUrl;
    if (!url) throw new Error("submitUrl не задан в CONTROL_CONFIG");

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pack),
    });

    const txt = await r.text();
    let json = null;
    try { json = JSON.parse(txt); } catch {}

    if (!r.ok) throw new Error(`Upload failed: ${r.status} ${txt}`);
    return json || { ok: true };
  }

  async function exportResult({ auto = false } = {}) {
    // защита от повтора
    if (submitInFlight) return;

    // если уже отправляли этот же payload — не отправляем
    const pack = buildResultPack();
    const hash = await sha256Hex(JSON.stringify(pack));

    if (submitDone && sentHash === hash) {
      if (!auto) alert("Результат уже отправлен ✅");
      return;
    }

    // ограничение: только после выполнения и проверки
    if (mode === "student" && cfg.exportOnlyAfterFinish) {
      if (!allAnswered() || !allChecked()) {
        if (!auto) alert("Отправка доступна только после выполнения ВСЕХ заданий и проверки.");
        return;
      }
    }

    const btn = $("#export");
    submitInFlight = true;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Отправка…";
    }

    try {
      const resp = await submitResultToCloud(pack);

      submitDone = true;
      sentHash = hash;
      saveSent();

      if (btn) {
        btn.disabled = true;
        btn.textContent = "Отправлено ✅";
      }

      if (!auto) {
        alert("Результат отправлен ✅\n" + (resp?.key ? `Файл: ${resp.key}` : ""));
      }
    } catch (e) {
      submitInFlight = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Выгрузить результат";
      }
      if (!auto) alert("Не удалось отправить результат.\n\n" + e.message);
    }
  }

  function resetAll() {
    if (!confirm("Сбросить ответы на этом устройстве?")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ID_KEY);
    localStorage.removeItem(TIMER_KEY);
    localStorage.removeItem(SENT_KEY);
    location.reload();
  }

  // ====== таймер ======
  function fmtMs(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function startTimerIfNeeded() {
    const saved = loadTimer();
    if (saved && saved.startedAt && !saved.finished) {
      timer = saved;
    } else if (!timer.startedAt) {
      timer.startedAt = Date.now();
      timer.finished = false;
      timer.warned10 = false;
      timer.warned5 = false;
      saveTimer();
    }

    $("#timerLine").style.display = "block";

    if (timerTick) clearInterval(timerTick);
    timerTick = setInterval(async () => {
      const now = Date.now();
      const endAt = Number(timer.startedAt) + Number(timer.durationMs);
      const left = endAt - now;

      $("#timerLine").textContent = `Осталось времени: ${fmtMs(left)}`;

      if (!timer.warned10 && left <= WARN_10 && left > WARN_5) {
        timer.warned10 = true;
        saveTimer();
        alert("Через 10 минут результаты контрольной работы будут автоматически выгружены.");
      }

      if (!timer.warned5 && left <= WARN_5 && left > 0) {
        timer.warned5 = true;
        saveTimer();
        alert("Осталось 5 минут до конца контрольной.");
      }

      if (!timer.finished && left <= 0) {
        timer.finished = true;
        saveTimer();

        // автоматическая проверка + отправка
        checkAll();
        await exportResult({ auto: true });

        alert("Время вышло. Результаты отправлены.");
        clearInterval(timerTick);
      }
    }, 1000);
  }

  function buildAndRestore() {
    const grid = $("#grid");
    grid.innerHTML = (data.tasks || []).map(renderTask).join("");

    $("#prev").onclick = goPrev;
    $("#next").onclick = goNext;
    $("#export").onclick = () => exportResult({ auto: false });
    $("#reset").onclick = resetAll;

    // восстановление ответов
    const st = loadState();
    if (st) {
      idx = Math.max(0, Math.min(st.idx || 0, (data.tasks || []).length - 1));
      Object.entries(st.answers || {}).forEach(([id, v]) => {
        const inp = $(`#in-${id}`);
        if (inp) inp.value = v.value || "";
        const got = $(`#got-${id}`);
        if (got) {
          got.dataset.checked = v.checked ? "1" : "0";
          got.dataset.points = String(v.points || 0);
        }
        const pt = $(`#pt-${id}`);
        if (pt) pt.textContent = String(v.points || 0);
        if (v.checked) setMark(id, (v.points || 0) > 0);
      });
    }

    // восстановление статуса отправки
    const sent = loadSent();
    if (sent && sent.submitDone) {
      submitDone = true;
      sentHash = sent.sentHash || null;
      const btn = $("#export");
      btn.disabled = true;
      btn.textContent = "Отправлено ✅";
    }

    showOnlyCurrent();

    (data.tasks || []).forEach((t) => {
      const inp = $(`#in-${t.id}`);
      if (!inp) return;
      inp.addEventListener("input", () => saveState());
      inp.addEventListener("blur", () => saveState());
    });

    // таймер стартует после начала (после ввода данных)
    startTimerIfNeeded();
  }

  async function init() {
    $("#app").innerHTML = appTemplate();

    if (mode === "student" && cfg.blockCopy) enableCopyBlock();

    data = await loadData();
    // Разбиваем meta.textHtml на две части по <hr> (Текст 1 и Текст 2)
let textPart1 = "";
let textPart2 = "";
if (data.meta?.textHtml) {
  const parts = String(data.meta.textHtml).split("<hr>");
  textPart1 = parts[0] || "";
  textPart2 = parts.slice(1).join("<hr>") || "";
}

// функция: показываем нужный текст только для нужных заданий
function updateTextCardForTaskId(taskId){
  const card = $("#textCard");
  const box = $("#textHtml");
  if(!card || !box) return;

  if (taskId >= 1 && taskId <= 3 && textPart1) {
    card.style.display = "block";
    box.innerHTML = textPart1;
  } else if (taskId >= 23 && taskId <= 26 && textPart2) {
    card.style.display = "block";
    box.innerHTML = textPart2;
  } else {
    card.style.display = "none";
    box.innerHTML = "";
  }
}
    $("#title").textContent = data.meta?.title || "Контрольная работа";

    // текст варианта (если есть)
    if (data.meta?.textHtml) {
      $("#textCard").style.display = "block";
      $("#textHtml").innerHTML = data.meta.textHtml;
    }

    identity = loadIdentity();
    const needId = (mode === "student" && cfg.requireIdentity);

    if (needId && (!identity || !identity.fio || !identity.cls)) {
      $("#identityCard").style.display = "block";
      $("#identityLine").style.display = "none";
      $("#topBtns").style.display = "none";
      $("#textCard").style.display = "none";
      $("#timerLine").style.display = "none";

      $("#fio").addEventListener("blur", () => {
        $("#fio").value = normalizeFioInput($("#fio").value);
      });

      $("#cls").addEventListener("blur", () => {
        $("#cls").value = normalizeClassInput($("#cls").value);
      });

      $("#start").onclick = () => {
        const fio = normalizeFioInput($("#fio").value);
        const cls = normalizeClassInput($("#cls").value);

        if (!fio || fio.split(" ").length < 2) {
          alert("Введите Фамилию и Имя (через пробел).");
          return;
        }
        if (!cls) {
          alert("Введите класс (например: 10А).");
          return;
        }

        identity = { fio, cls };
        saveIdentity();

        $("#identityCard").style.display = "none";
        $("#topBtns").style.display = "";
        $("#identityLine").style.display = "block";
        $("#identityLine").innerHTML = `Ученик: <b>${identity.fio}</b>, класс <b>${identity.cls}</b>`;

        if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);

        // снова показываем текст
        if (data.meta?.textHtml) {
          $("#textCard").style.display = "block";
          $("#textHtml").innerHTML = data.meta.textHtml;
        }

        // старт таймера с нуля при первом входе
        timer = {
          startedAt: Date.now(),
          durationMs: DURATION_MIN * 60 * 1000,
          warned10: false,
          warned5: false,
          finished: false,
        };
        saveTimer();

        buildAndRestore();
      };

      return;
    }

    // если identity уже есть
    if (needId) {
      $("#identityLine").style.display = "block";
      $("#identityLine").innerHTML = `Ученик: <b>${identity.fio}</b>, класс <b>${identity.cls}</b>`;
      if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);
    }

    buildAndRestore();
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      document.body.innerHTML = `<div class="wrap" style="padding:18px;color:#fff">Ошибка: ${err.message}</div>`;
    });
  });
})();
