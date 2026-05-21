const form = document.querySelector("form");

const emailError = document.querySelector(
  ".email-error"
);

const passwordError = document.querySelector(
  ".password-error"
);


form.addEventListener("submit", async (e) => {

  e.preventDefault();

  // CLEAR OLD ERRORS

  emailError.textContent = "";

  passwordError.textContent = "";


  const email = document.querySelector(
    'input[type="email"]'
  ).value;

  const password = document.querySelector(
    'input[type="password"]'
  ).value;


  // EMPTY CHECK

  if (email === "") {

    emailError.textContent =
      "Please enter email";

    return;

  }

  if (password === "") {

    passwordError.textContent =
      "Please enter password";

    return;

  }


  // LOGIN REQUEST

  const response = await fetch("/login", {

    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      email,
      password
    })

  });

  const data = await response.json();


  // SUCCESS

  if (data.success) {

    localStorage.setItem(
      "token",
      data.token
    );

    localStorage.setItem(
      "userEmail",
      email
    );

    window.location.href = "/";

  }

  // ERRORS

  else {

    if (data.message === "User not found") {

      emailError.textContent =
        "Email does not exist";

    }

    else if (
      data.message === "Wrong password"
    ) {

      passwordError.textContent =
        "Incorrect password";

    }

    else {

      passwordError.textContent =
        data.message;

    }

  }

});
// GOOGLE LOGIN
const googleLoginBtn = document.getElementById("googleLoginBtn");

googleLoginBtn.addEventListener("click", () => {
  const client = google.accounts.oauth2.initTokenClient({
    client_id: "418590490619-l51bn8htii8la7r332kch0dm52ktfo2o.apps.googleusercontent.com",
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
        if (data.success) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("userEmail", data.email);
          if (data.picture) localStorage.setItem("userPicture", data.picture);
          window.location.href = "/";
        } else {
          alert(data.message);
        }
      } catch (err) {
        alert("Google login failed. Please try again.");
      }
    }
  });
  client.requestAccessToken();
});