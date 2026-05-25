// GET EVENT DATA FROM URL
const params = new URLSearchParams(window.location.search);
const name = params.get("name");
const code = params.get("code");
const start = params.get("start");
const end = params.get("end");
const qrScript = document.createElement("script");
qrScript.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
qrScript.onload = () => { }; // ready when needed
document.head.appendChild(qrScript);

// SET TOP BAR
document.getElementById("eventTitle").textContent = name || "Event";
document.getElementById("eventDates").textContent = `${start || ""} - ${end || ""}`;
document.getElementById("eventCode").textContent = `#${code || ""}`;
document.getElementById("qaCode").textContent = `#${code || ""}`;

// PROFILE ICON
const userEmail = localStorage.getItem("userEmail");
if (userEmail) {
  document.getElementById("profileIcon").textContent = userEmail.charAt(0).toUpperCase();
}

// TABS
const tabs = document.querySelectorAll(".tab");
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
  });
});

// MODERATION TOGGLE
const moderationToggle = document.getElementById("moderationToggle");
const moderationBtn = document.getElementById("moderationBtn");
const leftPanelBody = document.getElementById("leftPanelBody");

let moderationOn = false;

moderationToggle.addEventListener("change", async () => {
  moderationOn = moderationToggle.checked;
  if (moderationOn) {
    leftPanelBody.innerHTML = `
      <div class="panel-empty">
        <p class="panel-empty-title">Moderation turned on</p>
        <p class="panel-empty-desc">Questions need your approval before going live.</p>
      </div>
      <div class="pending-questions-list" id="pendingList"></div>
    `;
    loadPendingQuestions();
  }  else {
    leftPanelBody.innerHTML = `
      <div class="panel-empty">
        <p class="panel-empty-title">Moderation turned off</p>
        <p class="panel-empty-desc">Audience questions automatically appear live, visible to everyone.</p>
      </div>
    `;
  }
  // SYNC WITH SERVER
  await fetch(`/events/moderation/${code}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: moderationToggle.checked })
  });
});

// LOAD PENDING QUESTIONS
async function loadPendingQuestions() {
  if (!moderationOn) return;
  try {
    const res = await fetch(`/questions/${code}/pending`);
    const data = await res.json();
    const list = document.getElementById("pendingList");
    if (!list) return;

    if (!data.questions || data.questions.length === 0) {
      list.innerHTML = `<p class="empty-state-small">No questions waiting for review</p>`;
      return;
    }

    list.innerHTML = "";
    data.questions.forEach(q => {
      const item = document.createElement("div");
      item.className = "pending-q-card";
      item.innerHTML = `
        <div class="pending-q-author">&#128100; ${q.author || "Anonymous"}</div>
        <p class="pending-q-text">${q.question}</p>
        <div class="pending-q-actions">
          <button class="approve-btn" data-id="${q.id}">&#10003; Approve</button>
          <button class="reject-btn" data-id="${q.id}">&#10005; Reject</button>
        </div>
      `;

      // APPROVE
      item.querySelector(".approve-btn").addEventListener("click", async (e) => {
        const id = e.currentTarget.dataset.id;
        await fetch(`/questions/${id}/approve`, { method: "POST" });
        loadPendingQuestions();
        loadLiveQuestions();
      });

      // REJECT
      item.querySelector(".reject-btn").addEventListener("click", async (e) => {
        const id = e.currentTarget.dataset.id;
        await fetch(`/questions/${id}/reject`, { method: "POST" });
        loadPendingQuestions();
      });

      list.appendChild(item);
    });
  } catch (err) {
    console.error(err);
  }
}

// AUTO REFRESH PENDING EVERY 5 SECONDS
setInterval(() => {
  if (moderationOn) loadPendingQuestions();
}, 5000);
// SHARE MODAL
const shareModal = document.getElementById("shareModal");
const closeShareModal = document.getElementById("closeShareModal");
const shareUrlEl = document.getElementById("shareUrl");
const copyBtn = document.getElementById("copyBtn");
const downloadQR = document.getElementById("downloadQR");

// BUILD JOIN URL
const joinUrl = `${window.location.origin}/join.html?code=${code}`;
shareUrlEl.textContent = joinUrl;

// OPEN SHARE MODAL — attach to all share buttons
document.querySelectorAll(".share-btn, .qa-btn.solid").forEach(btn => {
  btn.addEventListener("click", () => {
    shareModal.classList.remove("hidden");
    setTimeout(() => generateQR(), 300); // wait for library to load
  });
});

// GENERATE QR
function generateQR() {
  const canvas = document.getElementById("qrCanvas");
  canvas.innerHTML = "";
  new QRCode(canvas, {
    text: joinUrl,
    width: 180,
    height: 180,
    colorDark: "#000000",
    colorLight: "#ffffff",
  });
}



// CLOSE MODAL
closeShareModal.addEventListener("click", () => {
  shareModal.classList.add("hidden");
});

// CLOSE ON OUTSIDE CLICK
shareModal.addEventListener("click", (e) => {
  if (e.target === shareModal) shareModal.classList.add("hidden");
});

// COPY URL
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(joinUrl);
  copyBtn.textContent = "Copied!";
  setTimeout(() => copyBtn.textContent = "Copy", 2000);
});

// DOWNLOAD QR
downloadQR.addEventListener("click", () => {
  const img = document.querySelector("#qrCanvas img");
  if (!img) return;
  const link = document.createElement("a");
  link.download = `asklive-${code}-qr.png`;
  link.href = img.src;
  link.click();
});

// PRESENT MODE BUTTON
document.getElementById("presentBtn").addEventListener("click", () => {
  window.location.href = `present.html?code=${code}&name=${encodeURIComponent(name)}`;
});
// LIVE QUESTIONS IN RIGHT PANEL
async function loadLiveQuestions() {
  try {
    const res = await fetch(`/questions/${code}`);
    const data = await res.json();
    const list = document.getElementById("liveQuestionsList");
    const liveCount = document.getElementById("liveCount");
    const liveHeader = document.querySelector(".live-questions-header");

    if (!data.success || data.questions.length === 0) {
      // SHOW TOP SECTION + HIDE QUESTIONS AREA
      document.querySelector(".right-panel-top").style.display = "flex";
      liveHeader.style.display = "none";
      list.style.display = "none";
      liveCount.textContent = "0";
      return;
    }

    // HIDE TOP SECTION + SHOW QUESTIONS AREA
    document.querySelector(".right-panel-top").style.display = "none";
    liveHeader.style.display = "flex";
    list.style.display = "flex";

    const questions = data.questions.sort((a, b) => b.likes - a.likes);
    liveCount.textContent = questions.length;
    list.innerHTML = "";

    questions.forEach(q => {
      const card = document.createElement("div");
      card.className = "live-q-card";
      card.innerHTML = `
        <div class="live-q-top">
          <div class="live-q-author">
            <div class="live-q-author-icon">&#128100;</div>
            ${q.author || "Anonymous"}
          </div>
          <span class="live-q-likes">${q.likes} &#128077;</span>
        </div>
        <p class="live-q-text">${q.question}</p>
      `;
      list.appendChild(card);
    });

  } catch (err) {
    console.error(err);
  }
}

// LOAD + AUTO REFRESH EVERY 5 SECONDS
loadLiveQuestions();
setInterval(loadLiveQuestions, 5000);

// POLLS TAB SWITCH
const tabQA = document.getElementById("tabQA");
const tabPolls = document.getElementById("tabPolls");
const qaContent = document.getElementById("qaContent");
const pollsContent = document.getElementById("pollsContent");

tabQA.addEventListener("click", () => {
  tabQA.classList.add("active");
  tabPolls.classList.remove("active");
  qaContent.style.display = "flex";
  pollsContent.style.display = "none";
});

tabPolls.addEventListener("click", () => {
  tabPolls.classList.add("active");
  tabQA.classList.remove("active");
  pollsContent.style.display = "flex";
  qaContent.style.display = "none";
  loadPolls();
});

// POLL MODAL
const pollModal = document.getElementById("pollModal");
const closePollModal = document.getElementById("closePollModal");
const cancelPollModal = document.getElementById("cancelPollModal");
const pollModalTitle = document.getElementById("pollModalTitle");
const pollQuestion = document.getElementById("pollQuestion");
const pollError = document.getElementById("pollError");
const multipleChoiceFields = document.getElementById("multipleChoiceFields");
const ratingFields = document.getElementById("ratingFields");
const ratingScale = document.getElementById("ratingScale");
const ratingScaleVal = document.getElementById("ratingScaleVal");

let currentPollType = "";

// OPEN MODAL ON POLL TYPE CLICK
document.querySelectorAll(".poll-type-card").forEach(card => {
  card.addEventListener("click", (e) => {
    e.stopPropagation();
    currentPollType = card.dataset.type;
    pollQuestion.value = "";
    pollError.textContent = "";
    const titles = {
      multiple: "Multiple Choice",
      wordcloud: "Word Cloud",
      rating: "Rating",
      opentext: "Open Text"
    };
    pollModalTitle.textContent = titles[currentPollType];
    // HIDE ALL EXTRA FIELDS FIRST
    multipleChoiceFields.classList.add("hidden");
    ratingFields.classList.add("hidden");
    multipleChoiceFields.style.display = "none";
    ratingFields.style.display = "none";

    // SHOW ONLY RELEVANT FIELDS
    if (currentPollType === "multiple") {
      multipleChoiceFields.classList.remove("hidden");
      multipleChoiceFields.style.display = "flex";
    }
    if (currentPollType === "rating") {
      ratingFields.classList.remove("hidden");
      ratingFields.style.display = "flex";
    }
    // HIDE TYPE SELECT FIRST THEN SHOW MODAL
    pollTypeSelect.classList.add("hidden");
    setTimeout(() => {
      pollModal.classList.remove("hidden");
    }, 50);
  });
});

// RATING SCALE DISPLAY
ratingScale.addEventListener("input", () => {
  ratingScaleVal.textContent = ratingScale.value;
});

// ADD OPTION BUTTON
document.getElementById("addOptionBtn").addEventListener("click", () => {
  const optionsList = document.getElementById("optionsList");
  const count = optionsList.querySelectorAll(".option-row").length + 1;
  const row = document.createElement("div");
  row.className = "option-row";
  row.innerHTML = `<input type="text" placeholder="Option ${count}" class="option-input">`;
  optionsList.appendChild(row);
});

// CLOSE MODAL
[closePollModal, cancelPollModal].forEach(btn => {
  btn.addEventListener("click", () => {
    pollModal.classList.add("hidden");
  });
});
pollModal.addEventListener("click", (e) => {
  if (e.target === pollModal) pollModal.classList.add("hidden");
});

// SUBMIT POLL
document.getElementById("submitPoll").addEventListener("click", async () => {
  pollError.textContent = "";
  const question = pollQuestion.value.trim();
  if (!question) {
    pollError.textContent = "Please enter a question";
    return;
  }

  let options = [];
  if (currentPollType === "multiple") {
    options = Array.from(document.querySelectorAll(".option-input"))
      .map(i => i.value.trim())
      .filter(v => v !== "");
    if (options.length < 2) {
      pollError.textContent = "Please add at least 2 options";
      return;
    }
  }
  if (currentPollType === "rating") {
    options = [ratingScale.value];
  }

  try {
    const res = await fetch("/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_code: code,
        type: currentPollType,
        question,
        options
      })
    });
    const data = await res.json();
    if (data.success) {
      pollModal.classList.add("hidden");
      loadPolls();
    } else {
      pollError.textContent = data.message;
    }
  } catch (err) {
    pollError.textContent = "Something went wrong";
  }
});

// LOAD POLLS
// POLLS
const pollTypeSelect = document.getElementById("pollTypeSelect");
const runPollCode = document.getElementById("runPollCode");
if (runPollCode) runPollCode.textContent = code;

// OPEN POLL TYPE SELECTION
function openPollTypeSelect() {
  pollTypeSelect.classList.remove("hidden");
}
document.getElementById("createPollBtn").addEventListener("click", openPollTypeSelect);
document.getElementById("addPollRowBtn").addEventListener("click", openPollTypeSelect);

// CLOSE POLL TYPE SELECT ON OUTSIDE CLICK
pollTypeSelect.addEventListener("click", (e) => {
  if (e.target === pollTypeSelect) pollTypeSelect.classList.add("hidden");
});

// ACTIVE POLL TRACKING
let activePollId = null;

async function loadPolls() {
  try {
    const res = await fetch(`/polls/${code}`);
    const data = await res.json();
    const container = document.getElementById("pollsListContainer");

    const typeIcons = {
      multiple: "&#9776;",
      wordcloud: "&#9729;",
      rating: "&#11088;",
      opentext: "&#128172;"
    };
    const typeLabels = {
      multiple: "Multiple Choice",
      wordcloud: "Word Cloud",
      rating: "Rating",
      opentext: "Open Text"
    };

    if (!data.success || data.polls.length === 0) {
      container.innerHTML = `<div class="empty-state-small">No polls yet. Create one!</div>`;
      return;
    }

    container.innerHTML = "";
    data.polls.forEach(poll => {
      const isActive = poll.active == 1;
      if (isActive) {
        activePollId = poll.id;
        showLiveResults(poll);
      }

      const item = document.createElement("div");
      item.className = "poll-list-item";
      item.innerHTML = `
        <div class="poll-list-icon">${typeIcons[poll.type] || "&#128202;"}</div>
        <div class="poll-list-info">
          <p class="poll-list-type">${typeLabels[poll.type]}</p>
          <p class="poll-list-question">${poll.question}</p>
          <p class="poll-list-votes">Votes: ${Object.values(JSON.parse(poll.votes || "{}")).reduce((a, b) => a + b, 0)}</p>
        </div>
        <div class="poll-list-actions">
          ${isActive
          ? `<button class="poll-action-btn poll-stop-btn" data-id="${poll.id}">&#9646;&#9646;</button>`
          : `<button class="poll-action-btn poll-play-btn" data-id="${poll.id}">&#9654;</button>`
        }
        </div>
      `;

      // PLAY
      const playBtn = item.querySelector(".poll-play-btn");
      if (playBtn) {
        playBtn.addEventListener("click", async (e) => {
          e.stopPropagation();

          // DEACTIVATE ANY CURRENTLY ACTIVE POLL FIRST
          if (activePollId && activePollId !== poll.id) {
            await fetch(`/polls/${activePollId}/activate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ active: 0 })
            });
          }

          // ACTIVATE NEW POLL
          await fetch(`/polls/${poll.id}/activate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: 1 })
          });

          activePollId = poll.id;
          loadPolls();
          showLiveResults(poll);
        });
      }

      // STOP
      const stopBtn = item.querySelector(".poll-stop-btn");
      if (stopBtn) {
        stopBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await fetch(`/polls/${poll.id}/activate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: 0 })
          });
          activePollId = null;
          loadPolls();
          hideLiveResults();
        });
      }

      container.appendChild(item);
    });

  } catch (err) {
    console.error(err);
  }
}

