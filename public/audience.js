// GET PARAMS
const params = new URLSearchParams(window.location.search);
const code = params.get("code");

// SET SESSION TITLE
document.getElementById("sessionTitle").textContent = `#${code}`;
const votedPolls = new Set(
  JSON.parse(localStorage.getItem("votedPolls") || "[]")
);
// FETCH EVENT NAME
async function loadEventName() {
  try {
    const res = await fetch(`/events/code/${code}`);
    const data = await res.json();
    if (data.success) {
      document.getElementById("sessionTitle").textContent = data.event.name;
    }
  } catch (err) {
    console.error(err);
  }
}
loadEventName();

// TABS
const tabQA = document.getElementById("tabQA");
const tabPolls = document.getElementById("tabPolls");
const qaSection = document.getElementById("qaSection");
const pollsSection = document.getElementById("pollsSection");
// SET INITIAL DISPLAY
qaSection.style.display = "flex";
pollsSection.style.display = "none";
pollsSection.classList.remove("hidden");

tabQA.addEventListener("click", () => {
  tabQA.classList.add("active");
  tabPolls.classList.remove("active");
  qaSection.style.display = "flex";
  pollsSection.style.display = "none";
});
tabPolls.addEventListener("click", () => {
  tabPolls.classList.add("active");
  tabQA.classList.remove("active");
  pollsSection.style.display = "flex";
  qaSection.style.display = "none";
  loadPolls();
});

// ASK BOX EXPAND
const questionInput = document.getElementById("questionInput");
const askExpanded = document.getElementById("askExpanded");
const cancelAsk = document.getElementById("cancelAsk");
const submitAsk = document.getElementById("submitAsk");

questionInput.addEventListener("click", () => {
  askExpanded.classList.remove("hidden");
  questionInput.style.cursor = "text";
});

cancelAsk.addEventListener("click", () => {
  askExpanded.classList.add("hidden");
  questionInput.value = "";
  document.getElementById("nameInput").value = "";
});

// SUBMIT QUESTION
submitAsk.addEventListener("click", async () => {
  const question = questionInput.value.trim();
  const name = document.getElementById("nameInput").value.trim();
  if (!question) {
    questionInput.focus();
    return;
  }
  try {
    // CHECK IF MODERATION IS ON
    const modRes = await fetch(`/events/moderation/${code}`);
    const modData = await modRes.json();
    const isPending = modData.moderation ? 1 : 0;

    const res = await fetch("/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_code: code,
        author: name || "Anonymous",
        question,
        pending: isPending
      })
    });
    const data = await res.json();
    if (data.success) {
      questionInput.value = "";
      document.getElementById("nameInput").value = "";
      askExpanded.classList.add("hidden");
      if(isPending) {
        // SHOW PENDING MESSAGE
        const msg = document.createElement("div");
        msg.className = "question-card";
        msg.style.borderColor = "#f59e0b";
        msg.innerHTML = `
          <p style="color:#f59e0b;font-size:13px;">&#9203; Your question is waiting for approval</p>
          <p class="question-text">${question}</p>
        `;
        questionsList.prepend(msg);
        setTimeout(() => msg.remove(), 5000);
      } else {
        loadQuestions(currentFilter);
      }
    }
  } catch (err) {
    console.error(err);
  }
});

// FILTER
let currentFilter = "popular";
const filterPopular = document.getElementById("filterPopular");
const filterRecent = document.getElementById("filterRecent");

filterPopular.addEventListener("click", () => {
  currentFilter = "popular";
  filterPopular.classList.add("active");
  filterRecent.classList.remove("active");
  loadQuestions("popular");
});

filterRecent.addEventListener("click", () => {
  currentFilter = "recent";
  filterRecent.classList.add("active");
  filterPopular.classList.remove("active");
  loadQuestions("recent");
});

// LIKED QUESTIONS
const likedQuestions = new Set();

// FORMAT TIME
function formatTime(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date)) return "Just now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// LOAD QUESTIONS
const questionsList = document.getElementById("questionsList");
const questionCount = document.getElementById("questionCount");

