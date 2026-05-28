const signupStep = document.getElementById("signupStep");
const otpStep = document.getElementById("otpStep");
const signupError = document.getElementById("signupError");
const otpError = document.getElementById("otpError");
const otpSuccess = document.getElementById("otpSuccess");

let pendingEmail = "";
let pendingPassword = "";

// ===================== STEP 1: SEND OTP =====================
document.getElementById("signupBtn").addEventListener("click", async () => {
  signupError.textContent = "";
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const confirm = document.getElementById("signupConfirm").value;

  // VALIDATION
  if(!email || !password || !confirm) {
    signupError.textContent = "Please fill all fields";
    return;
  }
  if(password !== confirm) {
    signupError.textContent = "Passwords do not match";
    return;
  }
  if(password.length < 6) {
    signupError.textContent = "Password must be at least 6 characters";
    return;
  }

  const btn = document.getElementById("signupBtn");
  btn.textContent = "Sending code...";
  btn.disabled = true;

  try {
    const res = await fetch("/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if(data.success) {
      pendingEmail = email;
      pendingPassword = password;
      document.getElementById("otpSubtitle").textContent = `We sent a 6-digit code to ${email}`;
      signupStep.style.display = "none";
      otpStep.style.display = "block";
      // Focus first OTP box
      document.querySelectorAll(".otp-input")[0].focus();
    } else {
      signupError.textContent = data.message;
    }
  } catch(err) {
    signupError.textContent = "Something went wrong. Try again.";
  }

  btn.textContent = "Create Account";
  btn.disabled = false;
});

// ===================== OTP INPUT BEHAVIOUR =====================
const otpInputs = document.querySelectorAll(".otp-input");

otpInputs.forEach((input, index) => {
  input.addEventListener("input", (e) => {
    // ONLY ALLOW NUMBERS
    input.value = input.value.replace(/[^0-9]/g, "");
    if(input.value) {
      input.classList.add("filled");
      // MOVE TO NEXT
      if(index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
    }
  });

  input.addEventListener("keydown", (e) => {
    if(e.key === "Backspace" && !input.value && index > 0) {
      otpInputs[index - 1].focus();
      otpInputs[index - 1].value = "";
      otpInputs[index - 1].classList.remove("filled");
    }
  });

  // HANDLE PASTE
  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").substring(0, 6);
    otpInputs.forEach((box, i) => {
      box.value = pasted[i] || "";
      if(pasted[i]) box.classList.add("filled");
    });
    // Focus last filled or last
    const lastIndex = Math.min(pasted.length, 5);
    otpInputs[lastIndex].focus();
  });
});

// ===================== STEP 2: VERIFY OTP =====================
document.getElementById("verifyBtn").addEventListener("click", async () => {
  otpError.textContent = "";
  otpSuccess.textContent = "";

  const otp = Array.from(otpInputs).map(i => i.value).join("");

  if(otp.length < 6) {
    otpError.textContent = "Please enter the complete 6-digit code";
    otpInputs.forEach(i => i.classList.add("error"));
    return;
  }

  otpInputs.forEach(i => i.classList.remove("error"));

  const btn = document.getElementById("verifyBtn");
  btn.textContent = "Verifying...";
  btn.disabled = true;

  try {
    const res = await fetch("/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pendingEmail, otp, password: pendingPassword })
    });
    const data = await res.json();

    if(data.success) {
      otpSuccess.textContent = "✅ Account verified! Redirecting to login...";
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    } else {
      otpError.textContent = data.message;
      otpInputs.forEach(i => {
        i.classList.add("error");
        i.value = "";
        i.classList.remove("filled");
      });
      otpInputs[0].focus();
    }
  } catch(err) {
    otpError.textContent = "Something went wrong. Try again.";
  }

  btn.textContent = "Verify & Create Account";
  btn.disabled = false;
});

// ===================== RESEND OTP =====================
document.getElementById("resendBtn").addEventListener("click", async () => {
  otpError.textContent = "";
  otpSuccess.textContent = "Sending new code...";

  try {
    const res = await fetch("/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pendingEmail, password: pendingPassword })
    });
    const data = await res.json();
    if(data.success) {
      otpSuccess.textContent = "✅ New code sent! Check your email.";
      otpInputs.forEach(i => { i.value = ""; i.classList.remove("filled", "error"); });
      otpInputs[0].focus();
    } else {
      otpError.textContent = data.message;
      otpSuccess.textContent = "";
    }
  } catch(err) {
    otpError.textContent = "Failed to resend. Try again.";
    otpSuccess.textContent = "";
  }
});

// ===================== BACK BUTTON =====================
document.getElementById("backToSignup").addEventListener("click", () => {
  otpStep.style.display = "none";
  signupStep.style.display = "block";
  otpInputs.forEach(i => { i.value = ""; i.classList.remove("filled", "error"); });
  otpError.textContent = "";
  otpSuccess.textContent = "";
});

// ===================== GOOGLE SIGNUP =====================
document.getElementById("googleSignupBtn").addEventListener("click", () => {
  const client = google.accounts.oauth2.initTokenClient({
    client_id: "YOUR_GOOGLE_CLIENT_ID",
    scope: "email profile",
    callback: async (response) => {
      try {
        const userInfo = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${response.access_token}` }
        }).then(r => r.json());

        const res = await fetch("/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture
          })
        });
        const data = await res.json();
        if(data.success) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("userEmail", data.email);
          if(data.picture) localStorage.setItem("userPicture", data.picture);
          window.location.href = "/";
        } else {
          signupError.textContent = data.message;
        }
      } catch(err) {
        signupError.textContent = "Google signup failed. Try again.";
      }
    }
  });
  client.requestAccessToken();
});