// SHOW LIVE RESULTS
function showLiveResults(poll) {
  const options = JSON.parse(poll.options || "[]");
  const votes = JSON.parse(poll.votes || "{}");
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  document.getElementById("runPollsEmpty").style.display = "none";
  const liveResults = document.getElementById("pollLiveResults");
  liveResults.classList.remove("hidden");
  document.getElementById("liveResultsQuestion").textContent = poll.question;
  document.getElementById("totalVotes").textContent = total;
  const barsContainer = document.getElementById("liveResultsBars");
  // ONLY CALL renderResults — remove the duplicate manual rendering below
  renderResults(poll.type, options, votes, total, barsContainer);
}

// RENDER RESULTS BY TYPE
function renderResults(type, options, votes, total, container) {
  container.innerHTML = "";

  if (type === "multiple") {
    options.forEach(opt => {
      const count = votes[opt] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const row = document.createElement("div");
      row.className = "result-bar-row";
      row.innerHTML = `
        <div class="result-bar-label">
          <span>${opt}</span>
          <span>${pct}%</span>
        </div>
        <div class="result-bar-track">
          <div class="result-bar-fill" style="width:${pct}%"></div>
        </div>
      `;
      container.appendChild(row);
    });

  } else if (type === "wordcloud") {
    const cloud = document.createElement("div");
    cloud.className = "word-cloud";
    const maxCount = Math.max(...Object.values(votes), 1);
    if (Object.keys(votes).length === 0) {
      cloud.innerHTML = `<p style="color:#64748b">No responses yet...</p>`;
    } else {
      // SHUFFLE for scattered look
      const entries = Object.entries(votes).sort(() => Math.random() - 0.5);
      entries.forEach(([word, count]) => {
        const size = 13 + Math.round((count / maxCount) * 18);
        const item = document.createElement("span");
        item.className = "word-cloud-item";
        item.style.fontSize = `${size}px`;
        item.style.opacity = String(0.5 + (count / maxCount) * 0.5);
        if (count === maxCount) {
          item.style.background = "rgba(56,189,248,0.3)";
          item.style.color = "#38bdf8";
        }
        item.textContent = word;
        cloud.appendChild(item);
      });
    }
    container.appendChild(cloud);

  } else if (type === "rating") {
    const max = Number(options[0]) || 5;
    const chart = document.createElement("div");
    chart.className = "rating-chart";
    const maxCount = Math.max(...Array.from({ length: max }, (_, i) => votes[String(i + 1)] || 0), 1);

    for (let i = 1; i <= max; i++) {
      const count = votes[String(i)] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const heightPct = Math.round((count / maxCount) * 100);
      const isHighest = count === maxCount && count > 0;
      const col = document.createElement("div");
      col.className = "rating-chart-col";
      col.innerHTML = `
        <span class="rating-chart-pct">${pct > 0 ? pct + "%" : ""}</span>
        <div class="rating-chart-bar ${isHighest ? "highest" : ""}"
          style="height:${heightPct}%"></div>
        <span class="rating-chart-num">${i}</span>
      `;
      chart.appendChild(col);
    }
    container.appendChild(chart);

  } else if (type === "opentext") {
    const list = document.createElement("div");
    list.className = "open-text-list";
    const entries = Object.keys(votes);
    if (entries.length === 0) {
      list.innerHTML = `<p style="color:#64748b;font-size:14px;">No responses yet...</p>`;
    } else {
      entries.forEach(ans => {
        const item = document.createElement("div");
        item.className = "open-text-item";
        item.textContent = ans;
        list.appendChild(item);
      });
    }
    container.appendChild(list);
  }
}

