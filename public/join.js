// PRE-FILL CODE FROM URL
const params = new URLSearchParams(window.location.search);
const code = params.get("code");
if(code){
  document.getElementById("sessionCode").value = code;
}

// FORM SUBMIT
const form = document.querySelector("form");
const nameError = document.querySelector(".name-error");
const codeError = document.querySelector(".code-error");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  nameError.textContent = "";
  codeError.textContent = "";

  const name = document.getElementById("userName").value.trim();
  const sessionCode = document.getElementById("sessionCode").value.trim();

  if(!name){
    nameError.textContent = "Please enter your name";
    return;
  }
  if(!sessionCode){
    codeError.textContent = "Please enter session code";
    return;
  }

  // SAVE AND REDIRECT TO AUDIENCE PAGE
  localStorage.setItem("audienceName", name);
  localStorage.setItem("sessionCode", sessionCode);
  window.location.href = `audience.html?code=${sessionCode}&name=${encodeURIComponent(name)}`;
});