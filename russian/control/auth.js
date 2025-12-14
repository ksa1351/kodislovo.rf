// ===== ПРОСТАЯ ЗАЩИТА ПАРОЛЕМ (GitHub Pages) =====
(() => {
  const PASSWORD_HASH = "7102"; // ← ИЗМЕНИТЕ ПАРОЛЬ ЗДЕСЬ
  const KEY = "teacher_auth_ok";

  function hidePage(){
    document.documentElement.style.display = "none";
  }

  function showPage(){
    document.documentElement.style.display = "";
  }

  function askPassword(){
    let ok = false;
    for (let i = 0; i < 3; i++){
      const p = prompt("Доступ только для учителя.\nВведите пароль:");
      if (p === null) break;
      if (p === PASSWORD_HASH){
        sessionStorage.setItem(KEY, "1");
        ok = true;
        break;
      }
      alert("Неверный пароль");
    }
    if (!ok){
      alert("Доступ запрещён");
      location.href = "../index.html"; // назад в раздел Русский
    }
  }

  // старт
  hidePage();
  if (sessionStorage.getItem(KEY) === "1"){
    showPage();
  } else {
    askPassword();
    showPage();
  }
})();