// HIDE LIVE RESULTS
function hideLiveResults() {
  document.getElementById("runPollsEmpty").style.display = "flex";
  document.getElementById("pollLiveResults").classList.add("hidden");
}

// AUTO REFRESH RESULTS EVERY 4 SECONDS
setInterval(async () => {
  if (!activePollId) return;
  try {
    const res = await fetch(`/polls/${activePollId}/results`);
    const data = await res.json();
    if (data.success) showLiveResults(data.poll);
  } catch (err) { }
}, 4000);


// ANALYTICS TAB
const tabAnalytics = document.getElementById("tabAnalytics");
const analyticsContent = document.getElementById("analyticsContent");

tabAnalytics.addEventListener("click", () => {
  tabs.forEach(t => t.classList.remove("active"));
  tabAnalytics.classList.add("active");
  qaContent.style.display = "none";
  pollsContent.style.display = "none";
  document.getElementById("mainContent").style.display = "none";
  analyticsContent.style.display = "flex";
  loadAnalytics();
});

tabQA.addEventListener("click", () => {
  tabQA.classList.add("active");
  tabPolls.classList.remove("active");
  analyticsContent.style.display = "none";
  document.getElementById("mainContent").style.display = "flex";
  qaContent.style.display = "flex";
  pollsContent.style.display = "none";
});

