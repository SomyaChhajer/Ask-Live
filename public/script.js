// NAVBAR BUTTONS

const loginBtn = document.querySelector(
  ".login-btn"
);

const joinBtn = document.querySelector(
  ".join-btn"
);


// PROFILE ELEMENTS

const profileContainer = document.querySelector(
  ".profile-container"
);

const profileIcon = document.querySelector(
  ".profile-icon"
);

const profileDropdown = document.querySelector(
  ".profile-dropdown"
);

const profileEmail = document.querySelector(
  ".profile-email"
);

const logoutBtn = document.querySelector(
  ".logout-btn"
);


// CHECK LOGIN

const token = localStorage.getItem(
  "token"
);

const userEmail = localStorage.getItem(
  "userEmail"
);


// IF USER LOGGED IN

if(token && userEmail){

  // HIDE LOGIN BUTTON

  loginBtn.style.display = "none";

  // SHOW PROFILE

  profileContainer.classList.remove(
    "hidden"
  );

  // USER EMAIL

  profileEmail.textContent = userEmail;

  // PROFILE LETTER

  const initial = userEmail
    .charAt(0)
    .toUpperCase();

  profileIcon.textContent = initial;

}


// LOGIN BUTTON

loginBtn.addEventListener("click", () => {

  window.location.href = "login.html";

});


// JOIN BUTTON
// JOIN BUTTON
joinBtn.addEventListener("click", () => {
  if(token && userEmail) {
    // LOGGED IN → GO TO JOIN SESSION PAGE
    window.location.href = "join_session.html";
  } else {
    // NOT LOGGED IN → GO TO SIGNUP
    window.location.href = "signup.html?from=join";
  }
});


// PROFILE DROPDOWN

profileIcon.addEventListener("click", () => {

  profileDropdown.classList.toggle(
    "active"
  );

});


// OUTSIDE CLICK

window.addEventListener("click", (e) => {

  if(
    !profileContainer.contains(e.target)
  ){

    profileDropdown.classList.remove(
      "active"
    );

  }

});


// LOGOUT

logoutBtn.addEventListener("click", () => {

  localStorage.removeItem("token");

  localStorage.removeItem("userEmail");

  window.location.reload();

});


// HERO BUTTONS

// HERO BUTTONS

const startBtn = document.querySelector(
  ".primary-btn"
);

const createSessionBtn = document.querySelector(
  ".create-session-btn"
);

const demoBtn = document.querySelector(
  ".secondary-btn"
);


// USER LOGGED IN

if(token && userEmail){

  // SHOW CREATE SESSION

  createSessionBtn.classList.remove(
    "hidden"
  );

  // HIDE START FREE

  startBtn.classList.add("hidden");

}

// CREATE SESSION

if(createSessionBtn){

  createSessionBtn.addEventListener(
    "click",
    () => {

      window.location.href = "create_session.html";

    }
  );

}


// WATCH DEMO

if(demoBtn){

  demoBtn.addEventListener("click", () => {

    alert("Demo Coming Soon!");

  });

}

// START FREE

if(startBtn) {
  startBtn.addEventListener("click", () => {
    window.location.href = "signup.html"; 
  });
}