async function loadQuestions(filter = "popular") {
  try {
    const res = await fetch(`/questions/${code}`);
    const data = await res.json();

    if (!data.success || data.questions.length === 0) {
      questionsList.innerHTML = `<div class="empty-state">No questions yet. Be the first to ask!</div>`;
      questionCount.textContent = "0 questions";
      return;
    }

    let questions = data.questions;

    // SORT
    if (filter === "recent") {
      questions = questions.sort((a, b) => b.id - a.id);
    } else {
      questions = questions.sort((a, b) => b.likes - a.likes);
    }

    questionCount.textContent = `${questions.length} question${questions.length !== 1 ? "s" : ""}`;
    questionsList.innerHTML = "";

    questions.forEach(q => {
      const isLiked = likedQuestions.has(q.id);
      const card = document.createElement("div");
      card.className = "question-card";
      card.innerHTML = `
        <div class="card-top">
          <div class="author">
            <div class="author-icon">&#128100;</div>
            <div class="author-info">
              <span class="author-name">${q.author || "Anonymous"}</span>
              <span class="author-time">Just now</span>
            </div>
          </div>
          <button class="like-btn ${isLiked ? "liked" : ""}" data-id="${q.id}">
            ${q.likes} &#128077;
          </button>
        </div>
        <p class="question-text">${q.question}</p>
      `;

      // LIKE
      card.querySelector(".like-btn").addEventListener("click", async (e) => {
        const id = Number(e.currentTarget.dataset.id);
        if (likedQuestions.has(id)) return;
        likedQuestions.add(id);
        await fetch(`/questions/${id}/like`, { method: "POST" });
        loadQuestions(currentFilter);
      });

      questionsList.appendChild(card);
    });

  } catch (err) {
    console.error(err);
  }
}

// PROFILE
const userEmail = localStorage.getItem("userEmail");
const token = localStorage.getItem("token");
const profileIcon = document.getElementById("profileIcon");
const profileDropdown = document.getElementById("profileDropdown");
const profileEmailEl = document.getElementById("profileEmail");
const logoutBtn = document.getElementById("logoutBtn");

if (userEmail) {
  // SHOW INITIAL
  profileIcon.textContent = userEmail.charAt(0).toUpperCase();
  profileEmailEl.textContent = userEmail;
} else {
  profileIcon.textContent = "?";
  profileEmailEl.textContent = "Guest";
}

// TOGGLE DROPDOWN
profileIcon.addEventListener("click", () => {
  profileDropdown.classList.toggle("active");
});

// CLOSE ON OUTSIDE CLICK
window.addEventListener("click", (e) => {
  if (!document.querySelector(".profile-container").contains(e.target)) {
    profileDropdown.classList.remove("active");
  }
});

// LOGOUT
logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("userEmail");
  window.location.href = "index.html";
});
// LOAD ON START + AUTO REFRESH EVERY 5 SECONDS
loadQuestions(currentFilter);
setInterval(() => loadQuestions(currentFilter), 5000);

