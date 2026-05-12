// GET PARAMS
const params = new URLSearchParams(window.location.search);
const code = params.get("code");
const eventName = params.get("name");

// SET CODE IN SIDEBAR
document.getElementById("sidebarCode").textContent = `#${code}`;

// LOAD QR
const qrScript = document.createElement("script");
qrScript.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
qrScript.onload = () => {
  new QRCode(document.getElementById("sidebarQR"), {
    text: `${window.location.origin}/join.html?code=${code}`,
    width: 160,
    height: 160,
    colorDark: "#000000",
    colorLight: "#ffffff",
  });
};
document.head.appendChild(qrScript);

// VIEW STATE
let currentView = "qa";
let activePollId = null;
let lastKnownPollId = null;
const likedQuestions = new Set();

// ELEMENTS
const questionsList = document.getElementById("questionsList");
const questionCount = document.getElementById("questionCount");
const pollView = document.getElementById("pollView");
const pollViewEmpty = document.getElementById("pollViewEmpty");
const pollViewContent = document.getElementById("pollViewContent");
const pollViewQuestion = document.getElementById("pollViewQuestion");
const pollViewBars = document.getElementById("pollViewBars");
const pollViewTotal = document.getElementById("pollViewTotal");
const toggleViewBtn = document.getElementById("toggleViewBtn");
const showingText = document.getElementById("showingText");
const viewBadge = document.getElementById("viewBadge");
const participantCount = document.getElementById("participantCount");

// SWITCH TO POLL VIEW
function switchToPoll() {
  currentView = "poll";
  questionsList.style.display = "none";
  pollView.style.display = "flex";
  toggleViewBtn.textContent = "Q&A";
  toggleViewBtn.classList.add("poll-active");
  showingText.textContent = "Showing Poll";
  viewBadge.textContent = "POLL";
  loadActivePoll();
}

// SWITCH TO Q&A VIEW
function switchToQA() {
  currentView = "qa";
  pollView.style.display = "none";
  questionsList.style.display = "flex";
  toggleViewBtn.textContent = "+";
  toggleViewBtn.classList.remove("poll-active");
  showingText.textContent = "Showing Q&A";
  viewBadge.textContent = "Q&A";
  loadQuestions();
}

// TOGGLE VIEW BUTTON
toggleViewBtn.addEventListener("click", () => {
  if (currentView === "qa") switchToPoll();
  else switchToQA();
});

// CHECK IF POLL ACTIVATED BY ORGANIZER
async function checkForActivePoll() {
  try {
    const res = await fetch(`/polls/${code}`);
    const data = await res.json();
    if (!data.success || !data.polls) return;

    const activePoll = data.polls.find(p => p.active == 1);

    if (activePoll && activePoll.id !== lastKnownPollId) {
      // NEW POLL ACTIVATED — AUTO SWITCH TO POLL VIEW
      lastKnownPollId = activePoll.id;
      if (currentView !== "poll") switchToPoll();
    }

    if (!activePoll && lastKnownPollId !== null) {
      // POLL DEACTIVATED — AUTO SWITCH BACK TO Q&A
      lastKnownPollId = null;
      if (currentView !== "qa") switchToQA();
    }

  } catch (err) {
    console.error(err);
  }
}

// LOAD QUESTIONS
async function loadQuestions() {
  if(currentView !== "qa") return;
  try {
    const res = await fetch(`/questions/${code}`);
    const data = await res.json();

    if(!data.success || data.questions.length === 0) {
      questionsList.innerHTML = `<div class="empty-state">No questions yet. Waiting for audience...</div>`;
      questionCount.textContent = "0";
      participantCount.textContent = "👤 0";
      return;
    }

    const questions = data.questions;
    questionCount.textContent = questions.length;

    // UNIQUE PARTICIPANTS
    const uniqueAuthors = new Set(questions.map(q => q.author || "Anonymous"));
    participantCount.textContent = `👤 ${uniqueAuthors.size}`;

    questionsList.innerHTML = "";

    questions.forEach(q => {
      const isLiked = likedQuestions.has(q.id);
      const isPrioritized = q.priority == 1;
      const card = document.createElement("div");
      card.className = `question-card ${isPrioritized ? "prioritized" : ""}`;
      card.innerHTML = `
        <div class="card-top">
          <div class="author">
            <div class="author-icon">&#128100;</div>
            <span class="author-name">${q.author || "Anonymous"}</span>
          </div>
          <button class="like-btn ${isLiked ? "liked" : ""}" data-id="${q.id}">
            ${q.likes} &#128077;
          </button>
        </div>
        <p class="question-text">${q.question}</p>
        <div class="question-actions">
          <button class="q-action-btn q-prioritize-btn" data-id="${q.id}" title="Prioritize">
            &#8679;
          </button>
          <button class="q-action-btn q-answer-btn" data-id="${q.id}" title="Mark as answered">
            &#10003;
          </button>
        </div>
      `;

      // LIKE
      card.querySelector(".like-btn").addEventListener("click", async (e) => {
        const id = Number(e.currentTarget.dataset.id);
        if(likedQuestions.has(id)) return;
        likedQuestions.add(id);
        await fetch(`/questions/${id}/like`, { method: "POST" });
        loadQuestions();
      });

      // PRIORITIZE
      card.querySelector(".q-prioritize-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        await fetch(`/questions/${id}/prioritize`, { method: "POST" });
        loadQuestions();
      });

      // MARK AS ANSWERED
      card.querySelector(".q-answer-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        // FADE OUT THEN REMOVE
        card.style.transition = "opacity 0.4s ease";
        card.style.opacity = "0";
        setTimeout(async () => {
          await fetch(`/questions/${id}/answer`, { method: "POST" });
          loadQuestions();
        }, 400);
      });

      questionsList.appendChild(card);
    });

  } catch(err) {
    console.error(err);
  }
}