tabPolls.addEventListener("click", () => {
  tabPolls.classList.add("active");
  tabQA.classList.remove("active");
  analyticsContent.style.display = "none";
  document.getElementById("mainContent").style.display = "flex";
  pollsContent.style.display = "flex";
  qaContent.style.display = "none";
  loadPolls();
});

async function loadAnalytics() {
  try {
    const analyticsContent = document.getElementById("analyticsContent");

    // FETCH QUESTIONS AND POLLS
    const [qRes, pRes] = await Promise.all([
      fetch(`/questions/${code}`),
      fetch(`/polls/${code}`)
    ]);
    const qData = await qRes.json();
    const pData = await pRes.json();

    const questions = qData.questions || [];
    const polls = pData.polls || [];

    // CALCULATE STATS
    const totalQuestions = questions.length;
    const totalLikes = questions.reduce((a, b) => a + (b.likes || 0), 0);
    const topQuestion = questions.sort((a, b) => b.likes - a.likes)[0];
    const uniqueAuthors = new Set(questions.map(q => q.author || "Anonymous")).size;
    const totalPollVotes = polls.reduce((a, p) => {
      const votes = JSON.parse(p.votes || "{}");
      return a + Object.values(votes).reduce((x, y) => x + y, 0);
    }, 0);

    analyticsContent.innerHTML = `
      <div class="analytics-grid">
        <div class="analytics-card">
          <p class="analytics-number">${totalQuestions}</p>
          <p class="analytics-label">Total Questions</p>
        </div>
        <div class="analytics-card">
          <p class="analytics-number">${uniqueAuthors}</p>
          <p class="analytics-label">Participants</p>
        </div>
        <div class="analytics-card">
          <p class="analytics-number">${totalLikes}</p>
          <p class="analytics-label">Total Likes</p>
        </div>
        <div class="analytics-card">
          <p class="analytics-number">${totalPollVotes}</p>
          <p class="analytics-label">Poll Votes</p>
        </div>
      </div>

      ${topQuestion ? `
      <div class="analytics-section">
        <h3 class="analytics-section-title">&#128293; Top Question</h3>
        <div class="analytics-top-question">
          <p class="analytics-q-text">${topQuestion.question}</p>
          <span class="analytics-q-likes">${topQuestion.likes} &#128077;</span>
        </div>
      </div>` : ""}

      ${questions.length > 0 ? `
      <div class="analytics-section">
        <h3 class="analytics-section-title">&#128172; All Questions by Popularity</h3>
        <div class="analytics-questions-list">
          ${questions.map((q, i) => `
            <div class="analytics-q-row">
              <span class="analytics-q-rank">#${i + 1}</span>
              <span class="analytics-q-text-small">${q.question}</span>
              <span class="analytics-q-likes-small">${q.likes} &#128077;</span>
            </div>
          `).join("")}
        </div>
      </div>` : ""}

      ${polls.length > 0 ? `
      <div class="analytics-section">
        <h3 class="analytics-section-title">&#128202; Poll Results Summary</h3>
        ${polls.map(poll => {
          const votes = JSON.parse(poll.votes || "{}");
          const total = Object.values(votes).reduce((a, b) => a + b, 0);
          const options = JSON.parse(poll.options || "[]");
          return `
            <div class="analytics-poll-card">
              <p class="analytics-poll-q">${poll.question}</p>
              <p class="analytics-poll-votes">${total} total votes</p>
              ${poll.type === "multiple" ? options.map(opt => {
                const count = votes[opt] || 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return `
                  <div class="analytics-poll-bar-row">
                    <span class="analytics-poll-opt">${opt}</span>
                    <div class="analytics-poll-track">
                      <div class="analytics-poll-fill" style="width:${pct}%"></div>
                    </div>
                    <span class="analytics-poll-pct">${pct}%</span>
                  </div>
                `;
              }).join("") : Object.entries(votes).map(([ans, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return `
                  <div class="analytics-poll-bar-row">
                    <span class="analytics-poll-opt">${ans}</span>
                    <div class="analytics-poll-track">
                      <div class="analytics-poll-fill" style="width:${pct}%"></div>
                    </div>
                    <span class="analytics-poll-pct">${pct}% (${count})</span>
                  </div>
                `;
              }).join("")}
            </div>
          `;
        }).join("")}
      </div>` : ""}
    `;
  } catch(err) {
    console.error(err);
  }
}