// LOAD POLLS
async function loadPolls() {
  try {
    const res = await fetch(`/polls/${code}`);
    const data = await res.json();

    if (!data.success || !data.polls) {
      pollsSection.innerHTML = `
    <div class="empty-state polls-empty">
      <p class="empty-icon">&#128202;</p>
      <p class="empty-title">No active polls</p>
      <p class="empty-desc">The organizer hasn't activated any polls yet. Check back soon!</p>
    </div>
  `;
      return;
    }
    const activePolls = data.polls.filter(p => p.active == 1);
    if (!data.success || activePolls.length === 0) {
      pollsSection.innerHTML = `
    <div class="empty-state polls-empty">
      <p class="empty-icon">&#128202;</p>
      <p class="empty-title">No active polls</p>
      <p class="empty-desc">The organizer hasn't activated any polls yet. Check back soon!</p>
    </div>
  `;
      return;
    }
    pollsSection.innerHTML = "";

    activePolls.forEach(poll => {
      const options = JSON.parse(poll.options || "[]");
      const card = document.createElement("div");
      card.className = "audience-poll-card";

      let optionsHTML = "";

      if (poll.type === "multiple") {
        optionsHTML = options.map((opt, i) => `
          <label class="poll-option">
            <input type="radio" name="poll_${poll.id}" value="${opt}">
            <span>${opt}</span>
          </label>
        `).join("");

      } else if (poll.type === "rating") {
        const max = options[0] || 5;
        optionsHTML = `
          <div class="rating-options">
            ${Array.from({ length: Number(max) }, (_, i) => `
              <button class="rating-star" data-val="${i + 1}" data-poll="${poll.id}">
                ${i + 1}
              </button>
            `).join("")}
          </div>
        `;

      } else if (poll.type === "wordcloud" || poll.type === "opentext") {
        optionsHTML = `
          <input type="text" class="poll-text-input" id="pollText_${poll.id}"
            placeholder="${poll.type === "wordcloud" ? "Type a word..." : "Type your answer..."}">
        `;
      }

      card.innerHTML = `
        <div class="audience-poll-type">${{
          multiple: "Multiple Choice", wordcloud: "Word Cloud",
          rating: "Rating", opentext: "Open Text"
        }[poll.type]
        }</div>
        <p class="audience-poll-question">${poll.question}</p>
        <div class="audience-poll-options">${optionsHTML}</div>
        <button class="submit-poll-btn" data-id="${poll.id}" data-type="${poll.type}">
          Submit Answer
        </button>
        <p class="poll-success hidden" id="pollSuccess_${poll.id}">
          ✅ Answer submitted!
        </p>
      `;

      pollsSection.appendChild(card);
      // DISABLE IF ALREADY VOTED
      if (votedPolls.has(String(poll.id))) {
        const btn = card.querySelector(".submit-poll-btn");
        btn.style.display = "none";
        document.getElementById(`pollSuccess_${poll.id}`).textContent = "✅ You already voted!";
        document.getElementById(`pollSuccess_${poll.id}`).classList.remove("hidden");
      }
    });

    // SUBMIT HANDLERS
    // Replace the submit handler inside loadPolls in audience.js
    document.querySelectorAll(".submit-poll-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const type = btn.dataset.type;

        // CHECK IF ALREADY VOTED
        if (votedPolls.has(id)) {
          btn.textContent = "Already voted!";
          btn.style.opacity = "0.5";
          return;
        }

        let answer = "";
        if (type === "multiple") {
          const selected = document.querySelector(`input[name="poll_${id}"]:checked`);
          if (!selected) return;
          answer = selected.value;
        } else if (type === "rating") {
          const active = document.querySelector(`.rating-star.active[data-poll="${id}"]`);
          if (!active) return;
          answer = active.dataset.val;
        } else {
          answer = document.getElementById(`pollText_${id}`).value.trim();
          if (!answer) return;
        }

        // SUBMIT VOTE
        await fetch(`/polls/${id}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer })
        });

        // SAVE VOTED POLL
        votedPolls.add(id);
        localStorage.setItem("votedPolls", JSON.stringify([...votedPolls]));

        btn.style.display = "none";
        document.getElementById(`pollSuccess_${id}`).classList.remove("hidden");
      });
    });

    // RATING STAR CLICK
    document.querySelectorAll(".rating-star").forEach(star => {
      star.addEventListener("click", () => {
        const pollId = star.dataset.poll;
        document.querySelectorAll(`.rating-star[data-poll="${pollId}"]`).forEach(s => {
          s.classList.remove("active");
          if (Number(s.dataset.val) <= Number(star.dataset.val)) {
            s.classList.add("active");
          }
        });
      });
    });

  } catch (err) {
    console.error(err);
  }
}
// AUTO REFRESH POLLS EVERY 5 SECONDS
setInterval(() => {
  if(pollsSection.style.display !== "none") {
    loadPolls();
  }
}, 5000);