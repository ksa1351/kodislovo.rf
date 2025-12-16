(() => {
  "use strict";

  // Показ ошибки вместо “белого экрана”
  function showFatal(err) {
    const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    document.documentElement.style.background = "#0b1020";
    document.body.innerHTML = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;padding:18px;color:#fff">
        <h2 style="margin:0 0 10px">Ошибка в контрольной</h2>
        <pre style="white-space:pre-wrap; background:rgba(255,255,255,.06); padding:12px; border-radius:12px">${escapeHtml(msg)}</pre>
        <div style="opacity:.8;margin-top:10px">Открой консоль (F12 → Console), там будет та же ошибка.</div>
      </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
    }[m]));
  }

  function testTextDisplay() {
    if (!data || !data.tasks) {
      console.log("testTextDisplay: данные не загружены");
      return;
    }
    
    const tasks = data.tasks || [];
    console.log("=== ТЕСТ ОТОБРАЖЕНИЯ ТЕКСТА ===");
    console.log("Всего заданий:", tasks.length);
    console.log("Текст Часть 1:", textPart1 ? "есть (" + textPart1.length + " символов)" : "нет");
    console.log("Текст Часть 2:", textPart2 ? "есть (" + textPart2.length + " символов)" : "нет");
    
    // Проверяем для всех заданий
    tasks.forEach((task, index) => {
      const taskId = parseInt(task.id) || task.id;
      console.log(`Задание ${taskId} (индекс ${index}):`);
      
      if (taskId >= 1 && taskId <= 3) {
        console.log("  → Должен показывать Часть 1");
      } else if (taskId >= 23 && taskId <= 26) {
        console.log("  → Должен показывать Часть 2");
      } else {
        console.log("  → Не должен показывать текст");
      }
    });
  }

  try {
    const cfg = window.CONTROL_CONFIG || {};
    const mode = cfg.mode || "student";
    const dataUrl = cfg.dataUrl || "./variant26_cut.json";

    // Таймер
    const DURATION_MIN = Number(cfg.durationMinutes || 60);
    const WARN_10_MS = 10 * 60 * 1000;
    const WARN_5_MS  = 5 * 60 * 1000;

    // Storage
    const STORAGE_KEY = "kontrol:" + dataUrl;
    const ID_KEY      = STORAGE_KEY + ":identity";
    const TIMER_KEY   = STORAGE_KEY + ":timer";
    const SENT_KEY    = STORAGE_KEY + ":sent";

    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => r.querySelectorAll(s);

    function normText(s) {
      if (s == null) return "";
      return String(s).trim().replace(/\s+/g, " ");
    }

    // ФИО с заглавных
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

    // best-effort: блокировка копирования
    function enableCopyBlock() {
      document.body.classList.add("nocopy");
      const stop = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
      ["copy","cut","paste","contextmenu","selectstart","dragstart"].forEach(ev => {
        document.addEventListener(ev, stop, true);
      });
      document.addEventListener("keydown", (e) => {
        const k = (e.key || "").toLowerCase();
        if ((e.ctrlKey || e.metaKey) && ["c","x","a","s","p"].includes(k)) stop(e);
        if (e.key === "PrintScreen") stop(e);
      }, true);
    }

    // водяной знак
    function enableWatermark(text) {
      const w = document.createElement("div");
      w.className = "watermark-text-overlay";
      w.innerHTML = `<div class="watermark-text">${text}</div>`;
      document.body.appendChild(w);

      let t = 0;
      setInterval(() => {
        t += 1;
        const el = w.querySelector(".watermark-text");
        if (!el) return;
        el.style.transform =
          `translate(-50%,-50%) rotate(-22deg) translate(${Math.sin(t/7)*12}px, ${Math.cos(t/9)*10}px)`;
      }, 250);
    }

    function saveJSON(key, obj) { localStorage.setItem(key, JSON.stringify(obj)); }
    function loadJSON(key) {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
      catch { return null; }
    }

    async function sha256Hex(str) {
      const enc = new TextEncoder().encode(str);
      const buf = await crypto.subtle.digest("SHA-256", enc);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
    }

    // ===== ТЕКСТЫ ВАРИАНТА =====
    let textPart1 = "";
    let textPart2 = "";

    function updateTextCardForTaskIndex(taskIndex) {
      const card = $("#textCard");
      const box  = $("#textHtml");
      if (!card || !box) return;

      const tasks = data?.tasks || [];
      const currentTask = tasks[taskIndex];
      if (!currentTask) return;

      const taskId = parseInt(currentTask.id) || currentTask.id;
      
      // ОТЛАДОЧНАЯ ИНФОРМАЦИЯ
      console.log("Task ID:", taskId, "Type:", typeof taskId);
      console.log("Text Part1 exists:", !!textPart1);
      console.log("Text Part2 exists:", !!textPart2);

      // если текста нет — скрываем
      if (!textPart1 && !textPart2) {
        console.log("No text parts available, hiding card");
        card.style.display = "none";
        box.innerHTML = "";
        return;
      }

      // если есть только одна часть — показываем всегда
      if (textPart1 && !textPart2) {
        console.log("Only Part1 available, showing for all tasks");
        card.style.display = "block";
        box.innerHTML = textPart1;
        return;
      }

      // Проверяем ID задания (а не индекс!)
      // Задания 1-3 (по ID, не по индексу)
      if (taskId >= 1 && taskId <= 3) {
        console.log("Task 1-3 detected, showing Part1");
        card.style.display = "block";
        box.innerHTML = textPart1;
        return;
      }

      // Задания 23-26 (по ID, не по индексу)
      if (taskId >= 23 && taskId <= 26) {
        console.log("Task 23-26 detected, showing Part2");
        card.style.display = "block";
        box.innerHTML = textPart2;
        return;
      }

      // иначе — скрываем
      console.log("Task", taskId, "does not require text, hiding card");
      card.style.display = "none";
      box.innerHTML = "";
    }

    // Стили для компактного интерфейса
    function injectCompactStyles() {
      const style = document.createElement('style');
      style.textContent = `
        /* КОМПАКТНЫЙ ИНТЕРФЕЙС */
        .test-header {
          background: rgba(18, 26, 51, 0.95);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--line);
          padding: 0;
          margin: 0;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        
        .test-title {
          font-size: 24px;
          margin-left: 20px !important;
          margin-top: 20px !important;
          margin-bottom: 15px !important;
          color: var(--text);
        }
        
        .control-panel-above {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 20px 15px 20px;
          background: rgba(11, 18, 40, 0.6);
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          flex-wrap: wrap;
          gap: 15px;
        }
        
        .panel-left {
          display: flex;
          align-items: center;
          gap: 25px;
          flex-wrap: wrap;
        }
        
        .student-info-mini {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--text);
        }
        
        .student-label {
          color: var(--muted);
          font-weight: 600;
        }
        
        .student-name {
          font-weight: 600;
        }
        
        .student-class {
          background: var(--btn2);
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .timer-compact {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(53, 208, 127, 0.1);
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid rgba(53, 208, 127, 0.3);
          color: var(--ok);
          font-weight: 700;
        }
        
        .timer-label {
          font-size: 12px;
          color: var(--muted);
        }
        
        .timer-digits {
          font-size: 18px;
          font-family: 'Courier New', monospace;
          letter-spacing: 1px;
        }
        
        .timer-compact.warning {
          background: rgba(255, 91, 110, 0.1);
          border-color: rgba(255, 91, 110, 0.3);
          color: var(--bad);
          animation: pulse 1s infinite;
        }
        
        .nav-buttons-compact {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        
        .btn.compact {
          padding: 8px 16px;
          font-size: 13px;
          min-height: 36px;
          white-space: nowrap;
        }
        
        /* Контейнер вопроса с отступом сверху */
        .question-container {
          background: var(--card);
          border-radius: var(--radius);
          padding: 25px;
          margin-bottom: 25px;
          border: 1px solid var(--line);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          margin-top: 20px;
        }
        
        .wrap {
          padding: 20px;
          max-width: 1000px;
          margin: 0 auto;
        }
        
        /* Адаптивность */
        @media (max-width: 768px) {
          .control-panel-above {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            padding: 15px;
          }
          
          .panel-left {
            justify-content: space-between;
            width: 100%;
          }
          
          .nav-buttons-compact {
            width: 100%;
            justify-content: center;
          }
          
          .btn.compact {
            flex: 1;
            min-width: 0;
          }
          
          .test-title {
            font-size: 20px;
            margin-left: 15px !important;
            margin-top: 15px !important;
          }
          
          .timer-digits {
            font-size: 16px;
          }
        }
        
        @media (max-width: 480px) {
          .control-panel-above {
            padding: 12px;
          }
          
          .panel-left {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          
          .nav-buttons-compact {
            flex-wrap: wrap;
          }
          
          .btn.compact {
            flex: 1 1 calc(50% - 5px);
            font-size: 12px;
            padding: 6px 12px;
          }
          
          .test-title {
            font-size: 18px;
            margin-left: 12px !important;
            margin-top: 12px !important;
          }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `;
      document.head.appendChild(style);
    }

    // НОВЫЙ РЕНДЕРИНГ ИНТЕРФЕЙСА - компактный заголовок с навигацией сверху
    function appTemplate(studentName = "", studentClass = "", formattedTime = "60:00", showIdentity = false) {
      return `
        <div class="test-container">
          <!-- ЗАГОЛОВОК С ОТСТУПОМ СЛЕВА И СВЕРХУ -->
          <div class="test-header">
            <h1 class="test-title" style="margin-left: 20px; margin-top: 20px">Контрольная работа</h1>
            
            <!-- ПАНЕЛЬ УПРАВЛЕНИЯ НАД ЗАДАНИЕМ -->
            <div class="control-panel-above">
              <!-- ИНФОРМАЦИЯ СЛЕВА -->
              <div class="panel-left">
                ${showIdentity ? `
                  <div class="student-info-mini" id="identityLine">
                    <span class="student-label">Ученик:</span>
                    <span class="student-name">${studentName}</span>
                    <span class="student-class">${studentClass}</span>
                  </div>
                ` : ''}
                
                <!-- ТАЙМЕР ЦИФРАМИ -->
                <div class="timer-compact" id="timerLine">
                  <span class="timer-label">Осталось:</span>
                  <span class="timer-digits">${formattedTime}</span>
                </div>
              </div>
              
              <!-- КНОПКИ НАВИГАЦИИ СПРАВА -->
              <div class="nav-buttons-compact">
                <button class="btn compact" id="prev">
                  <span class="btn-icon">←</span> Предыдущее
                </button>
                <button class="btn compact" id="next">
                  Следующее <span class="btn-icon">→</span>
                </button>
                <button class="btn secondary compact" id="export">
                  <span class="btn-icon">⤓</span> Выгрузить
                </button>
                <button class="btn danger compact" id="reset">
                  <span class="btn-icon">↺</span> Сброс
                </button>
              </div>
            </div>
          </div>
          
          <main class="wrap">
            <!-- Карточка для ввода данных ученика -->
            <div class="card" id="identityCard" style="display:none; max-width: 500px; margin: 40px auto">
              <div class="question-number">Данные ученика</div>
              <div class="question-text">Введите <b>Фамилию и имя</b> и <b>класс</b>.</div>
              <div class="answer-input-group">
                <input id="fio" type="text" class="text-input" placeholder="Фамилия Имя" autocomplete="off">
                <input id="cls" type="text" class="text-input" placeholder="Класс (например: 10А)" autocomplete="off" style="max-width:220px">
                <button id="start" class="btn" style="margin-top:15px">Начать</button>
              </div>
              <div class="input-hint">
                ${DURATION_MIN} минут. За 10 и 5 минут до конца появятся напоминания.
                По истечении времени результаты будут автоматически отправлены.
              </div>
            </div>

            <!-- Карточка с текстом задания -->
            <div class="card" id="textCard" style="display:none; margin-top: 20px">
              <div class="question-number">Текст</div>
              <div class="question-text" id="textHtml"></div>
            </div>

            <!-- Контейнер для вопросов -->
            <div id="questionsGrid" style="margin-top: 20px"></div>
          </main>
        </div>
      `;
    }

    // ФУНКЦИЯ РЕНДЕРИНГА ВОПРОСОВ
    function renderTask(t) {
      let answerField = '';
      
      // Определяем тип вопроса из данных
      if (t.type === 'multiple_choice_numbers' || t.options) {
        // Вопрос с выбором цифр
        answerField = `
          <div class="answer-input-group">
            <input 
              type="text" 
              class="number-input" 
              id="in-${t.id}"
              placeholder="Введите цифры ответов..."
              pattern="[0-9]+"
              maxlength="5"
              oninput="this.value = this.value.replace(/[^0-9]/g, '')"
            >
            <div class="input-hint">Например: 123 или 24</div>
          </div>
        `;
      } else if (t.type === 'multiple_choice') {
        // Вопрос с вариантами ответов
        answerField = `
          <div class="options-list">
            ${(t.options || []).map((opt, i) => `
              <label class="option-item">
                <input type="radio" name="q${t.id}" value="${i}" id="opt-${t.id}-${i}">
                <span>${opt}</span>
              </label>
            `).join('')}
          </div>
        `;
      } else {
        // Обычный текстовый ответ
        answerField = `
          <div class="answer-input-group">
            <input 
              type="text" 
              class="text-input" 
              id="in-${t.id}"
              placeholder="Введите ответ..."
              autocomplete="off"
            />
          </div>
        `;
      }

      return `
        <section class="question-container" id="card-${t.id}">
          <div class="question-header">
            <div>
              <div class="question-number">Задание ${t.id}</div>
              ${t.hint ? `<div class="question-type">${t.hint}</div>` : ''}
            </div>
          </div>

          <div class="question-text">${t.text}</div>
          ${t.instruction ? `<div class="question-instruction">${t.instruction}</div>` : ''}
          
          ${answerField}
        </section>
      `;
    }

    // ===== state =====
    let data = null;
    let idx = 0;
    let identity = null;

    let submitInFlight = false;
    let submitDone = false;
    let sentHash = null;

    let timer = {
      startedAt: null,
      durationMs: DURATION_MIN * 60 * 1000,
      warned10: false,
      warned5: false,
      finished: false,
    };
    let timerTick = null;

    function saveProgress() {
      const tasks = data?.tasks || [];
      const answers = {};
      
      tasks.forEach(t => {
        if (t.type === 'multiple_choice') {
          // Для радио-кнопок
          const selected = document.querySelector(`input[name="q${t.id}"]:checked`);
          answers[t.id] = { value: selected ? selected.value : "" };
        } else {
          // Для текстовых полей
          const inp = $(`#in-${t.id}`);
          answers[t.id] = { value: inp?.value || "" };
        }
      });
      
      const state = {
        idx,
        answers,
        ts: new Date().toISOString(),
      };
      saveJSON(STORAGE_KEY, state);
    }

    function loadProgress() { return loadJSON(STORAGE_KEY); }

    function showOnlyCurrent() {
      (data.tasks || []).forEach((t, i) => {
        const card = $(`#card-${t.id}`);
        if (card) card.style.display = (i === idx) ? "block" : "none";
      });

      updateTextCardForTaskIndex(idx);
      saveProgress();
    }

    function goNext() { 
      saveProgress(); 
      if (idx < (data.tasks||[]).length - 1) idx++; 
      showOnlyCurrent(); 
    }

    function goPrev() { 
      saveProgress(); 
      if (idx > 0) idx--; 
      showOnlyCurrent(); 
    }

    function allAnswered() {
      return (data.tasks || []).every((t) => {
        if (t.type === 'multiple_choice') {
          const selected = document.querySelector(`input[name="q${t.id}"]:checked`);
          return selected !== null;
        } else {
          return normText($(`#in-${t.id}`)?.value || "") !== "";
        }
      });
    }

    function buildResultPack() {
      const tasks = data.tasks || [];
      const answers = tasks.map((t) => {
        if (t.type === 'multiple_choice') {
          const selected = document.querySelector(`input[name="q${t.id}"]:checked`);
          return {
            id: t.id,
            value: selected ? selected.value : "",
            text: selected ? t.options[selected.value] : ""
          };
        } else {
          return {
            id: t.id,
            value: $(`#in-${t.id}`)?.value || "",
          };
        }
      });

      return {
        meta: data.meta || {},
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

      const r = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(cfg.submitToken ? { "Authorization": `Bearer ${cfg.submitToken}` } : {})
        },
        body: JSON.stringify(pack),
      });

      const txt = await r.text();
      let json = null;
      try { json = JSON.parse(txt); } catch {}
      if (!r.ok) throw new Error(`Upload failed: ${r.status} ${txt}`);
      return json || { ok: true };
    }

    async function exportResult({ auto = false } = {}) {
      if (submitInFlight) return;

      if (mode === "student" && cfg.exportOnlyAfterFinish) {
        if (!allAnswered()) {
          if (!auto) alert("Отправка доступна только после выполнения ВСЕХ заданий.");
          return;
        }
      }

      const pack = buildResultPack();
      const hash = await sha256Hex(JSON.stringify(pack));

      if (submitDone && sentHash === hash) {
        if (!auto) alert("Результат уже отправлен ✅");
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

        if (btn) { btn.disabled = true; btn.textContent = "Выгружено ✅"; }

        if (!auto) alert("Результат отправлен ✅" + (resp?.key ? `\nФайл: ${resp.key}` : ""));
      } catch (e) {
        submitInFlight = false;
        if (btn) { btn.disabled = false; btn.textContent = "Выгрузить"; }
        if (!auto) alert("Не удалось отправить результат.\n\n" + (e?.message || e));
        throw e;
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

    function fmtMs(ms) {
      const s = Math.max(0, Math.floor(ms / 1000));
      const m = Math.floor(s / 60);
      const r = s % 60;
      return `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`;
    }

    function startTimerIfNeeded() {
      const saved = loadJSON(TIMER_KEY);
      if (saved && saved.startedAt && !saved.finished) {
        timer = saved;
      } else if (!timer.startedAt) {
        timer.startedAt = Date.now();
        timer.finished = false;
        timer.warned10 = false;
        timer.warned5 = false;
        saveJSON(TIMER_KEY, timer);
      }

      const timerEl = $("#timerLine");
      if (timerEl) timerEl.style.display = "flex";

      if (timerTick) clearInterval(timerTick);
      timerTick = setInterval(async () => {
        const now = Date.now();
        const endAt = Number(timer.startedAt) + Number(timer.durationMs);
        const left = endAt - now;

        const timerDigits = $(".timer-digits");
        if (timerDigits) {
          timerDigits.textContent = fmtMs(left);
        }

        if (timerEl) {
          if (left <= WARN_5_MS) {
            timerEl.classList.add("warning");
          } else {
            timerEl.classList.remove("warning");
          }
        }

        if (!timer.warned10 && left <= WARN_10_MS && left > WARN_5_MS) {
          timer.warned10 = true;
          saveJSON(TIMER_KEY, timer);
          alert("Через 10 минут результаты контрольной работы будут автоматически выгружены.");
        }
        if (!timer.warned5 && left <= WARN_5_MS && left > 0) {
          timer.warned5 = true;
          saveJSON(TIMER_KEY, timer);
          alert("Осталось 5 минут до конца контрольной.");
        }
        if (!timer.finished && left <= 0) {
          timer.finished = true;
          saveJSON(TIMER_KEY, timer);

          saveProgress();
          try {
            await exportResult({ auto: true });
            alert("Время вышло. Результаты отправлены.");
          } catch (e) {
            alert("Время вышло, но не удалось отправить результаты: " + e.message);
          }
          clearInterval(timerTick);
        }
      }, 2000);
    }

    async function loadData() {
      const r = await fetch(dataUrl, { cache: "no-store" });
      if (!r.ok) throw new Error("Не удалось загрузить файл заданий: " + r.status);
      return await r.json();
    }

    function buildAndRestore() {
      const grid = $("#questionsGrid");
      grid.innerHTML = (data.tasks || []).map(renderTask).join("");

      $("#prev").onclick = goPrev;
      $("#next").onclick = goNext;
      $("#export").onclick = () => exportResult({ auto: false });
      $("#reset").onclick = resetAll;

      const st = loadProgress();
      if (st) {
        idx = Math.max(0, Math.min(st.idx || 0, (data.tasks || []).length - 1));
        Object.entries(st.answers || {}).forEach(([id, v]) => {
          if (data.tasks.find(t => t.id == id)?.type === 'multiple_choice') {
            const radio = $(`#opt-${id}-${v.value}`);
            if (radio) radio.checked = true;
          } else {
            const inp = $(`#in-${id}`);
            if (inp) inp.value = v.value || "";
          }
        });
      }

      const sent = loadJSON(SENT_KEY);
      if (sent && sent.submitDone) {
        submitDone = true;
        sentHash = sent.sentHash || null;
        const btn = $("#export");
        if (btn) { btn.disabled = true; btn.textContent = "Выгружено ✅"; }
      }

      // Добавляем обработчики сохранения
      (data.tasks || []).forEach((t) => {
        if (t.type === 'multiple_choice') {
          $$(`input[name="q${t.id}"]`).forEach(radio => {
            radio.addEventListener("change", saveProgress);
          });
        } else {
          const inp = $(`#in-${t.id}`);
          if (inp) {
            inp.addEventListener("input", saveProgress);
            inp.addEventListener("blur", saveProgress);
          }
        }
      });

      // ТЕСТИРОВАНИЕ (можно убрать после отладки)
      testTextDisplay();
      
      showOnlyCurrent();
      startTimerIfNeeded();
    }

    async function init() {
      const app = $("#app");
      if (!app) throw new Error("Не найден контейнер #app в HTML");
      
      // Внедряем стили для компактного интерфейса
      injectCompactStyles();
      
      // Рендерим начальный интерфейс
      app.innerHTML = appTemplate();

      if (mode === "student" && cfg.blockCopy) enableCopyBlock();

      data = await loadData();

      // ОБНОВЛЕННАЯ ЛОГИКА ПАРСИНГА ТЕКСТА
      if (data.meta?.textHtml) {
        const html = String(data.meta.textHtml);
        console.log("Original textHtml length:", html.length);
        
        // Разделяем по горизонтальной линии
        let parts = [];
        
        // Пробуем разные варианты разделителя
        if (html.includes('<hr>')) {
          parts = html.split('<hr>');
          console.log("Split by <hr>, parts:", parts.length);
        } else if (html.includes('<hr/>')) {
          parts = html.split('<hr/>');
          console.log("Split by <hr/>, parts:", parts.length);
        } else if (html.includes('<hr />')) {
          parts = html.split('<hr />');
          console.log("Split by <hr />, parts:", parts.length);
        } else if (html.includes('---') || html.includes('***') || html.includes('___')) {
          // Пробуем Markdown-разделители
          const separator = html.includes('---') ? '---' : 
                          html.includes('***') ? '***' : '___';
          parts = html.split(separator);
          console.log("Split by", separator, "parts:", parts.length);
        } else {
          // Если разделителя нет, пробуем разделить по заголовкам
          if (html.includes('Часть 1') || html.includes('Текст 1') || html.includes('ТЕКСТ 1')) {
            const part1Match = html.match(/(ТЕКСТ 1|Текст 1|Часть 1)[\s\S]*?(?=ТЕКСТ 2|Текст 2|Часть 2|$)/i);
            const part2Match = html.match(/(ТЕКСТ 2|Текст 2|Часть 2)[\s\S]*/i);
            
            if (part1Match) textPart1 = part1Match[0];
            if (part2Match) textPart2 = part2Match[0];
            console.log("Split by headers, Part1:", !!textPart1, "Part2:", !!textPart2);
          } else {
            // Если ничего не нашли, вся текстовая часть - это часть 1
            textPart1 = html;
            console.log("Single part text");
          }
        }
        
        // Если разбили на части
        if (parts.length > 0) {
          textPart1 = parts[0] || "";
          if (parts.length > 1) {
            textPart2 = parts.slice(1).join('').trim();
          }
        }
        
        // Удаляем лишние пробелы и пустые строки
        textPart1 = textPart1.trim();
        textPart2 = textPart2.trim();
        
        console.log("Final Part1 length:", textPart1.length);
        console.log("Final Part2 length:", textPart2.length);
        console.log("Part1 preview:", textPart1.substring(0, 100));
        console.log("Part2 preview:", textPart2.substring(0, 100));
      }

      // ID
      identity = loadJSON(ID_KEY);
      const needId = (mode === "student" && cfg.requireIdentity);

      if (needId && (!identity || !identity.fio || !identity.cls)) {
        $("#identityCard").style.display = "block";
        
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
          saveJSON(ID_KEY, identity);

          // Обновляем интерфейс с данными ученика
          app.innerHTML = appTemplate(identity.fio, identity.cls, fmtMs(timer.durationMs), true);
          
          if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);

          // старт таймера
          timer = {
            startedAt: Date.now(),
            durationMs: DURATION_MIN * 60 * 1000,
            warned10: false,
            warned5: false,
            finished: false,
          };
          saveJSON(TIMER_KEY, timer);

          buildAndRestore();
        };

        return;
      }

      if (needId && identity) {
        // Обновляем интерфейс с данными ученика
        app.innerHTML = appTemplate(identity.fio, identity.cls, fmtMs(timer.durationMs), true);
        
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
