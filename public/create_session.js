// AUTO GENERATE CODE
function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
// ADD THIS HELPER AT TOP OF create_session.js
function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}
 

// ELEMENTS
const openModal = document.getElementById("openModal");
const closeModal = document.getElementById("closeModal");
const modalOverlay = document.getElementById("modalOverlay");
const submitEvent = document.getElementById("submitEvent");
const eventName = document.getElementById("eventName");
const eventCode = document.getElementById("eventCode");
const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");
const errorMsg = document.getElementById("errorMsg");
const eventsGrid = document.getElementById("eventsGrid");

// SET DEFAULT CODE WHEN MODAL OPENS
openModal.addEventListener("click", () => {
  eventCode.value = generateCode();
  modalOverlay.classList.remove("hidden");
});

// CLOSE MODAL
closeModal.addEventListener("click", () => {
  modalOverlay.classList.add("hidden");
  errorMsg.textContent = "";
});

// SUBMIT EVENT
submitEvent.addEventListener("click", async () => {
  errorMsg.textContent = "";
  const name = eventName.value.trim();
  const code = eventCode.value.trim();
  const start = startDate.value;
  const end = endDate.value;
  const user_id = localStorage.getItem("token") || 1;

  // VALIDATION
  if (!name || !code || !start || !end) {
    errorMsg.textContent = "Please fill all fields";
    return;
  }
  if (end <= start) {
    errorMsg.textContent = "End date/time cannot be before start date/time";
    return;
  }
  const startUTC = new Date(start).toISOString();
  const endUTC = new Date(end).toISOString();

  // API CALL
// API CALL
const response = await fetch("/create-event", {
  method: "POST",
  headers: authHeaders(),
  body: JSON.stringify({ name, code, start_date: startUTC, end_date: endUTC })
});
  const data = await response.json();

  if (data.success) {
    modalOverlay.classList.add("hidden");
    eventName.value = "";
    startDate.value = "";
    endDate.value = "";
    // RESET OPTIONS LIST
    document.getElementById("optionsList") && (document.getElementById("optionsList").innerHTML = "");
    loadEvents();
    // REDIRECT TO EVENT PAGE
    window.location.href = `event.html?name=${encodeURIComponent(name)}&code=${encodeURIComponent(code)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  } else {
    errorMsg.textContent = data.message;
  }
});

// LOAD EVENTS
async function loadEvents() {
  eventsGrid.innerHTML = "<p class='loading-text'>Loading sessions...</p>";
  try {
    const response = await fetch("/events", {
      headers: authHeaders()
    });
    if(response.status === 401 || response.status === 403) {
      window.location.href = "login.html";
      return;
    }
    const data = await response.json();

  if (!data.events || data.events.length === 0) {
    eventsGrid.innerHTML = "<p class='loading-text'>No active sessions. Create one!</p>";
    return;
  }

  eventsGrid.innerHTML = "";
  data.events.forEach(event => {
    const card = document.createElement("div");
    card.className = "event-card";
    card.innerHTML = `
      <div class="event-card-left">
        <h3>${event.name}</h3>
        <p>📅 ${new Date(event.start_date).toLocaleString()} → ${new Date(event.end_date).toLocaleString()}</p>
      </div>
      <div class="event-card-right">
        <span class="event-code-badge">#${event.code}</span>
        <span class="event-arrow">&#8594;</span>
      </div>
    `;
    card.addEventListener("click", () => {
      window.location.href = `event.html?name=${encodeURIComponent(event.name)}&code=${encodeURIComponent(event.code)}&start=${encodeURIComponent(event.start_date)}&end=${encodeURIComponent(event.end_date)}`;
    });
    eventsGrid.appendChild(card);
  });
  } catch(err) {
    eventsGrid.innerHTML = "<p class='loading-text'>Failed to load sessions.</p>";
  }
}
// AUTO REMOVE EXPIRED EVENTS EVERY MINUTE
setInterval(() => {
  loadEvents();
}, 60000);
// LOAD ON PAGE START
loadEvents();