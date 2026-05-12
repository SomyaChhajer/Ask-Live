const form = document.querySelector("form");

// HIDE LOGIN LINK IF COMING FROM JOIN SESSION
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  if(params.get("from") === "join") {
    const loginText = document.querySelector(".login-text");
    if(loginText) loginText.style.display = "none";
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.querySelector(
    'input[type="email"]'
  ).value;
  const password = document.querySelectorAll(
    'input[type="password"]'
  )[0].value;
  const confirmPassword = document.querySelectorAll(
    'input[type="password"]'
  )[1].value;
  // VALIDATION
  if(email === "" || password === "" || confirmPassword === ""){
    alert("Please fill all fields");
    return;
  }
  if(password !== confirmPassword){
    alert("Passwords do not match");
    return;
  }
  // API CALL
  const response = await fetch("/signup", {
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      email,
      password
    })
  });
  const data = await response.json();
  if(data.success){
    alert("Account Created Successfully");
    window.location.href = "login.html";
  }
  else{
    alert(data.message);
  }
});