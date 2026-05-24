const form = document.querySelector("form");
const codeError = document.querySelector(".code-error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  codeError.textContent = "";

  const code = document.getElementById("sessionCode").value.trim().toUpperCase().replace(/\s/g, "");

  if(!code) {
    codeError.textContent = "Please enter a session code";
    return;
  }

  // CHECK IF SESSION EXISTS
  try {
    const res = await fetch(`/events/code/${code}`);
    const data = await res.json();

    if(data.success) {
  window.location.href = `audience.html?code=${code}`;
} else {
  codeError.textContent = data.message;
}
  } catch(err) {
    codeError.textContent = "Something went wrong. Try again.";
  }
});