function renderPollResults(type, options, votes, total, container) {
  container.innerHTML = "";

  if(type === "multiple") {
    options.forEach(opt => {
      const count = votes[opt] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const row = document.createElement("div");
      row.className = "poll-view-bar-row";
      row.innerHTML = `
        <div class="poll-view-bar-label">
          <span>${opt}</span>
          <span>${pct}% (${count})</span>
        </div>
        <div class="poll-view-bar-track">
          <div class="poll-view-bar-fill" style="width:${pct}%"></div>
        </div>
      `;
      container.appendChild(row);
    });

  } else if(type === "wordcloud") {
    const cloud = document.createElement("div");
    cloud.className = "pv-word-cloud";
    const maxCount = Math.max(...Object.values(votes), 1);
    if(Object.keys(votes).length === 0) {
      cloud.innerHTML = `<p style="color:#64748b">No responses yet...</p>`;
    } else {
      const entries = Object.entries(votes).sort(() => Math.random() - 0.5);
      entries.forEach(([word, count]) => {
        const size = 16 + Math.round((count / maxCount) * 28);
        const item = document.createElement("span");
        item.className = "pv-word-cloud-item";
        item.style.fontSize = `${size}px`;
        item.style.opacity = String(0.5 + (count / maxCount) * 0.5);
        if(count === maxCount) {
          item.style.background = "rgba(56,189,248,0.3)";
          item.style.color = "#38bdf8";
        }
        item.textContent = word;
        cloud.appendChild(item);
      });
    }
    container.appendChild(cloud);

  } else if(type === "rating") {
    const max = Number(options[0]) || 5;
    const chart = document.createElement("div");
    chart.className = "pv-rating-chart";
    const maxCount = Math.max(...Array.from({length: max}, (_, i) => votes[String(i+1)] || 0), 1);

    for(let i = 1; i <= max; i++) {
      const count = votes[String(i)] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const heightPct = Math.round((count / maxCount) * 100);
      const isHighest = count === maxCount && count > 0;
      const col = document.createElement("div");
      col.className = "pv-rating-col";
      col.innerHTML = `
        <span class="pv-rating-pct-label">${pct > 0 ? pct + "%" : ""}</span>
        <div class="pv-rating-bar ${isHighest ? "highest" : ""}"
          style="height:${heightPct}%"></div>
        <span class="pv-rating-num">${i}</span>
      `;
      chart.appendChild(col);
    }
    container.appendChild(chart);

  } else if(type === "opentext") {
    const list = document.createElement("div");
    list.className = "pv-open-text-list";
    const entries = Object.keys(votes);
    if(entries.length === 0) {
      list.innerHTML = `<p style="color:#64748b;font-size:16px;">No responses yet...</p>`;
    } else {
      entries.forEach(ans => {
        const item = document.createElement("div");
        item.className = "pv-open-text-item";
        item.textContent = ans;
        list.appendChild(item);
      });
    }
    container.appendChild(list);
  }
}// LOAD ACTIVE POLL
async function loadActivePoll() {
  if (currentView !== "poll") return;
  try {
    const res = await fetch(`/polls/${code}`);
    const data = await res.json();

    if (!data.success || !data.polls) {
      pollViewEmpty.style.display = "flex";
      pollViewContent.style.display = "none";
      participantCount.textContent = "👤 0";
      return;
    }

    const activePoll = data.polls.find(p => p.active == 1);

    if (!activePoll) {
      pollViewEmpty.style.display = "flex";
      pollViewContent.style.display = "none";
      activePollId = null;
      participantCount.textContent = "👤 0";
      return;
    }

    activePollId = activePoll.id;
    pollViewEmpty.style.display = "none";
    pollViewContent.style.display = "flex";

    const options = JSON.parse(activePoll.options || "[]");
    const votes = JSON.parse(activePoll.votes || "{}");
    const total = Object.values(votes).reduce((a, b) => a + b, 0);

    pollViewQuestion.textContent = activePoll.question;
    pollViewTotal.textContent = total;

    // PARTICIPANT COUNT = TOTAL VOTES
    participantCount.textContent = `👤 ${total}`;

    pollViewBars.innerHTML = "";
    renderPollResults(activePoll.type, options, votes, total, pollViewBars);

  } catch (err) {
    console.error(err);
  }
}

// AUTO REFRESH EVERY 2 SECONDS
setInterval(() => {
  checkForActivePoll();
  if (currentView === "qa") loadQuestions();
  else loadActivePoll();
}, 2000);

// LOAD ON START
checkForActivePoll();
loadQuestions();

// FULLSCREEN
document.getElementById("fullscreenBtn").addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});