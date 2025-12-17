(() => {
  "use strict";

  // ========= helpers =========
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function showFatal(err) {
    const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    document.documentElement.style.background = "#0b1020";
    document.body.innerHTML = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;padding:18px;color:#fff">
        <h2 style="margin:0 0 10px">Ошибка в контрольной</h2>
        <pre style="white-space:pre-wrap;background:rgba(255,255,255,.06);padding:12px;border-radius:12px">${escapeHtml(msg)}</pre>
        <div style="opacity:.85;margin-top:10px">Открой консоль (F12 → Console), там будет та же ошибка.</div>
      </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[m]));
  }

  function normText(s) {
    if (s == null) return "";
    return String(s).trim().replace(/\s+/g, " ");
  }

  function capWord(w) {
    const s = String(w || "").trim();
    if (!s) return "";
    return s[0].toUpperCase() + s.slice(1).toLowerCase();
  }

  function normalizeFioInput(raw) {
    const parts = String(raw || "")
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean)
      .slice(0, 3);
    return parts.map(capWord).join(" ");
  }

  function normalizeClassInput(raw) {
    return String(raw || "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, 6);
  }

  function saveJSON(key, obj) {
    localStorage.setItem(key, JSON.stringify(obj));
  }

  function loadJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function sha256Hex(str) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function fmtMs(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  // best-effort: блокировка копирования (опционально)
  function enableCopyBlock() {
    document.body.classList.add("nocopy");
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
    ["copy", "cut", "paste", "contextmenu", "selectstart", "dragstart"].forEach((ev) => {
      document.addEventListener(ev, stop, true);
    });
    document.addEventListener("keydown", (e) => {
      const k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "a", "s", "p"].includes(k)) stop(e);
      if (e.key === "PrintScreen") stop(e);
    }, true);
  }

  // водяной знак (опционально)
  function enableWatermark(text) {
    const w = document.createElement("div");
    w.id = "wmark";
    w.innerHTML = `<div class="t">${escapeHtml(text)}</div>`;
    document.body.appendChild(w);

    let t = 0;
    setInterval(() => {
      t += 1;
      const el = w.querySelector(".t");
      if (!el) return;
      el.style.transform =
        `translate(-50%,-50%) rotate(-22deg) translate(${Math.sin(t / 7) * 12}px, ${Math.cos(t / 9) * 10}px)`;
    }, 250);
  }

  // ========= CSS стили =========
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Общие стили */
      :root {
        --bg: #0b1020;
        --card-bg: rgba(18, 26, 51, 0.9);
        --text: #e1e7f5;
        --text-muted: #8a9bba;
        --accent: #2d4bff;
        --accent-hover: #1d3bff;
        --danger: #ff5b6e;
        --success: #35d07f;
        --warning: #ffb020;
        --border: rgba(255,255,255,0.1);
        --radius: 12px;
      }
      
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      body {
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: var(--bg);
        color: var(--text);
        line-height: 1.6;
        min-height: 100vh;
      }
      
      .wrap {
        max-width: 1000px;
        margin: 0 auto;
        padding: 0 20px;
      }
      
      /* Заголовки */
      h1 {
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 20px;
        color: var(--text);
        text-align: center;
        letter-spacing: -0.5px;
        padding: 10px 0;
        border-bottom: 2px solid var(--accent);
      }
      
      /* Верхняя панель */
      header {
        background: linear-gradient(135deg, rgba(18, 26, 51, 0.98) 0%, rgba(11, 16, 32, 0.98) 100%);
        backdrop-filter: blur(15px);
        border-bottom: 1px solid var(--border);
        padding: 15px 0;
        position: sticky;
        top: 0;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      }
      
      /* Кнопки */
      .btnbar {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 15px;
        justify-content: center;
      }
      
      /* Кнопки навигации под ответом */
      .nav-buttons-below {
        display: flex;
        gap: 12px;
        justify-content: center;
        margin: 25px 0;
        padding: 20px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: var(--radius);
        border: 1px solid var(--border);
      }
      
      button {
        background: linear-gradient(135deg, var(--accent) 0%, #1d3bff 100%);
        color: white;
        border: none;
        border-radius: 10px;
        padding: 12px 24px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        white-space: nowrap;
        min-height: 48px;
        box-shadow: 0 4px 12px rgba(45, 75, 255, 0.3);
        position: relative;
        overflow: hidden;
      }
      
      button::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
        transition: left 0.5s;
      }
      
      button:hover:not(:disabled) {
        background: linear-gradient(135deg, #1d3bff 0%, var(--accent) 100%);
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(45, 75, 255, 0.4);
      }
      
      button:hover:not(:disabled)::before {
        left: 100%;
      }
      
      button:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: 0 2px 10px rgba(45, 75, 255, 0.3);
      }
      
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none !important;
        box-shadow: none !important;
      }
      
      button.secondary {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid var(--border);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      
      button.secondary:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.15);
        border-color: var(--accent);
        box-shadow: 0 4px 15px rgba(45, 75, 255, 0.2);
      }
      
      button.danger {
        background: linear-gradient(135deg, var(--danger) 0%, #e04a5f 100%);
        box-shadow: 0 4px 12px rgba(255, 91, 110, 0.3);
      }
      
      button.danger:hover:not(:disabled) {
        background: linear-gradient(135deg, #e04a5f 0%, var(--danger) 100%);
        box-shadow: 0 6px 20px rgba(255, 91, 110, 0.4);
      }
      
      button.success {
        background: linear-gradient(135deg, var(--success) 0%, #2bbf6d 100%);
        box-shadow: 0 4px 12px rgba(53, 208, 127, 0.3);
      }
      
      /* Информационные блоки */
      .sub {
        font-size: 15px;
        color: var(--text-muted);
        padding: 10px 15px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        margin-top: 10px;
        border-left: 3px solid var(--accent);
      }
      
      .sub b {
        color: var(--text);
        font-weight: 600;
      }
      
      .sub#timerLine {
        background: rgba(53, 208, 127, 0.1);
        border-left-color: var(--success);
        color: var(--success);
        font-weight: 600;
        font-family: 'Courier New', monospace;
        font-size: 16px;
      }
      
      .sub#timerLine.warning {
        background: rgba(255, 176, 32, 0.1);
        border-left-color: var(--warning);
        color: var(--warning);
        animation: pulse 1.5s infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      
      /* Основной контент */
      main {
        padding: 30px 0 60px;
      }
      
      /* Карточки */
      .card {
        background: var(--card-bg);
        border-radius: var(--radius);
        border: 1px solid var(--border);
        padding: 25px;
        margin-bottom: 25px;
        backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        transition: transform 0.3s, box-shadow 0.3s;
      }
      
      .card:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
      }
      
      /* Заголовки заданий */
      .qid {
        font-size: 22px;
        font-weight: 700;
        margin-bottom: 12px;
        color: var(--text);
        padding-bottom: 10px;
        border-bottom: 2px solid rgba(45, 75, 255, 0.3);
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .qid::before {
        content: "📋";
        font-size: 18px;
      }
      
      #textTitle.qid::before {
        content: "📄";
      }
      
      .qhint {
        font-size: 14px;
        color: var(--text-muted);
        margin-bottom: 15px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        border-left: 3px solid var(--text-muted);
      }
      
      .qtext {
        font-size: 17px;
        line-height: 1.8;
        margin-bottom: 25px;
        color: var(--text);
      }
      
      .qtext b {
        color: #fff;
        font-weight: 600;
      }
      
      .qtext h2, .qtext h3 {
        color: #fff;
        margin: 20px 0 15px 0;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border);
      }
      
      /* Поля ввода */
      .ansrow {
        display: flex;
        gap: 15px;
        align-items: center;
        flex-wrap: wrap;
        margin-top: 20px;
      }
      
      input[type="text"] {
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 14px 18px;
        color: var(--text);
        font-size: 16px;
        flex: 1;
        min-width: 300px;
        transition: all 0.3s;
      }
      
      input[type="text"]:focus {
        outline: none;
        border-color: var(--accent);
        background: rgba(255, 255, 255, 0.1);
        box-shadow: 0 0 0 3px rgba(45, 75, 255, 0.2);
      }
      
      input[type="text"]::placeholder {
        color: var(--text-muted);
        opacity: 0.7;
      }
      
      /* Водяной знак */
      #wmark {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 9999;
        pointer-events: none;
        opacity: 0.15;
        font-size: 40px;
        white-space: nowrap;
        color: #fff;
        font-weight: 700;
        text-shadow: 0 2px 10px rgba(0,0,0,0.5);
        font-family: 'Segoe UI', Arial, sans-serif;
      }
      
      #wmark .t {
        position: relative;
      }
      
      /* Адаптивность */
      @media (max-width: 768px) {
        .wrap {
          padding: 0 15px;
        }
        
        h1 {
          font-size: 26px;
          padding: 8px 0;
        }
        
        .btnbar, .nav-buttons-below {
          flex-direction: column;
          gap: 10px;
        }
        
        .nav-buttons-below {
          padding: 15px;
          margin: 20px 0;
        }
        
        button {
          width: 100%;
          justify-content: center;
          padding: 14px 20px;
          font-size: 14px;
        }
        
        .card {
          padding: 20px;
          margin-bottom: 20px;
        }
        
        .qid {
          font-size: 20px;
        }
        
        input[type="text"] {
          min-width: 100%;
          padding: 12px 16px;
          font-size: 15px;
        }
        
        .ansrow {
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
        }
        
        .sub {
          font-size: 14px;
          padding: 8px 12px;
        }
      }
      
      @media (max-width: 480px) {
        h1 {
          font-size: 22px;
        }
        
        .card {
          padding: 16px;
          margin-bottom: 16px;
        }
        
        .qid {
          font-size: 18px;
        }
        
        .qtext {
          font-size: 15px;
          line-height: 1.6;
        }
        
        button {
          min-height: 44px;
        }
        
        .btnbar, .nav-buttons-below {
          gap: 8px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ========= main =========
  try {
    const cfg = window.CONTROL_CONFIG || {};
    const mode = cfg.mode || "student";
    const dataUrl = cfg.dataUrl || "./variant26_cut.json";

    const DURATION_MIN = Number(cfg.timeLimitMinutes ?? cfg.durationMinutes ?? 60);
    const reminders = Array.isArray(cfg.remindersMinutes) ? cfg.remindersMinutes : [10, 5];
    const WARN_MS = reminders
      .filter((x) => Number.isFinite(Number(x)) && Number(x) > 0)
      .map((m) => Math.floor(Number(m) * 60 * 1000))
      .sort((a, b) => b - a);

    const STORAGE_KEY = "kontrol:" + dataUrl;
    const ID_KEY = STORAGE_KEY + ":identity";
    const TIMER_KEY = STORAGE_KEY + ":timer";
    const SENT_KEY = STORAGE_KEY + ":sent";

    let data = null;
    let idx = 0;
    let identity = null;
    let textBlocks = [];
    let submitInFlight = false;
    let submitDone = false;
    let sentHash = null;
    let timer = {
      startedAt: null,
      durationMs: DURATION_MIN * 60 * 1000,
      warned: {},
      finished: false,
    };
    let timerTick = null;
    let allAnswers = {}; // Хранилище всех ответов

    // Шаблон приложения
    function appTemplate() {
      return `
        <header>
          <div class="wrap">
            <h1 id="title">Контрольная работа</h1>

            <div class="sub" id="identityLine" style="margin-top:8px; display:none"></div>
            <div class="sub" id="timerLine" style="margin-top:6px; display:none"></div>
            
            <!-- Кнопки управления в хедере -->
            <div class="btnbar" id="topBtns" style="display:none">
              <button id="export">Отправить работу</button>
              <button id="reset" class="secondary">Сброс</button>
            </div>
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
            <div class="qhint" style="margin-top:10px">
              ${DURATION_MIN} минут.
              ${WARN_MS.length ? `Напоминания: ${reminders.join(" и ")} минут до конца.` : ""}
              По истечении времени результаты будут автоматически отправлены.
            </div>
          </div>

          <!-- Контейнер для задания с текстом и кнопками -->
          <div id="questionContainer"></div>
        </main>
      `;
    }

    function renderTask(t) {
      const currentValue = allAnswers[t.id]?.value || "";
      return `
        <section class="card" id="card-${t.id}">
          <div class="qtop">
            <div>
              <div class="qid">Задание ${t.id}</div>
              <div class="qhint">${t.hint || ""}</div>
            </div>
          </div>

          <div class="qtext">${t.text || ""}</div>

          <div class="ansrow">
            <input type="text" id="in-${t.id}" 
                   value="${escapeHtml(currentValue)}" 
                   placeholder="Введите ответ…" 
                   autocomplete="off" />
          </div>
          
          <!-- Кнопки навигации ПОД ответом -->
          <div class="nav-buttons-below" id="navBelow">
            <button id="prevBtn" class="secondary">← Предыдущее</button>
            <button id="nextBtn" class="secondary">Следующее →</button>
          </div>
        </section>
      `;
    }

    function loadTextBlocksFromMeta(meta) {
      const blocks = [];
      const texts = meta?.texts;

      if (texts && typeof texts === "object") {
        for (const k of Object.keys(texts)) {
          const obj = texts[k];
          const range = obj?.range;
          const html = obj?.html;

          if (!html) continue;

          const from = Number(range?.[0]);
          const to = Number(range?.[1]);
          if (!Number.isFinite(from) || !Number.isFinite(to)) continue;

          blocks.push({
            from: Math.min(from, to),
            to: Math.max(from, to),
            title: obj?.title || "Текст",
            html: String(html),
          });
        }
      }

      if (!blocks.length && meta?.textHtml) {
        blocks.push({ from: -Infinity, to: Infinity, title: "Текст", html: String(meta.textHtml) });
      }

      return blocks;
    }

    // Проверяет, относится ли текст к текущему заданию
    function currentTaskHasText() {
      if (!data?.tasks?.length || !textBlocks.length) return false;
      
      const cur = data.tasks[idx];
      const taskId = Number(cur?.id);
      if (!Number.isFinite(taskId)) return false;

      return textBlocks.some(b => taskId >= b.from && taskId <= b.to);
    }

    // Получает текст для текущего задания
    function getTextForCurrentTask() {
      if (!data?.tasks?.length || !textBlocks.length) return null;
      
      const cur = data.tasks[idx];
      const taskId = Number(cur?.id);
      if (!Number.isFinite(taskId)) return null;

      const hit = textBlocks.find(b => taskId >= b.from && taskId <= b.to);
      return hit ? hit.html : null;
    }

    // ФУНКЦИЯ АВТОСОХРАНЕНИЯ - СРАБАТЫВАЕТ ПРИ ИЗМЕНЕНИИ ПОЛЯ
    function saveProgress() {
      // Сохраняем текущее значение из активного поля
      const currentTask = data?.tasks?.[idx];
      if (currentTask) {
        const inp = $(`#in-${currentTask.id}`);
        if (inp) {
          allAnswers[currentTask.id] = { value: inp.value || "" };
        }
      }
      
      const state = {
        idx,
        answers: allAnswers,
        ts: new Date().toISOString(),
      };
      saveJSON(STORAGE_KEY, state);
      console.log("Прогресс сохранён:", state);
    }

    // ОБНОВЛЕННАЯ ФУНКЦИЯ: Отображает все элементы для текущего задания
    function updateTaskDisplay() {
      const container = $("#questionContainer");
      if (!container) return;

      const hasText = currentTaskHasText();
      const taskHtml = data?.tasks?.[idx] ? renderTask(data.tasks[idx]) : "";
      const textHtml = getTextForCurrentTask();
      
      // Собираем HTML в нужном порядке
      let finalHtml = "";
      
      if (hasText && textHtml) {
        finalHtml += `
          <div class="card">
            <div class="qid">Текст</div>
            <div class="qtext">${textHtml}</div>
          </div>
        `;
      }
      
      // Добавляем задание (в нём уже есть кнопки навигации внизу)
      finalHtml += taskHtml;
      
      container.innerHTML = finalHtml;
      
      // Назначаем обработчики для кнопок навигации под ответом
      $("#prevBtn").onclick = goPrev;
      $("#nextBtn").onclick = goNext;
      
      // НАСТРАИВАЕМ АВТОСОХРАНЕНИЕ ДЛЯ ТЕКУЩЕГО ПОЛЯ
      const currentTask = data?.tasks?.[idx];
      if (currentTask) {
        const inp = $(`#in-${currentTask.id}`);
        if (inp) {
          inp.addEventListener("input", saveProgress);
          inp.addEventListener("blur", saveProgress);
        }
      }
    }

    function loadProgress() {
      return loadJSON(STORAGE_KEY);
    }

    function showOnlyCurrent() {
      // ВАЖНО: Мы не скрываем задания, а перерисовываем контейнер
      updateTaskDisplay();
    }

    function goNext() {
      saveProgress(); // Сохраняем перед переходом
      if (idx < (data?.tasks || []).length - 1) idx++;
      showOnlyCurrent();
    }

    function goPrev() {
      saveProgress(); // Сохраняем перед переходом
      if (idx > 0) idx--;
      showOnlyCurrent();
    }

    function allAnswered() {
      return (data?.tasks || []).every((t) => normText(allAnswers[t.id]?.value || "") !== "");
    }

    // ФУНКЦИЯ: Подготовка данных с подстановкой "0" в пустые поля
    function buildResultPackWithZeros() {
      const tasks = data?.tasks || [];
      const answers = tasks.map((t) => ({
        id: t.id,
        value: normText(allAnswers[t.id]?.value || "") !== "" ? allAnswers[t.id].value : "0",
      }));

      // Подсчитываем решённые задания
      const solvedCount = answers.filter(a => normText(a.value) !== "0").length;
      const totalCount = tasks.length;

      return {
        meta: data?.meta || {},
        variant: (data?.meta?.variant || cfg.variant || "unknown"),
        identity: identity || null,
        ts: new Date().toISOString(),
        durationMinutes: DURATION_MIN,
        timer: { 
          startedAt: timer.startedAt, 
          finished: false, 
          earlySubmit: true 
        },
        answers,
        stats: {
          solved: solvedCount,
          total: totalCount,
          solvedPercentage: Math.round((solvedCount / totalCount) * 100)
        }
      };
    }

    function buildResultPack() {
      const tasks = data?.tasks || [];
      const answers = tasks.map((t) => ({
        id: t.id,
        value: allAnswers[t.id]?.value || "",
      }));

      return {
        meta: data?.meta || {},
        variant: (data?.meta?.variant || cfg.variant || "unknown"),
        identity: identity || null,
        ts: new Date().toISOString(),
        durationMinutes: DURATION_MIN,
        timer: { startedAt: timer.startedAt, finished: timer.finished },
        answers,
      };
    }

    async function submitResultToCloud(pack) {
      const url = cfg.submitUrl;
      if (!url) throw new Error("submitUrl не задан в CONTROL_CONFIG");

      const headers = { "Content-Type": "application/json" };
      if (cfg.submitToken) headers["X-Submit-Token"] = String(cfg.submitToken);

      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cfg.submitToken ? { "X-Submit-Token": cfg.submitToken } : {})
        },
        body: JSON.stringify(pack),
      });

      const txt = await r.text();
      let json = null;
      try { json = JSON.parse(txt); } catch {}

      if (!r.ok) throw new Error(`Upload failed: ${r.status} ${txt}`);
      return json || { ok: true };
    }

    // УМНАЯ ФУНКЦИЯ ОТПРАВКИ: объединяет обычную и досрочную выгрузку
    async function smartExportResult() {
      if (submitInFlight) return;

      // Подсчитываем решённые задания
      const solvedCount = (data?.tasks || []).filter(t => 
        normText(allAnswers[t.id]?.value || "") !== ""
      ).length;
      const totalCount = (data?.tasks || []).length;
      const allFilled = solvedCount === totalCount;

      let pack;
      let confirmationMessage;

      if (allFilled) {
        // Все задания заполнены - обычная отправка
        confirmationMessage = `Все задания выполнены (${solvedCount}/${totalCount}).
        
Отправить работу на проверку?`;
        
        if (!confirm(confirmationMessage)) {
          return;
        }
        
        pack = buildResultPack();
      } else {
        // Не все задания заполнены - досрочная отправка с подстановкой "0"
        confirmationMessage = `Выполнено ${solvedCount} из ${totalCount} заданий.
        
ПУСТЫЕ ОТВЕТЫ БУДУТ ЗАМЕНЕНЫ НА "0"!
        
Вы уверены, что хотите отправить работу досрочно?`;
        
        if (!confirm(confirmationMessage)) {
          return;
        }
        
        pack = buildResultPackWithZeros();
      }

      const hash = await sha256Hex(JSON.stringify(pack));

      if (submitDone && sentHash === hash) {
        alert("Результат уже отправлен ✅");
        return;
      }

      const btn = $("#export");
      submitInFlight = true;
      if (btn) { btn.disabled = true; btn.textContent = "Отправка…"; }

      try {
        const resp = await submitResultToCloud(pack);

        submitDone = true;
        sentHash = hash;
        saveJSON(SENT_KEY, { submitDone, sentHash, ts: new Date().toISOString() });

        if (btn) { btn.disabled = true; btn.textContent = "Отправлено ✅"; }

        if (allFilled) {
          alert(`Работа успешно отправлена! ✅
          
Все задания выполнены (${solvedCount}/${totalCount}).`);
        } else {
          alert(`Работа отправлена досрочно! ✅
          
Выполнено: ${solvedCount} из ${totalCount} заданий
Пустые ответы заменены на "0".`);
        }
      } catch (e) {
        submitInFlight = false;
        if (btn) { btn.disabled = false; btn.textContent = "Отправить работу"; }
        alert("Не удалось отправить результат.\n\n" + (e?.message || e));
      }
    }

    async function exportResult({ auto = false } = {}) {
      if (submitInFlight) return;

      if (mode === "student" && cfg.exportOnlyAfterFinish) {
        if (!allAnswered()) {
          if (!auto) {
            // Предлагаем досрочную отправку
            await smartExportResult();
          }
          return;
        }
      }

      // Автоматическая отправка по таймеру - только если все заполнено
      if (auto) {
        if (!allAnswered()) {
          console.log("Автоотправка: не все задания выполнены, пропускаем");
          return;
        }
        
        const pack = buildResultPack();
        const hash = await sha256Hex(JSON.stringify(pack));

        if (submitDone && sentHash === hash) return;

        submitInFlight = true;
        
        try {
          await submitResultToCloud(pack);
          submitDone = true;
          sentHash = hash;
          saveJSON(SENT_KEY, { submitDone, sentHash, ts: new Date().toISOString() });
        } catch (e) {
          console.error("Автоотправка не удалась:", e);
          submitInFlight = false;
        }
        return;
      }

      // Ручная отправка - используем умную функцию
      await smartExportResult();
    }

    function resetAll() {
      if (!confirm("Сбросить ответы на этом устройстве?")) return;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ID_KEY);
      localStorage.removeItem(TIMER_KEY);
      localStorage.removeItem(SENT_KEY);
      location.reload();
    }

    function startTimerIfNeeded() {
      const saved = loadJSON(TIMER_KEY);
      if (saved && saved.startedAt && !saved.finished) {
        timer = saved;
        timer.warned = timer.warned || {};
        timer.durationMs = Number(timer.durationMs || (DURATION_MIN * 60 * 1000));
      } else if (!timer.startedAt) {
        timer.startedAt = Date.now();
        timer.finished = false;
        timer.warned = {};
        timer.durationMs = DURATION_MIN * 60 * 1000;
        saveJSON(TIMER_KEY, timer);
      }

      const line = $("#timerLine");
      if (line) line.style.display = "block";

      if (timerTick) clearInterval(timerTick);
      timerTick = setInterval(async () => {
        const now = Date.now();
        const endAt = Number(timer.startedAt) + Number(timer.durationMs);
        const left = endAt - now;

        if (line) line.textContent = `Осталось времени: ${fmtMs(left)}`;
        
        if (left <= 5 * 60 * 1000) {
          line.classList.add('warning');
        } else {
          line.classList.remove('warning');
        }

        for (const ms of WARN_MS) {
          const key = String(ms);
          if (!timer.warned[key] && left <= ms && left > 0) {
            timer.warned[key] = true;
            saveJSON(TIMER_KEY, timer);
            const mins = Math.round(ms / 60000);
            alert(`Осталось ${mins} минут до конца контрольной.`);
          }
        }

        if (!timer.finished && left <= 0) {
          timer.finished = true;
          saveJSON(TIMER_KEY, timer);
          saveProgress();
          await exportResult({ auto: true });
          alert("Время вышло. Результаты отправлены.");
          clearInterval(timerTick);
        }
      }, 1000);
    }

    async function loadData() {
      const r = await fetch(dataUrl, { cache: "no-store" });
      if (!r.ok) throw new Error("Не удалось загрузить файл заданий: " + r.status);
      return await r.json();
    }

    function buildAndRestore() {
      // Показываем кнопки управления в хедере
      $("#topBtns").style.display = "flex";
      
      // Назначаем обработчики для кнопок в хедере
      $("#export").onclick = smartExportResult;
      $("#reset").onclick = resetAll;

      // Восстановление прогресса
      const st = loadProgress();
      if (st) {
        idx = Math.max(0, Math.min(st.idx || 0, (data.tasks || []).length - 1));
        allAnswers = st.answers || {};
      }

      // Восстановление статуса отправки
      const sent = loadJSON(SENT_KEY);
      if (sent && sent.submitDone) {
        submitDone = true;
        sentHash = sent.sentHash || null;
        const btn = $("#export");
        if (btn) { btn.disabled = true; btn.textContent = "Отправлено ✅"; }
      }

      showOnlyCurrent();
      startTimerIfNeeded();
    }

    async function init() {
      const app = $("#app");
      if (!app) throw new Error("Не найден контейнер #app в HTML");
      
      injectStyles();
      app.innerHTML = appTemplate();

      if (mode === "student" && cfg.blockCopy) enableCopyBlock();

      data = await loadData();

      $("#title").textContent = data?.meta?.title || "Контрольная работа";

      textBlocks = loadTextBlocksFromMeta(data?.meta);

      identity = loadJSON(ID_KEY);
      const needId = (mode === "student" && cfg.requireIdentity);

      if (needId && (!identity || !identity.fio || !identity.cls)) {
        $("#identityCard").style.display = "block";
        $("#identityLine").style.display = "none";
        $("#topBtns").style.display = "none";
        $("#timerLine").style.display = "none";

        $("#fio").addEventListener("blur", () => { $("#fio").value = normalizeFioInput($("#fio").value); });
        $("#cls").addEventListener("blur", () => { $("#cls").value = normalizeClassInput($("#cls").value); });

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
          saveJSON(ID_KEY, identity);

          $("#identityCard").style.display = "none";
          $("#topBtns").style.display = "flex";
          $("#identityLine").style.display = "block";
          $("#identityLine").innerHTML = `Ученик: <b>${escapeHtml(identity.fio)}</b>, класс <b>${escapeHtml(identity.cls)}</b>`;

          if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);

          timer = {
            startedAt: Date.now(),
            durationMs: DURATION_MIN * 60 * 1000,
            warned: {},
            finished: false,
          };
          saveJSON(TIMER_KEY, timer);

          buildAndRestore();
        };

        return;
      }

      if (needId && identity) {
        $("#identityLine").style.display = "block";
        $("#identityLine").innerHTML = `Ученик: <b>${escapeHtml(identity.fio)}</b>, класс <b>${escapeHtml(identity.cls)}</b>`;
        if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);
      }

      buildAndRestore();
    }

    document.addEventListener("DOMContentLoaded", () => {
      init().catch(showFatal);
    });

  } catch (e) {
    showFatal(e);
  }
 (() => {
  "use strict";

  // ========= helpers =========
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function showFatal(err) {
    const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    document.documentElement.style.background = "#0b1020";
    document.body.innerHTML = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;padding:18px;color:#fff">
        <h2 style="margin:0 0 10px">Ошибка в контрольной</h2>
        <pre style="white-space:pre-wrap;background:rgba(255,255,255,.06);padding:12px;border-radius:12px">${escapeHtml(msg)}</pre>
        <div style="opacity:.85;margin-top:10px">Открой консоль (F12 → Console), там будет та же ошибка.</div>
      </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[m]));
  }

  function normText(s) {
    if (s == null) return "";
    return String(s).trim().replace(/\s+/g, " ");
  }

  function capWord(w) {
    const s = String(w || "").trim();
    if (!s) return "";
    return s[0].toUpperCase() + s.slice(1).toLowerCase();
  }

  function normalizeFioInput(raw) {
    const parts = String(raw || "")
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean)
      .slice(0, 3);
    return parts.map(capWord).join(" ");
  }

  function normalizeClassInput(raw) {
    return String(raw || "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, 6);
  }

  function saveJSON(key, obj) {
    localStorage.setItem(key, JSON.stringify(obj));
  }

  function loadJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function sha256Hex(str) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function fmtMs(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  // best-effort: блокировка копирования (опционально)
  function enableCopyBlock() {
    document.body.classList.add("nocopy");
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
    ["copy", "cut", "paste", "contextmenu", "selectstart", "dragstart"].forEach((ev) => {
      document.addEventListener(ev, stop, true);
    });
    document.addEventListener("keydown", (e) => {
      const k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "a", "s", "p"].includes(k)) stop(e);
      if (e.key === "PrintScreen") stop(e);
    }, true);
  }

  // водяной знак (опционально)
  function enableWatermark(text) {
    const w = document.createElement("div");
    w.id = "wmark";
    w.innerHTML = `<div class="t">${escapeHtml(text)}</div>`;
    document.body.appendChild(w);

    let t = 0;
    setInterval(() => {
      t += 1;
      const el = w.querySelector(".t");
      if (!el) return;
      el.style.transform =
        `translate(-50%,-50%) rotate(-22deg) translate(${Math.sin(t / 7) * 12}px, ${Math.cos(t / 9) * 10}px)`;
    }, 250);
  }
  
  
    
    // УМНАЯ ФУНКЦИЯ ОТПРАВКИ: объединяет обычную и досрочную выгрузку
    async function smartExportResult() {
      if (submitInFlight) return;

      // Подсчитываем решённые задания
      const solvedCount = (data?.tasks || []).filter(t => 
        normText(allAnswers[t.id]?.value || "") !== ""
      ).length;
      const totalCount = (data?.tasks || []).length;
      const allFilled = solvedCount === totalCount;

      let pack;
      let confirmationMessage;

      if (allFilled) {
        // Все задания заполнены - обычная отправка
        confirmationMessage = `Все задания выполнены (${solvedCount}/${totalCount}).
        
Отправить работу на проверку?`;
        
        if (!confirm(confirmationMessage)) {
          return;
        }
        
        pack = buildResultPack();
      } else {
        // Не все задания заполнены - досрочная отправка с подстановкой "0"
        confirmationMessage = `Выполнено ${solvedCount} из ${totalCount} заданий.
        
ПУСТЫЕ ОТВЕТЫ БУДУТ ЗАМЕНЕНЫ НА "0"!
        
Вы уверены, что хотите отправить работу досрочно?`;
        
        if (!confirm(confirmationMessage)) {
          return;
        }
        
        pack = buildResultPackWithZeros();
      }

      const hash = await sha256Hex(JSON.stringify(pack));

      if (submitDone && sentHash === hash) {
        alert("Результат уже отправлен ✅");
        return;
      }

      const btn = $("#export");
      submitInFlight = true;
      if (btn) { btn.disabled = true; btn.textContent = "Отправка…"; }

      try {
        const resp = await submitResultToCloud(pack);

        submitDone = true;
        sentHash = hash;
        saveJSON(SENT_KEY, { submitDone, sentHash, ts: new Date().toISOString() });

        if (btn) { btn.disabled = true; btn.textContent = "Отправлено ✅"; }

        if (allFilled) {
          alert(`Работа успешно отправлена! ✅
          
Все задания выполнены (${solvedCount}/${totalCount}).`);
        } else {
          alert(`Работа отправлена досрочно! ✅
          
Выполнено: ${solvedCount} из ${totalCount} заданий
Пустые ответы заменены на "0".`);
        }
      } catch (e) {
        submitInFlight = false;
        if (btn) { btn.disabled = false; btn.textContent = "Отправить работу"; }
        alert("Не удалось отправить результат.\n\n" + (e?.message || e));
      }
    }

    async function exportResult({ auto = false } = {}) {
      if (submitInFlight) return;

      if (mode === "student" && cfg.exportOnlyAfterFinish) {
        if (!allAnswered()) {
          if (!auto) {
            // Предлагаем досрочную отправку
            await smartExportResult();
          }
          return;
        }
      }

      // Автоматическая отправка по таймеру - только если все заполнено
      if (auto) {
        if (!allAnswered()) {
          console.log("Автоотправка: не все задания выполнены, пропускаем");
          return;
        }
        
        const pack = buildResultPack();
        const hash = await sha256Hex(JSON.stringify(pack));

        if (submitDone && sentHash === hash) return;

        submitInFlight = true;
        
        try {
          await submitResultToCloud(pack);
          submitDone = true;
          sentHash = hash;
          saveJSON(SENT_KEY, { submitDone, sentHash, ts: new Date().toISOString() });
        } catch (e) {
          console.error("Автоотправка не удалась:", e);
          submitInFlight = false;
        }
        return;
      }

      // Ручная отправка - используем умную функцию
      await smartExportResult();
    }

    function resetAll() {
      if (!confirm("Сбросить ответы на этом устройстве?")) return;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ID_KEY);
      localStorage.removeItem(TIMER_KEY);
      localStorage.removeItem(SENT_KEY);
      location.reload();
    }

    function startTimerIfNeeded() {
      const saved = loadJSON(TIMER_KEY);
      if (saved && saved.startedAt && !saved.finished) {
        timer = saved;
        timer.warned = timer.warned || {};
        timer.durationMs = Number(timer.durationMs || (DURATION_MIN * 60 * 1000));
      } else if (!timer.startedAt) {
        timer.startedAt = Date.now();
        timer.finished = false;
        timer.warned = {};
        timer.durationMs = DURATION_MIN * 60 * 1000;
        saveJSON(TIMER_KEY, timer);
      }

      const line = $("#timerLine");
      if (line) line.style.display = "block";

      if (timerTick) clearInterval(timerTick);
      timerTick = setInterval(async () => {
        const now = Date.now();
        const endAt = Number(timer.startedAt) + Number(timer.durationMs);
        const left = endAt - now;

        if (line) line.textContent = `Осталось времени: ${fmtMs(left)}`;
        
        if (left <= 5 * 60 * 1000) {
          line.classList.add('warning');
        } else {
          line.classList.remove('warning');
        }

        for (const ms of WARN_MS) {
          const key = String(ms);
          if (!timer.warned[key] && left <= ms && left > 0) {
            timer.warned[key] = true;
            saveJSON(TIMER_KEY, timer);
            const mins = Math.round(ms / 60000);
            alert(`Осталось ${mins} минут до конца контрольной.`);
          }
        }

        if (!timer.finished && left <= 0) {
          timer.finished = true;
          saveJSON(TIMER_KEY, timer);
          saveProgress();
          await exportResult({ auto: true });
          alert("Время вышло. Результаты отправлены.");
          clearInterval(timerTick);
        }
      }, 1000);
    }

    async function loadData() {
      const r = await fetch(dataUrl, { cache: "no-store" });
      if (!r.ok) throw new Error("Не удалось загрузить файл заданий: " + r.status);
      return await r.json();
    }

    function buildAndRestore() {
      // Показываем кнопки управления в хедере
      $("#topBtns").style.display = "flex";
      
      // Назначаем обработчики для кнопок в хедере
      $("#export").onclick = smartExportResult;
      $("#reset").onclick = resetAll;

      // Восстановление прогресса
      const st = loadProgress();
      if (st) {
        idx = Math.max(0, Math.min(st.idx || 0, (data.tasks || []).length - 1));
        allAnswers = st.answers || {};
      }

      // Восстановление статуса отправки
      const sent = loadJSON(SENT_KEY);
      if (sent && sent.submitDone) {
        submitDone = true;
        sentHash = sent.sentHash || null;
        const btn = $("#export");
        if (btn) { btn.disabled = true; btn.textContent = "Отправлено ✅"; }
      }

      showOnlyCurrent();
      startTimerIfNeeded();
    }

    async function init() {
      const app = $("#app");
      if (!app) throw new Error("Не найден контейнер #app в HTML");
      
      injectStyles();
      app.innerHTML = appTemplate();

      if (mode === "student" && cfg.blockCopy) enableCopyBlock();

      data = await loadData();

      $("#title").textContent = data?.meta?.title || "Контрольная работа";

      textBlocks = loadTextBlocksFromMeta(data?.meta);

      identity = loadJSON(ID_KEY);
      const needId = (mode === "student" && cfg.requireIdentity);

      if (needId && (!identity || !identity.fio || !identity.cls)) {
        $("#identityCard").style.display = "block";
        $("#identityLine").style.display = "none";
        $("#topBtns").style.display = "none";
        $("#timerLine").style.display = "none";

        $("#fio").addEventListener("blur", () => { $("#fio").value = normalizeFioInput($("#fio").value); });
        $("#cls").addEventListener("blur", () => { $("#cls").value = normalizeClassInput($("#cls").value); });

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
          saveJSON(ID_KEY, identity);

          $("#identityCard").style.display = "none";
          $("#topBtns").style.display = "flex";
          $("#identityLine").style.display = "block";
          $("#identityLine").innerHTML = `Ученик: <b>${escapeHtml(identity.fio)}</b>, класс <b>${escapeHtml(identity.cls)}</b>`;

          if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);

          timer = {
            startedAt: Date.now(),
            durationMs: DURATION_MIN * 60 * 1000,
            warned: {},
            finished: false,
          };
          saveJSON(TIMER_KEY, timer);

          buildAndRestore();
        };

        return;
      }

      if (needId && identity) {
        $("#identityLine").style.display = "block";
        $("#identityLine").innerHTML = `Ученик: <b>${escapeHtml(identity.fio)}</b>, класс <b>${escapeHtml(identity.cls)}</b>`;
        if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);
      }

      buildAndRestore();
    }

    document.addEventListener("DOMContentLoaded", () => {
      init().catch(showFatal);
    });

  } catch (e) {
    showFatal(e);
  }
 (() => {
  "use strict";

  // ========= helpers =========
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function showFatal(err) {
    const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    document.documentElement.style.background = "#0b1020";
    document.body.innerHTML = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;padding:18px;color:#fff">
        <h2 style="margin:0 0 10px">Ошибка в контрольной</h2>
        <pre style="white-space:pre-wrap;background:rgba(255,255,255,.06);padding:12px;border-radius:12px">${escapeHtml(msg)}</pre>
        <div style="opacity:.85;margin-top:10px">Открой консоль (F12 → Console), там будет та же ошибка.</div>
      </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[m]));
  }

  function normText(s) {
    if (s == null) return "";
    return String(s).trim().replace(/\s+/g, " ");
  }

  function capWord(w) {
    const s = String(w || "").trim();
    if (!s) return "";
    return s[0].toUpperCase() + s.slice(1).toLowerCase();
  }

  function normalizeFioInput(raw) {
    const parts = String(raw || "")
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean)
      .slice(0, 3);
    return parts.map(capWord).join(" ");
  }

  function normalizeClassInput(raw) {
    return String(raw || "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, 6);
  }

  function saveJSON(key, obj) {
    localStorage.setItem(key, JSON.stringify(obj));
  }

  function loadJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function sha256Hex(str) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function fmtMs(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  // best-effort: блокировка копирования (опционально)
  function enableCopyBlock() {
    document.body.classList.add("nocopy");
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
    ["copy", "cut", "paste", "contextmenu", "selectstart", "dragstart"].forEach((ev) => {
      document.addEventListener(ev, stop, true);
    });
    document.addEventListener("keydown", (e) => {
      const k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "a", "s", "p"].includes(k)) stop(e);
      if (e.key === "PrintScreen") stop(e);
    }, true);
  }

  // водяной знак (опционально)
  function enableWatermark(text) {
    const w = document.createElement("div");
    w.id = "wmark";
    w.innerHTML = `<div class="t">${escapeHtml(text)}</div>`;
    document.body.appendChild(w);

    let t = 0;
    setInterval(() => {
      t += 1;
      const el = w.querySelector(".t");
      if (!el) return;
      el.style.transform =
        `translate(-50%,-50%) rotate(-22deg) translate(${Math.sin(t / 7) * 12}px, ${Math.cos(t / 9) * 10}px)`;
    }, 250);
  }  

  
    // УМНАЯ ФУНКЦИЯ ОТПРАВКИ: объединяет обычную и досрочную выгрузку
    async function smartExportResult() {
      if (submitInFlight) return;

      // Подсчитываем решённые задания
      const solvedCount = (data?.tasks || []).filter(t => 
        normText(allAnswers[t.id]?.value || "") !== ""
      ).length;
      const totalCount = (data?.tasks || []).length;
      const allFilled = solvedCount === totalCount;

      let pack;
      let confirmationMessage;

      if (allFilled) {
        // Все задания заполнены - обычная отправка
        confirmationMessage = `Все задания выполнены (${solvedCount}/${totalCount}).
        
Отправить работу на проверку?`;
        
        if (!confirm(confirmationMessage)) {
          return;
        }
        
        pack = buildResultPack();
      } else {
        // Не все задания заполнены - досрочная отправка с подстановкой "0"
        confirmationMessage = `Выполнено ${solvedCount} из ${totalCount} заданий.
        
ПУСТЫЕ ОТВЕТЫ БУДУТ ЗАМЕНЕНЫ НА "0"!
        
Вы уверены, что хотите отправить работу досрочно?`;
        
        if (!confirm(confirmationMessage)) {
          return;
        }
        
        pack = buildResultPackWithZeros();
      }

      const hash = await sha256Hex(JSON.stringify(pack));

      if (submitDone && sentHash === hash) {
        alert("Результат уже отправлен ✅");
        return;
      }

      const btn = $("#export");
      submitInFlight = true;
      if (btn) { btn.disabled = true; btn.textContent = "Отправка…"; }

      try {
        const resp = await submitResultToCloud(pack);

        submitDone = true;
        sentHash = hash;
        saveJSON(SENT_KEY, { submitDone, sentHash, ts: new Date().toISOString() });

        if (btn) { btn.disabled = true; btn.textContent = "Отправлено ✅"; }

        if (allFilled) {
          alert(`Работа успешно отправлена! ✅
          
Все задания выполнены (${solvedCount}/${totalCount}).`);
        } else {
          alert(`Работа отправлена досрочно! ✅
          
Выполнено: ${solvedCount} из ${totalCount} заданий
Пустые ответы заменены на "0".`);
        }
      } catch (e) {
        submitInFlight = false;
        if (btn) { btn.disabled = false; btn.textContent = "Отправить работу"; }
        alert("Не удалось отправить результат.\n\n" + (e?.message || e));
      }
    }

    async function exportResult({ auto = false } = {}) {
      if (submitInFlight) return;

      if (mode === "student" && cfg.exportOnlyAfterFinish) {
        if (!allAnswered()) {
          if (!auto) {
            // Предлагаем досрочную отправку
            await smartExportResult();
          }
          return;
        }
      }

      // Автоматическая отправка по таймеру - только если все заполнено
      if (auto) {
        if (!allAnswered()) {
          console.log("Автоотправка: не все задания выполнены, пропускаем");
          return;
        }
        
        const pack = buildResultPack();
        const hash = await sha256Hex(JSON.stringify(pack));

        if (submitDone && sentHash === hash) return;

        submitInFlight = true;
        
        try {
          await submitResultToCloud(pack);
          submitDone = true;
          sentHash = hash;
          saveJSON(SENT_KEY, { submitDone, sentHash, ts: new Date().toISOString() });
        } catch (e) {
          console.error("Автоотправка не удалась:", e);
          submitInFlight = false;
        }
        return;
      }

      // Ручная отправка - используем умную функцию
      await smartExportResult();
    }

    function resetAll() {
      if (!confirm("Сбросить ответы на этом устройстве?")) return;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ID_KEY);
      localStorage.removeItem(TIMER_KEY);
      localStorage.removeItem(SENT_KEY);
      location.reload();
    }

    function startTimerIfNeeded() {
      const saved = loadJSON(TIMER_KEY);
      if (saved && saved.startedAt && !saved.finished) {
        timer = saved;
        timer.warned = timer.warned || {};
        timer.durationMs = Number(timer.durationMs || (DURATION_MIN * 60 * 1000));
      } else if (!timer.startedAt) {
        timer.startedAt = Date.now();
        timer.finished = false;
        timer.warned = {};
        timer.durationMs = DURATION_MIN * 60 * 1000;
        saveJSON(TIMER_KEY, timer);
      }

      const line = $("#timerLine");
      if (line) line.style.display = "block";

      if (timerTick) clearInterval(timerTick);
      timerTick = setInterval(async () => {
        const now = Date.now();
        const endAt = Number(timer.startedAt) + Number(timer.durationMs);
        const left = endAt - now;

        if (line) line.textContent = `Осталось времени: ${fmtMs(left)}`;
        
        if (left <= 5 * 60 * 1000) {
          line.classList.add('warning');
        } else {
          line.classList.remove('warning');
        }

        for (const ms of WARN_MS) {
          const key = String(ms);
          if (!timer.warned[key] && left <= ms && left > 0) {
            timer.warned[key] = true;
            saveJSON(TIMER_KEY, timer);
            const mins = Math.round(ms / 60000);
            alert(`Осталось ${mins} минут до конца контрольной.`);
          }
        }

        if (!timer.finished && left <= 0) {
          timer.finished = true;
          saveJSON(TIMER_KEY, timer);
          saveProgress();
          await exportResult({ auto: true });
          alert("Время вышло. Результаты отправлены.");
          clearInterval(timerTick);
        }
      }, 1000);
    }

    async function loadData() {
      const r = await fetch(dataUrl, { cache: "no-store" });
      if (!r.ok) throw new Error("Не удалось загрузить файл заданий: " + r.status);
      return await r.json();
    }

    function buildAndRestore() {
      // Показываем кнопки управления в хедере
      $("#topBtns").style.display = "flex";
      
      // Назначаем обработчики для кнопок в хедере
      $("#export").onclick = smartExportResult;
      $("#reset").onclick = resetAll;

      // Восстановление прогресса
      const st = loadProgress();
      if (st) {
        idx = Math.max(0, Math.min(st.idx || 0, (data.tasks || []).length - 1));
        allAnswers = st.answers || {};
      }

      // Восстановление статуса отправки
      const sent = loadJSON(SENT_KEY);
      if (sent && sent.submitDone) {
        submitDone = true;
        sentHash = sent.sentHash || null;
        const btn = $("#export");
        if (btn) { btn.disabled = true; btn.textContent = "Отправлено ✅"; }
      }

      showOnlyCurrent();
      startTimerIfNeeded();
    }

    async function init() {
      const app = $("#app");
      if (!app) throw new Error("Не найден контейнер #app в HTML");
      
      injectStyles();
      app.innerHTML = appTemplate();

      if (mode === "student" && cfg.blockCopy) enableCopyBlock();

      data = await loadData();

      $("#title").textContent = data?.meta?.title || "Контрольная работа";

      textBlocks = loadTextBlocksFromMeta(data?.meta);

      identity = loadJSON(ID_KEY);
      const needId = (mode === "student" && cfg.requireIdentity);

      if (needId && (!identity || !identity.fio || !identity.cls)) {
        $("#identityCard").style.display = "block";
        $("#identityLine").style.display = "none";
        $("#topBtns").style.display = "none";
        $("#timerLine").style.display = "none";

        $("#fio").addEventListener("blur", () => { $("#fio").value = normalizeFioInput($("#fio").value); });
        $("#cls").addEventListener("blur", () => { $("#cls").value = normalizeClassInput($("#cls").value); });

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
          saveJSON(ID_KEY, identity);

          $("#identityCard").style.display = "none";
          $("#topBtns").style.display = "flex";
          $("#identityLine").style.display = "block";
          $("#identityLine").innerHTML = `Ученик: <b>${escapeHtml(identity.fio)}</b>, класс <b>${escapeHtml(identity.cls)}</b>`;

          if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);

          timer = {
            startedAt: Date.now(),
            durationMs: DURATION_MIN * 60 * 1000,
            warned: {},
            finished: false,
          };
          saveJSON(TIMER_KEY, timer);

          buildAndRestore();
        };

        return;
      }

      if (needId && identity) {
        $("#identityLine").style.display = "block";
        $("#identityLine").innerHTML = `Ученик: <b>${escapeHtml(identity.fio)}</b>, класс <b>${escapeHtml(identity.cls)}</b>`;
        if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);
      }

      buildAndRestore();
    }

    document.addEventListener("DOMContentLoaded", () => {
      init().catch(showFatal);
    });

  } catch (e) {
    showFatal(e);
  }
 (() => {
  "use strict";

  // ========= helpers =========
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function showFatal(err) {
    const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    document.documentElement.style.background = "#0b1020";
    document.body.innerHTML = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;padding:18px;color:#fff">
        <h2 style="margin:0 0 10px">Ошибка в контрольной</h2>
        <pre style="white-space:pre-wrap;background:rgba(255,255,255,.06);padding:12px;border-radius:12px">${escapeHtml(msg)}</pre>
        <div style="opacity:.85;margin-top:10px">Открой консоль (F12 → Console), там будет та же ошибка.</div>
      </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[m]));
  }

  function normText(s) {
    if (s == null) return "";
    return String(s).trim().replace(/\s+/g, " ");
  }

  function capWord(w) {
    const s = String(w || "").trim();
    if (!s) return "";
    return s[0].toUpperCase() + s.slice(1).toLowerCase();
  }

  function normalizeFioInput(raw) {
    const parts = String(raw || "")
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean)
      .slice(0, 3);
    return parts.map(capWord).join(" ");
  }

  function normalizeClassInput(raw) {
    return String(raw || "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, 6);
  }

  function saveJSON(key, obj) {
    localStorage.setItem(key, JSON.stringify(obj));
  }

  function loadJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function sha256Hex(str) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function fmtMs(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  // best-effort: блокировка копирования (опционально)
  function enableCopyBlock() {
    document.body.classList.add("nocopy");
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
    ["copy", "cut", "paste", "contextmenu", "selectstart", "dragstart"].forEach((ev) => {
      document.addEventListener(ev, stop, true);
    });
    document.addEventListener("keydown", (e) => {
      const k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "a", "s", "p"].includes(k)) stop(e);
      if (e.key === "PrintScreen") stop(e);
    }, true);
  }

  // водяной знак (опционально)
  function enableWatermark(text) {
    const w = document.createElement("div");
    w.id = "wmark";
    w.innerHTML = `<div class="t">${escapeHtml(text)}</div>`;
    document.body.appendChild(w);

    let t = 0;
    setInterval(() => {
      t += 1;
      const el = w.querySelector(".t");
      if (!el) return;
      el.style.transform =
        `translate(-50%,-50%) rotate(-22deg) translate(${Math.sin(t / 7) * 12}px, ${Math.cos(t / 9) * 10}px)`;
    }, 250);
  }
  
    // ФУНКЦИЯ АВТОСОХРАНЕНИЯ - СРАБАТЫВАЕТ ПРИ ИЗМЕНЕНИИ ПОЛЯ
    function saveProgress() {
      // Сохраняем текущее значение из активного поля
      const currentTask = data?.tasks?.[idx];
      if (currentTask) {
        const inp = $(`#in-${currentTask.id}`);
        if (inp) {
          allAnswers[currentTask.id] = { value: inp.value || "" };
        }
      }
      
      const state = {
        idx,
        answers: allAnswers,
        ts: new Date().toISOString(),
      };
      saveJSON(STORAGE_KEY, state);
      console.log("Прогресс сохранён:", state);
    }

    

    // УМНАЯ ФУНКЦИЯ ОТПРАВКИ: объединяет обычную и досрочную выгрузку
    async function smartExportResult() {
      if (submitInFlight) return;

      // Подсчитываем решённые задания
      const solvedCount = (data?.tasks || []).filter(t => 
        normText(allAnswers[t.id]?.value || "") !== ""
      ).length;
      const totalCount = (data?.tasks || []).length;
      const allFilled = solvedCount === totalCount;

      let pack;
      let confirmationMessage;

      if (allFilled) {
        // Все задания заполнены - обычная отправка
        confirmationMessage = `Все задания выполнены (${solvedCount}/${totalCount}).
        
Отправить работу на проверку?`;
        
        if (!confirm(confirmationMessage)) {
          return;
        }
        
        pack = buildResultPack();
      } else {
        // Не все задания заполнены - досрочная отправка с подстановкой "0"
        confirmationMessage = `Выполнено ${solvedCount} из ${totalCount} заданий.
        
ПУСТЫЕ ОТВЕТЫ БУДУТ ЗАМЕНЕНЫ НА "0"!
        
Вы уверены, что хотите отправить работу досрочно?`;
        
        if (!confirm(confirmationMessage)) {
          return;
        }
        
        pack = buildResultPackWithZeros();
      }

      const hash = await sha256Hex(JSON.stringify(pack));

      if (submitDone && sentHash === hash) {
        alert("Результат уже отправлен ✅");
        return;
      }

      const btn = $("#export");
      submitInFlight = true;
      if (btn) { btn.disabled = true; btn.textContent = "Отправка…"; }

      try {
        const resp = await submitResultToCloud(pack);

        submitDone = true;
        sentHash = hash;
        saveJSON(SENT_KEY, { submitDone, sentHash, ts: new Date().toISOString() });

        if (btn) { btn.disabled = true; btn.textContent = "Отправлено ✅"; }

        if (allFilled) {
          alert(`Работа успешно отправлена! ✅
          
Все задания выполнены (${solvedCount}/${totalCount}).`);
        } else {
          alert(`Работа отправлена досрочно! ✅
          
Выполнено: ${solvedCount} из ${totalCount} заданий
Пустые ответы заменены на "0".`);
        }
      } catch (e) {
        submitInFlight = false;
        if (btn) { btn.disabled = false; btn.textContent = "Отправить работу"; }
        alert("Не удалось отправить результат.\n\n" + (e?.message || e));
      }
    }

    async function exportResult({ auto = false } = {}) {
      if (submitInFlight) return;

      if (mode === "student" && cfg.exportOnlyAfterFinish) {
        if (!allAnswered()) {
          if (!auto) {
            // Предлагаем досрочную отправку
            await smartExportResult();
          }
          return;
        }
      }

      // Автоматическая отправка по таймеру - только если все заполнено
      if (auto) {
        if (!allAnswered()) {
          console.log("Автоотправка: не все задания выполнены, пропускаем");
          return;
        }
        
        const pack = buildResultPack();
        const hash = await sha256Hex(JSON.stringify(pack));

        if (submitDone && sentHash === hash) return;

        submitInFlight = true;
        
        try {
          await submitResultToCloud(pack);
          submitDone = true;
          sentHash = hash;
          saveJSON(SENT_KEY, { submitDone, sentHash, ts: new Date().toISOString() });
        } catch (e) {
          console.error("Автоотправка не удалась:", e);
          submitInFlight = false;
        }
        return;
      }

      // Ручная отправка - используем умную функцию
      await smartExportResult();
    }

    function resetAll() {
      if (!confirm("Сбросить ответы на этом устройстве?")) return;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ID_KEY);
      localStorage.removeItem(TIMER_KEY);
      localStorage.removeItem(SENT_KEY);
      location.reload();
    }

    function startTimerIfNeeded() {
      const saved = loadJSON(TIMER_KEY);
      if (saved && saved.startedAt && !saved.finished) {
        timer = saved;
        timer.warned = timer.warned || {};
        timer.durationMs = Number(timer.durationMs || (DURATION_MIN * 60 * 1000));
      } else if (!timer.startedAt) {
        timer.startedAt = Date.now();
        timer.finished = false;
        timer.warned = {};
        timer.durationMs = DURATION_MIN * 60 * 1000;
        saveJSON(TIMER_KEY, timer);
      }

      const line = $("#timerLine");
      if (line) line.style.display = "block";

      if (timerTick) clearInterval(timerTick);
      timerTick = setInterval(async () => {
        const now = Date.now();
        const endAt = Number(timer.startedAt) + Number(timer.durationMs);
        const left = endAt - now;

        if (line) line.textContent = `Осталось времени: ${fmtMs(left)}`;
        
        if (left <= 5 * 60 * 1000) {
          line.classList.add('warning');
        } else {
          line.classList.remove('warning');
        }

        for (const ms of WARN_MS) {
          const key = String(ms);
          if (!timer.warned[key] && left <= ms && left > 0) {
            timer.warned[key] = true;
            saveJSON(TIMER_KEY, timer);
            const mins = Math.round(ms / 60000);
            alert(`Осталось ${mins} минут до конца контрольной.`);
          }
        }

        if (!timer.finished && left <= 0) {
          timer.finished = true;
          saveJSON(TIMER_KEY, timer);
          saveProgress();
          await exportResult({ auto: true });
          alert("Время вышло. Результаты отправлены.");
          clearInterval(timerTick);
        }
      }, 1000);
    }

    async function loadData() {
      const r = await fetch(dataUrl, { cache: "no-store" });
      if (!r.ok) throw new Error("Не удалось загрузить файл заданий: " + r.status);
      return await r.json();
    }

    function buildAndRestore() {
      // Показываем кнопки управления в хедере
      $("#topBtns").style.display = "flex";
      
      // Назначаем обработчики для кнопок в хедере
      $("#export").onclick = smartExportResult;
      $("#reset").onclick = resetAll;

      // Восстановление прогресса
      const st = loadProgress();
      if (st) {
        idx = Math.max(0, Math.min(st.idx || 0, (data.tasks || []).length - 1));
        allAnswers = st.answers || {};
      }

      // Восстановление статуса отправки
      const sent = loadJSON(SENT_KEY);
      if (sent && sent.submitDone) {
        submitDone = true;
        sentHash = sent.sentHash || null;
        const btn = $("#export");
        if (btn) { btn.disabled = true; btn.textContent = "Отправлено ✅"; }
      }

      showOnlyCurrent();
      startTimerIfNeeded();
    }

    async function init() {
      const app = $("#app");
      if (!app) throw new Error("Не найден контейнер #app в HTML");
      
      injectStyles();
      app.innerHTML = appTemplate();

      if (mode === "student" && cfg.blockCopy) enableCopyBlock();

      data = await loadData();

      $("#title").textContent = data?.meta?.title || "Контрольная работа";

      textBlocks = loadTextBlocksFromMeta(data?.meta);

      identity = loadJSON(ID_KEY);
      const needId = (mode === "student" && cfg.requireIdentity);

      if (needId && (!identity || !identity.fio || !identity.cls)) {
        $("#identityCard").style.display = "block";
        $("#identityLine").style.display = "none";
        $("#topBtns").style.display = "none";
        $("#timerLine").style.display = "none";

        $("#fio").addEventListener("blur", () => { $("#fio").value = normalizeFioInput($("#fio").value); });
        $("#cls").addEventListener("blur", () => { $("#cls").value = normalizeClassInput($("#cls").value); });

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
          saveJSON(ID_KEY, identity);

          $("#identityCard").style.display = "none";
          $("#topBtns").style.display = "flex";
          $("#identityLine").style.display = "block";
          $("#identityLine").innerHTML = `Ученик: <b>${escapeHtml(identity.fio)}</b>, класс <b>${escapeHtml(identity.cls)}</b>`;

          if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);

          timer = {
            startedAt: Date.now(),
            durationMs: DURATION_MIN * 60 * 1000,
            warned: {},
            finished: false,
          };
          saveJSON(TIMER_KEY, timer);

          buildAndRestore();
        };

        return;
      }

      if (needId && identity) {
        $("#identityLine").style.display = "block";
        $("#identityLine").innerHTML = `Ученик: <b>${escapeHtml(identity.fio)}</b>, класс <b>${escapeHtml(identity.cls)}</b>`;
        if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);
      }

      buildAndRestore();
    }

    document.addEventListener("DOMContentLoaded", () => {
      init().catch(showFatal);
    });

  } catch (e) {
    showFatal(e);
  }
 (() => {
  "use strict";

  // ========= helpers =========
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function showFatal(err) {
    const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    document.documentElement.style.background = "#0b1020";
    document.body.innerHTML = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;padding:18px;color:#fff">
        <h2 style="margin:0 0 10px">Ошибка в контрольной</h2>
        <pre style="white-space:pre-wrap;background:rgba(255,255,255,.06);padding:12px;border-radius:12px">${escapeHtml(msg)}</pre>
        <div style="opacity:.85;margin-top:10px">Открой консоль (F12 → Console), там будет та же ошибка.</div>
      </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[m]));
  }

  function normText(s) {
    if (s == null) return "";
    return String(s).trim().replace(/\s+/g, " ");
  }

  function capWord(w) {
    const s = String(w || "").trim();
    if (!s) return "";
    return s[0].toUpperCase() + s.slice(1).toLowerCase();
  }

  function normalizeFioInput(raw) {
    const parts = String(raw || "")
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean)
      .slice(0, 3);
    return parts.map(capWord).join(" ");
  }

  function normalizeClassInput(raw) {
    return String(raw || "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, 6);
  }

  function saveJSON(key, obj) {
    localStorage.setItem(key, JSON.stringify(obj));
  }

  function loadJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function sha256Hex(str) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function fmtMs(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  // best-effort: блокировка копирования (опционально)
  function enableCopyBlock() {
    document.body.classList.add("nocopy");
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
    ["copy", "cut", "paste", "contextmenu", "selectstart", "dragstart"].forEach((ev) => {
      document.addEventListener(ev, stop, true);
    });
    document.addEventListener("keydown", (e) => {
      const k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "a", "s", "p"].includes(k)) stop(e);
      if (e.key === "PrintScreen") stop(e);
    }, true);
  }

  // водяной знак (опционально)
  function enableWatermark(text) {
    const w = document.createElement("div");
    w.id = "wmark";
    w.innerHTML = `<div class="t">${escapeHtml(text)}</div>`;
    document.body.appendChild(w);

    let t = 0;
    setInterval(() => {
      t += 1;
      const el = w.querySelector(".t");
      if (!el) return;
      el.style.transform =
        `translate(-50%,-50%) rotate(-22deg) translate(${Math.sin(t / 7) * 12}px, ${Math.cos(t / 9) * 10}px)`;
    }, 250);
  }

  
  
    // ФУНКЦИЯ АВТОСОХРАНЕНИЯ - СРАБАТЫВАЕТ ПРИ ИЗМЕНЕНИИ ПОЛЯ
    function saveProgress() {
      // Сохраняем текущее значение из активного поля
      const currentTask = data?.tasks?.[idx];
      if (currentTask) {
        const inp = $(`#in-${currentTask.id}`);
        if (inp) {
          allAnswers[currentTask.id] = { value: inp.value || "" };
        }
      }
      
      const state = {
        idx,
        answers: allAnswers,
        ts: new Date().toISOString(),
      };
      saveJSON(STORAGE_KEY, state);
      console.log("Прогресс сохранён:", state);
    }

    // ОБНОВЛЕННАЯ ФУНКЦИЯ: Отображает все элементы для текущего задания
    function updateTaskDisplay() {
      const container = $("#questionContainer");
      if (!container) return;

      const hasText = currentTaskHasText();
      const taskHtml = data?.tasks?.[idx] ? renderTask(data.tasks[idx]) : "";
      const textHtml = getTextForCurrentTask();
      
      // Собираем HTML в нужном порядке
      let finalHtml = "";
      
      if (hasText && textHtml) {
        finalHtml += `
          <div class="card">
            <div class="qid">Текст</div>
            <div class="qtext">${textHtml}</div>
          </div>
        `;
      }
      
      // Добавляем задание (в нём уже есть кнопки навигации внизу)
      finalHtml += taskHtml;
      
      container.innerHTML = finalHtml;
      
      // Назначаем обработчики для кнопок навигации под ответом
      $("#prevBtn").onclick = goPrev;
      $("#nextBtn").onclick = goNext;
      
      // НАСТРАИВАЕМ АВТОСОХРАНЕНИЕ ДЛЯ ТЕКУЩЕГО ПОЛЯ
      const currentTask = data?.tasks?.[idx];
      if (currentTask) {
        const inp = $(`#in-${currentTask.id}`);
        if (inp) {
          inp.addEventListener("input", saveProgress);
          inp.addEventListener("blur", saveProgress);
        }
      }
    }

    function loadProgress() {
      return loadJSON(STORAGE_KEY);
    }

    function showOnlyCurrent() {
      // ВАЖНО: Мы не скрываем задания, а перерисовываем контейнер
      updateTaskDisplay();
    }

    function goNext() {
      saveProgress(); // Сохраняем перед переходом
      if (idx < (data?.tasks || []).length - 1) idx++;
      showOnlyCurrent();
    }

    function goPrev() {
      saveProgress(); // Сохраняем перед переходом
      if (idx > 0) idx--;
      showOnlyCurrent();
    }

    function allAnswered() {
      return (data?.tasks || []).every((t) => normText(allAnswers[t.id]?.value || "") !== "");
    }

    // ФУНКЦИЯ: Подготовка данных с подстановкой "0" в пустые поля
    function buildResultPackWithZeros() {
      const tasks = data?.tasks || [];
      const answers = tasks.map((t) => ({
        id: t.id,
        value: normText(allAnswers[t.id]?.value || "") !== "" ? allAnswers[t.id].value : "0",
      }));

      // Подсчитываем решённые задания
      const solvedCount = answers.filter(a => normText(a.value) !== "0").length;
      const totalCount = tasks.length;

      return {
        meta: data?.meta || {},
        variant: (data?.meta?.variant || cfg.variant || "unknown"),
        identity: identity || null,
        ts: new Date().toISOString(),
        durationMinutes: DURATION_MIN,
        timer: { 
          startedAt: timer.startedAt, 
          finished: false, 
          earlySubmit: true 
        },
        answers,
        stats: {
          solved: solvedCount,
          total: totalCount,
          solvedPercentage: Math.round((solvedCount / totalCount) * 100)
        }
      };
    }

    function buildResultPack() {
      const tasks = data?.tasks || [];
      const answers = tasks.map((t) => ({
        id: t.id,
        value: allAnswers[t.id]?.value || "",
      }));

      return {
        meta: data?.meta || {},
        variant: (data?.meta?.variant || cfg.variant || "unknown"),
        identity: identity || null,
        ts: new Date().toISOString(),
        durationMinutes: DURATION_MIN,
        timer: { startedAt: timer.startedAt, finished: timer.finished },
        answers,
      };
    }

    async function submitResultToCloud(pack) {
      const url = cfg.submitUrl;
      if (!url) throw new Error("submitUrl не задан в CONTROL_CONFIG");

      const headers = { "Content-Type": "application/json" };
      if (cfg.submitToken) headers["X-Submit-Token"] = String(cfg.submitToken);

      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cfg.submitToken ? { "X-Submit-Token": cfg.submitToken } : {})
        },
        body: JSON.stringify(pack),
      });

      const txt = await r.text();
      let json = null;
      try { json = JSON.parse(txt); } catch {}

      if (!r.ok) throw new Error(`Upload failed: ${r.status} ${txt}`);
      return json || { ok: true };
    }

    // УМНАЯ ФУНКЦИЯ ОТПРАВКИ: объединяет обычную и досрочную выгрузку
    async function smartExportResult() {
      if (submitInFlight) return;

      // Подсчитываем решённые задания
      const solvedCount = (data?.tasks || []).filter(t => 
        normText(allAnswers[t.id]?.value || "") !== ""
      ).length;
      const totalCount = (data?.tasks || []).length;
      const allFilled = solvedCount === totalCount;

      let pack;
      let confirmationMessage;

      if (allFilled) {
        // Все задания заполнены - обычная отправка
        confirmationMessage = `Все задания выполнены (${solvedCount}/${totalCount}).
        
Отправить работу на проверку?`;
        
        if (!confirm(confirmationMessage)) {
          return;
        }
        
        pack = buildResultPack();
      } else {
        // Не все задания заполнены - досрочная отправка с подстановкой "0"
        confirmationMessage = `Выполнено ${solvedCount} из ${totalCount} заданий.
        
ПУСТЫЕ ОТВЕТЫ БУДУТ ЗАМЕНЕНЫ НА "0"!
        
Вы уверены, что хотите отправить работу досрочно?`;
        
        if (!confirm(confirmationMessage)) {
          return;
        }
        
        pack = buildResultPackWithZeros();
      }

      const hash = await sha256Hex(JSON.stringify(pack));

      if (submitDone && sentHash === hash) {
        alert("Результат уже отправлен ✅");
        return;
      }

      const btn = $("#export");
      submitInFlight = true;
      if (btn) { btn.disabled = true; btn.textContent = "Отправка…"; }

      try {
        const resp = await submitResultToCloud(pack);

        submitDone = true;
        sentHash = hash;
        saveJSON(SENT_KEY, { submitDone, sentHash, ts: new Date().toISOString() });

        if (btn) { btn.disabled = true; btn.textContent = "Отправлено ✅"; }

        if (allFilled) {
          alert(`Работа успешно отправлена! ✅
          
Все задания выполнены (${solvedCount}/${totalCount}).`);
        } else {
          alert(`Работа отправлена досрочно! ✅
          
Выполнено: ${solvedCount} из ${totalCount} заданий
Пустые ответы заменены на "0".`);
        }
      } catch (e) {
        submitInFlight = false;
        if (btn) { btn.disabled = false; btn.textContent = "Отправить работу"; }
        alert("Не удалось отправить результат.\n\n" + (e?.message || e));
      }
    }

    async function exportResult({ auto = false } = {}) {
      if (submitInFlight) return;

      if (mode === "student" && cfg.exportOnlyAfterFinish) {
        if (!allAnswered()) {
          if (!auto) {
            // Предлагаем досрочную отправку
            await smartExportResult();
          }
          return;
        }
      }

      // Автоматическая отправка по таймеру - только если все заполнено
      if (auto) {
        if (!allAnswered()) {
          console.log("Автоотправка: не все задания выполнены, пропускаем");
          return;
        }
        
        const pack = buildResultPack();
        const hash = await sha256Hex(JSON.stringify(pack));

        if (submitDone && sentHash === hash) return;

        submitInFlight = true;
        
        try {
          await submitResultToCloud(pack);
          submitDone = true;
          sentHash = hash;
          saveJSON(SENT_KEY, { submitDone, sentHash, ts: new Date().toISOString() });
        } catch (e) {
          console.error("Автоотправка не удалась:", e);
          submitInFlight = false;
        }
        return;
      }

      // Ручная отправка - используем умную функцию
      await smartExportResult();
    }

    function resetAll() {
      if (!confirm("Сбросить ответы на этом устройстве?")) return;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ID_KEY);
      localStorage.removeItem(TIMER_KEY);
      localStorage.removeItem(SENT_KEY);
      location.reload();
    }

    function startTimerIfNeeded() {
      const saved = loadJSON(TIMER_KEY);
      if (saved && saved.startedAt && !saved.finished) {
        timer = saved;
        timer.warned = timer.warned || {};
        timer.durationMs = Number(timer.durationMs || (DURATION_MIN * 60 * 1000));
      } else if (!timer.startedAt) {
        timer.startedAt = Date.now();
        timer.finished = false;
        timer.warned = {};
        timer.durationMs = DURATION_MIN * 60 * 1000;
        saveJSON(TIMER_KEY, timer);
      }

      const line = $("#timerLine");
      if (line) line.style.display = "block";

      if (timerTick) clearInterval(timerTick);
      timerTick = setInterval(async () => {
        const now = Date.now();
        const endAt = Number(timer.startedAt) + Number(timer.durationMs);
        const left = endAt - now;

        if (line) line.textContent = `Осталось времени: ${fmtMs(left)}`;
        
        if (left <= 5 * 60 * 1000) {
          line.classList.add('warning');
        } else {
          line.classList.remove('warning');
        }

        for (const ms of WARN_MS) {
          const key = String(ms);
          if (!timer.warned[key] && left <= ms && left > 0) {
            timer.warned[key] = true;
            saveJSON(TIMER_KEY, timer);
            const mins = Math.round(ms / 60000);
            alert(`Осталось ${mins} минут до конца контрольной.`);
          }
        }

        if (!timer.finished && left <= 0) {
          timer.finished = true;
          saveJSON(TIMER_KEY, timer);
          saveProgress();
          await exportResult({ auto: true });
          alert("Время вышло. Результаты отправлены.");
          clearInterval(timerTick);
        }
      }, 1000);
    }

    async function loadData() {
      const r = await fetch(dataUrl, { cache: "no-store" });
      if (!r.ok) throw new Error("Не удалось загрузить файл заданий: " + r.status);
      return await r.json();
    }

    function buildAndRestore() {
      // Показываем кнопки управления в хедере
      $("#topBtns").style.display = "flex";
      
      // Назначаем обработчики для кнопок в хедере
      $("#export").onclick = smartExportResult;
      $("#reset").onclick = resetAll;

      // Восстановление прогресса
      const st = loadProgress();
      if (st) {
        idx = Math.max(0, Math.min(st.idx || 0, (data.tasks || []).length - 1));
        allAnswers = st.answers || {};
      }

      // Восстановление статуса отправки
      const sent = loadJSON(SENT_KEY);
      if (sent && sent.submitDone) {
        submitDone = true;
        sentHash = sent.sentHash || null;
        const btn = $("#export");
        if (btn) { btn.disabled = true; btn.textContent = "Отправлено ✅"; }
      }

      showOnlyCurrent();
      startTimerIfNeeded();
    }

    async function init() {
      const app = $("#app");
      if (!app) throw new Error("Не найден контейнер #app в HTML");
      
      injectStyles();
      app.innerHTML = appTemplate();

      if (mode === "student" && cfg.blockCopy) enableCopyBlock();

      data = await loadData();

      $("#title").textContent = data?.meta?.title || "Контрольная работа";

      textBlocks = loadTextBlocksFromMeta(data?.meta);

      identity = loadJSON(ID_KEY);
      const needId = (mode === "student" && cfg.requireIdentity);

      if (needId && (!identity || !identity.fio || !identity.cls)) {
        $("#identityCard").style.display = "block";
        $("#identityLine").style.display = "none";
        $("#topBtns").style.display = "none";
        $("#timerLine").style.display = "none";

        $("#fio").addEventListener("blur", () => { $("#fio").value = normalizeFioInput($("#fio").value); });
        $("#cls").addEventListener("blur", () => { $("#cls").value = normalizeClassInput($("#cls").value); });

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
          saveJSON(ID_KEY, identity);

          $("#identityCard").style.display = "none";
          $("#topBtns").style.display = "flex";
          $("#identityLine").style.display = "block";
          $("#identityLine").innerHTML = `Ученик: <b>${escapeHtml(identity.fio)}</b>, класс <b>${escapeHtml(identity.cls)}</b>`;

          if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);

          timer = {
            startedAt: Date.now(),
            durationMs: DURATION_MIN * 60 * 1000,
            warned: {},
            finished: false,
          };
          saveJSON(TIMER_KEY, timer);

          buildAndRestore();
        };

        return;
      }

      if (needId && identity) {
        $("#identityLine").style.display = "block";
        $("#identityLine").innerHTML = `Ученик: <b>${escapeHtml(identity.fio)}</b>, класс <b>${escapeHtml(identity.cls)}</b>`;
        if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);
      }

      buildAndRestore();
    }

    document.addEventListener("DOMContentLoaded", () => {
      init().catch(showFatal);
    });

  } catch (e) {
    showFatal(e);
  }
 (() => {
  "use strict";

  // ========= helpers =========
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function showFatal(err) {
    const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    document.documentElement.style.background = "#0b1020";
    document.body.innerHTML = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;padding:18px;color:#fff">
        <h2 style="margin:0 0 10px">Ошибка в контрольной</h2>
        <pre style="white-space:pre-wrap;background:rgba(255,255,255,.06);padding:12px;border-radius:12px">${escapeHtml(msg)}</pre>
        <div style="opacity:.85;margin-top:10px">Открой консоль (F12 → Console), там будет та же ошибка.</div>
      </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[m]));
  }

  function normText(s) {
    if (s == null) return "";
    return String(s).trim().replace(/\s+/g, " ");
  }

  function capWord(w) {
    const s = String(w || "").trim();
    if (!s) return "";
    return s[0].toUpperCase() + s.slice(1).toLowerCase();
  }

  function normalizeFioInput(raw) {
    const parts = String(raw || "")
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean)
      .slice(0, 3);
    return parts.map(capWord).join(" ");
  }

  function normalizeClassInput(raw) {
    return String(raw || "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, 6);
  }

  function saveJSON(key, obj) {
    localStorage.setItem(key, JSON.stringify(obj));
  }

  function loadJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function sha256Hex(str) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function fmtMs(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  // best-effort: блокировка копирования (опционально)
  function enableCopyBlock() {
    document.body.classList.add("nocopy");
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
    ["copy", "cut", "paste", "contextmenu", "selectstart", "dragstart"].forEach((ev) => {
      document.addEventListener(ev, stop, true);
    });
    document.addEventListener("keydown", (e) => {
      const k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "a", "s", "p"].includes(k)) stop(e);
      if (e.key === "PrintScreen") stop(e);
    }, true);
  }

  // водяной знак (опционально)
  function enableWatermark(text) {
    const w = document.createElement("div");
    w.id = "wmark";
    w.innerHTML = `<div class="t">${escapeHtml(text)}</div>`;
    document.body.appendChild(w);

    let t = 0;
    setInterval(() => {
      t += 1;
      const el = w.querySelector(".t");
      if (!el) return;
      el.style.transform =
        `translate(-50%,-50%) rotate(-22deg) translate(${Math.sin(t / 7) * 12}px, ${Math.cos(t / 9) * 10}px)`;
    }, 250);
  }

    // УМНАЯ ФУНКЦИЯ ОТПРАВКИ: объединяет обычную и досрочную выгрузку
    async function smartExportResult() {
      if (submitInFlight) return;

      // Подсчитываем решённые задания
      const solvedCount = (data?.tasks || []).filter(t => 
        normText(allAnswers[t.id]?.value || "") !== ""
      ).length;
      const totalCount = (data?.tasks || []).length;
      const allFilled = solvedCount === totalCount;

      let pack;
      let confirmationMessage;

      if (allFilled) {
        // Все задания заполнены - обычная отправка
        confirmationMessage = `Все задания выполнены (${solvedCount}/${totalCount}).
        
Отправить работу на проверку?`;
        
        if (!confirm(confirmationMessage)) {
          return;
        }
        
        pack = buildResultPack();
      } else {
        // Не все задания заполнены - досрочная отправка с подстановкой "0"
        confirmationMessage = `Выполнено ${solvedCount} из ${totalCount} заданий.
        
ПУСТЫЕ ОТВЕТЫ БУДУТ ЗАМЕНЕНЫ НА "0"!
        
Вы уверены, что хотите отправить работу досрочно?`;
        
        if (!confirm(confirmationMessage)) {
          return;
        }
        
        pack = buildResultPackWithZeros();
      }

      const hash = await sha256Hex(JSON.stringify(pack));

      if (submitDone && sentHash === hash) {
        alert("Результат уже отправлен ✅");
        return;
      }

      const btn = $("#export");
      submitInFlight = true;
      if (btn) { btn.disabled = true; btn.textContent = "Отправка…"; }

      try {
        const resp = await submitResultToCloud(pack);

        submitDone = true;
        sentHash = hash;
        saveJSON(SENT_KEY, { submitDone, sentHash, ts: new Date().toISOString() });

        if (btn) { btn.disabled = true; btn.textContent = "Отправлено ✅"; }

        if (allFilled) {
          alert(`Работа успешно отправлена! ✅
          
Все задания выполнены (${solvedCount}/${totalCount}).`);
        } else {
          alert(`Работа отправлена досрочно! ✅
          
Выполнено: ${solvedCount} из ${totalCount} заданий
Пустые ответы заменены на "0".`);
        }
      } catch (e) {
        submitInFlight = false;
        if (btn) { btn.disabled = false; btn.textContent = "Отправить работу"; }
        alert("Не удалось отправить результат.\n\n" + (e?.message || e));
      }
    }

    async function exportResult({ auto = false } = {}) {
      if (submitInFlight) return;

      if (mode === "student" && cfg.exportOnlyAfterFinish) {
        if (!allAnswered()) {
          if (!auto) {
            // Предлагаем досрочную отправку
            await smartExportResult();
          }
          return;
        }
      }

      // Автоматическая отправка по таймеру - только если все заполнено
      if (auto) {
        if (!allAnswered()) {
          console.log("Автоотправка: не все задания выполнены, пропускаем");
          return;
        }
        
        const pack = buildResultPack();
        const hash = await sha256Hex(JSON.stringify(pack));

        if (submitDone && sentHash === hash) return;

        submitInFlight = true;
        
        try {
          await submitResultToCloud(pack);
          submitDone = true;
          sentHash = hash;
          saveJSON(SENT_KEY, { submitDone, sentHash, ts: new Date().toISOString() });
        } catch (e) {
          console.error("Автоотправка не удалась:", e);
          submitInFlight = false;
        }
        return;
      }

      // Ручная отправка - используем умную функцию
      await smartExportResult();
    }

    function resetAll() {
      if (!confirm("Сбросить ответы на этом устройстве?")) return;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ID_KEY);
      localStorage.removeItem(TIMER_KEY);
      localStorage.removeItem(SENT_KEY);
      location.reload();
    }

    function startTimerIfNeeded() {
      const saved = loadJSON(TIMER_KEY);
      if (saved && saved.startedAt && !saved.finished) {
        timer = saved;
        timer.warned = timer.warned || {};
        timer.durationMs = Number(timer.durationMs || (DURATION_MIN * 60 * 1000));
      } else if (!timer.startedAt) {
        timer.startedAt = Date.now();
        timer.finished = false;
        timer.warned = {};
        timer.durationMs = DURATION_MIN * 60 * 1000;
        saveJSON(TIMER_KEY, timer);
      }

      const line = $("#timerLine");
      if (line) line.style.display = "block";

      if (timerTick) clearInterval(timerTick);
      timerTick = setInterval(async () => {
        const now = Date.now();
        const endAt = Number(timer.startedAt) + Number(timer.durationMs);
        const left = endAt - now;

        if (line) line.textContent = `Осталось времени: ${fmtMs(left)}`;
        
        if (left <= 5 * 60 * 1000) {
          line.classList.add('warning');
        } else {
          line.classList.remove('warning');
        }

        for (const ms of WARN_MS) {
          const key = String(ms);
          if (!timer.warned[key] && left <= ms && left > 0) {
            timer.warned[key] = true;
            saveJSON(TIMER_KEY, timer);
            const mins = Math.round(ms / 60000);
            alert(`Осталось ${mins} минут до конца контрольной.`);
          }
        }

        if (!timer.finished && left <= 0) {
          timer.finished = true;
          saveJSON(TIMER_KEY, timer);
          saveProgress();
          await exportResult({ auto: true });
          alert("Время вышло. Результаты отправлены.");
          clearInterval(timerTick);
        }
      }, 1000);
    }

    async function loadData() {
      const r = await fetch(dataUrl, { cache: "no-store" });
      if (!r.ok) throw new Error("Не удалось загрузить файл заданий: " + r.status);
      return await r.json();
    }

    function buildAndRestore() {
      // Показываем кнопки управления в хедере
      $("#topBtns").style.display = "flex";
      
      // Назначаем обработчики для кнопок в хедере
      $("#export").onclick = smartExportResult;
      $("#reset").onclick = resetAll;

      // Восстановление прогресса
      const st = loadProgress();
      if (st) {
        idx = Math.max(0, Math.min(st.idx || 0, (data.tasks || []).length - 1));
        allAnswers = st.answers || {};
      }

      // Восстановление статуса отправки
      const sent = loadJSON(SENT_KEY);
      if (sent && sent.submitDone) {
        submitDone = true;
        sentHash = sent.sentHash || null;
        const btn = $("#export");
        if (btn) { btn.disabled = true; btn.textContent = "Отправлено ✅"; }
      }

      showOnlyCurrent();
      startTimerIfNeeded();
    }

    async function init() {
      const app = $("#app");
      if (!app) throw new Error("Не найден контейнер #app в HTML");
      
      injectStyles();
      app.innerHTML = appTemplate();

      if (mode === "student" && cfg.blockCopy) enableCopyBlock();

      data = await loadData();

      $("#title").textContent = data?.meta?.title || "Контрольная работа";

      textBlocks = loadTextBlocksFromMeta(data?.meta);

      identity = loadJSON(ID_KEY);
      const needId = (mode === "student" && cfg.requireIdentity);

      if (needId && (!identity || !identity.fio || !identity.cls)) {
        $("#identityCard").style.display = "block";
        $("#identityLine").style.display = "none";
        $("#topBtns").style.display = "none";
        $("#timerLine").style.display = "none";

        $("#fio").addEventListener("blur", () => { $("#fio").value = normalizeFioInput($("#fio").value); });
        $("#cls").addEventListener("blur", () => { $("#cls").value = normalizeClassInput($("#cls").value); });

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
          saveJSON(ID_KEY, identity);

          $("#identityCard").style.display = "none";
          $("#topBtns").style.display = "flex";
          $("#identityLine").style.display = "block";
          $("#identityLine").innerHTML = `Ученик: <b>${escapeHtml(identity.fio)}</b>, класс <b>${escapeHtml(identity.cls)}</b>`;

          if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);

          timer = {
            startedAt: Date.now(),
            durationMs: DURATION_MIN * 60 * 1000,
            warned: {},
            finished: false,
          };
          saveJSON(TIMER_KEY, timer);

          buildAndRestore();
        };

        return;
      }

      if (needId && identity) {
        $("#identityLine").style.display = "block";
        $("#identityLine").innerHTML = `Ученик: <b>${escapeHtml(identity.fio)}</b>, класс <b>${escapeHtml(identity.cls)}</b>`;
        if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);
      }

      buildAndRestore();
    }

    document.addEventListener("DOMContentLoaded", () => {
      init().catch(showFatal);
    });

  } catch (e) {
    showFatal(e);
  }
})();
