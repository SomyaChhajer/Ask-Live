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


const googleSignupBtn = document.getElementById("googleSignupBtn");

googleSignupBtn.addEventListener("click", () => {
  const client = google.accounts.oauth2.initTokenClient({
    client_id: "YOUR_GOOGLE_CLIENT_ID",
    scope: "email profile",
    callback: async (response) => {
      try {
        // GET USER INFO
        const userInfo = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${response.access_token}` }
        }).then(r => r.json());

        // SEND TO OUR SERVER
        const res = await fetch("/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: response.access_token, email: userInfo.email })
        });

        const data = await res.json();
        if(data.success) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("userEmail", data.email);
          if(data.picture) localStorage.setItem("userPicture", data.picture);
          window.location.href = "/";
        } else {
          alert(data.message);
        }
      } catch(err) {
        alert("Google login failed. Please try again.");
      }
    }
  });
  client.requestAccessToken();
});