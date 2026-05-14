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
  window.location.href = "join_session.html";
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
    document.getElementById("demoModal").classList.remove("hidden");
    startDemo();
  });
}
document.getElementById("demoModalClose").addEventListener("click", () => {
  document.getElementById("demoModal").classList.add("hidden");
  stopDemo();
});
document.getElementById("demoModal").addEventListener("click", (e) => {
  if(e.target === document.getElementById("demoModal")) {
    document.getElementById("demoModal").classList.add("hidden");
    stopDemo();
  }
});

// TRY IT YOURSELF BUTTON
document.getElementById("demoTryBtn").addEventListener("click", () => {
  document.getElementById("demoModal").classList.add("hidden");
  stopDemo();
  window.location.href = "join_session.html";
});

// DEMO LOGIC
let demoInterval = null;
let currentDemoStep = 1;

const stepTitles = [
  "Step 1: Join a Session",
  "Step 2: Ask a Question",
  "Step 3: Vote on a Poll",
  "Step 4: Like a Question"
];
const stepDescs = [
  "Enter a session code to join any live event instantly — no signup needed!",
  "Type your question and send it live to the organizer and all participants.",
  "Vote on polls created by the organizer and see live results instantly.",
  "Upvote the best questions so the most important ones rise to the top!"
];

function startDemo() {
  currentDemoStep = 1;
  showDemoStep(1);
  demoInterval = setInterval(() => {
    currentDemoStep = currentDemoStep >= 4 ? 1 : currentDemoStep + 1;
    showDemoStep(currentDemoStep);
  }, 3500);
}

function stopDemo() {
  if(demoInterval) {
    clearInterval(demoInterval);
    demoInterval = null;
  }
}

function showDemoStep(step) {
  // UPDATE STEP CONTENT
  document.getElementById("demoStepTitle").textContent = stepTitles[step - 1];
  document.getElementById("demoStepDesc").textContent = stepDescs[step - 1];

  // UPDATE DOTS
  document.querySelectorAll(".demo-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === step - 1);
  });

  // ANIMATE PHONE STEPS
  document.querySelectorAll(".demo-step").forEach((s, i) => {
    s.classList.remove("active", "exit");
    if(i === step - 1) {
      s.classList.add("active");
    } else if(i < step - 1) {
      s.classList.add("exit");
    }
  });

  // STEP SPECIFIC ANIMATIONS
  if(step === 1) animateTyping("demoTyping", "DEMO123");
  if(step === 2) animateTyping("demoAskTyping", "How does this work?");
  if(step === 3) animatePollSelect();
  if(step === 4) animateLike();
}

function animateTyping(elId, text) {
  const el = document.getElementById(elId);
  if(!el) return;
  el.textContent = "";
  let i = 0;
  const t = setInterval(() => {
    if(i < text.length) {
      el.textContent += text[i];
      i++;
    } else {
      clearInterval(t);
    }
  }, 100);
}

function animatePollSelect() {
  const opts = ["demoPollOpt1", "demoPollOpt2", "demoPollOpt3"];
  opts.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.classList.remove("selected");
  });
  setTimeout(() => {
    const el = document.getElementById("demoPollOpt1");
    if(el) el.classList.add("selected");
    const btn = document.querySelector(".demo-btn-inactive");
    if(btn) btn.classList.add("demo-btn-active");
  }, 1200);
}

function animateLike() {
  const likes = document.getElementById("demoLikes");
  if(!likes) return;
  likes.textContent = "0 👍";
  likes.classList.remove("liked");
  setTimeout(() => {
    likes.textContent = "1 👍";
    likes.classList.add("liked");
  }, 1500);
}


// START FREE

if(startBtn) {
  startBtn.addEventListener("click", () => {
    window.location.href = "signup.html"; 
  });
}


