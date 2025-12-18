function injectStyles() {
  const st = document.createElement("style");
  st.textContent = `
    /* Дополнительные стили для control_core.js */
    body { 
      background:#0b1020;
      color:#e1e7f5;
      margin:0;
      font-family:system-ui,Segoe UI,Arial;
      min-height: 100vh;
    }
    
    .wrap { 
      max-width:1000px;
      margin:0 auto;
      padding:0 20px; 
    }
    
    header { 
      padding:12px 0;
      background:#0a1228;
      position:sticky;
      top:0;
      z-index:10;
      border-bottom:1px solid rgba(255,255,255,.08);
    }
    
    h1 { 
      font-size:30px;
      margin:0 0 12px;
      text-align:center; 
    }
    
    .btnbar { 
      display:flex;
      gap:12px;
      justify-content:center;
      margin-top:10px; 
    }
    
    /* Используем классы из ui.css */
    #export, #exportEmail, #start {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 0;
      border-radius: 16px;
      padding: 12px 24px;
      cursor: pointer;
      color: #e9ecff;
      background: #2b3a7a;
      font-weight: 700;
      text-decoration: none;
      text-align: center;
      transition: all 0.3s ease;
      font-size: 16px;
      line-height: 1;
      border: 2px solid transparent;
      min-height: 44px;
      font-family: inherit;
    }
    
    #export:hover, #exportEmail:hover, #start:hover {
      background: #4a5bc0;
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    }
    
    #export:active, #exportEmail:active, #start:active {
      transform: translateY(0);
    }
    
    #exportEmail, #prevBtn, #nextBtn {
      background: rgba(255, 255, 255, .08);
    }
    
    #exportEmail:hover, #prevBtn:hover, #nextBtn:hover {
      background: rgba(255, 255, 255, .15);
    }
    
    button:disabled { 
      opacity:.6;
      cursor: not-allowed;
      transform: none !important;
    }

    #wmark { 
      position:fixed;
      top:50%;
      left:50%;
      transform:translate(-50%,-50%);
      opacity:.15;
      font-size:38px;
      pointer-events:none; 
    }

    .card { 
      background:rgba(255,255,255,.06);
      border-radius:12px;
      padding:22px;
      margin:20px 0;
      border:1px solid rgba(255,255,255,.08); 
    }
    
    .qid { 
      font-size:20px;
      font-weight:700;
      margin-bottom:10px; 
    }

    .ansrow { 
      margin-top:20px;
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      align-items: center;
    }
    
    /* Стили полей ввода из ui.css */
    #fio, #cls, input[type="text"] { 
      width: 100%;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid #27305a;
      background: #0b1228;
      color: #e9ecff;
      outline: none;
      font-family: inherit;
      font-size: 16px;
      transition: border-color 0.3s ease;
      flex: 1;
    }
    
    #fio:focus, #cls:focus, input[type="text"]:focus {
      border-color: #3a4aa0;
    }
    
    #fio::placeholder, #cls::placeholder, input[type="text"]::placeholder {
      color: rgba(184, 192, 255, 0.6);
    }
    
    input[type=text]:disabled { 
      opacity:0.5; 
      cursor:not-allowed; 
      background:rgba(255,255,255,.05); 
    }

    .nav-buttons-below { 
      display:flex;
      gap:12px;
      justify-content:center;
      margin-top:25px; 
    }
    
    /* Специальные стили для полей ФИО и класса */
    #fio, #cls {
      min-height: 48px;
      background: rgba(11, 18, 40, 0.8);
      border: 1px solid rgba(39, 48, 90, 0.8);
    }
    
    #fio:focus, #cls:focus {
      background: rgba(11, 18, 40, 0.9);
      border-color: #3a4aa0;
      box-shadow: 0 0 0 2px rgba(58, 74, 160, 0.2);
    }
    
    /* Адаптивность для мобильных */
    @media (max-width: 768px) {
      .wrap {
        padding: 0 16px;
      }
      
      .ansrow {
        flex-direction: column;
      }
      
      #fio, #cls, input[type="text"] {
        width: 100%;
      }
      
      .btnbar {
        flex-direction: column;
      }
      
      #export, #exportEmail {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(st);
}
