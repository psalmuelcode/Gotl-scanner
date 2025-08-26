// -------------------- Config --------------------
const firebaseConfig = {
  apiKey: "AIzaSyBi5kmYtQXv6E0PhNgjSAJ5IM5TQGr0mz4",
  authDomain: "gotl-tickets.firebaseapp.com",
  projectId: "gotl-tickets",
};
// Your deployed Google Apps Script Web App (GET)
const scriptURL = "https://script.google.com/macros/s/AKfycbx7zrJAor_LX75PHk6vutgDYJGrUZNNHC4HxRPWZuQ_wKEi3dl6EWBdy6Dpmd-Zx4rl_Q/exec";

// -------------------- DOM --------------------
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const searchInput = document.getElementById("searchInput");
const resultDiv  = document.getElementById("result");
const loader     = document.getElementById("loader");
const searchBtn  = document.getElementById("searchBtn");

const busyOverlay  = document.getElementById("busyOverlay");
const successBlast = document.getElementById("successBlast");

// Canvas confetti
const fxCanvas = document.getElementById("fxCanvas");
const ctx = fxCanvas.getContext("2d");
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

function resizeCanvas(){
  fxCanvas.width = window.innerWidth;
  fxCanvas.height = window.innerHeight;
}

// -------------------- Search UX --------------------
searchBtn.addEventListener("click", searchUser);
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchUser();
});

async function searchUser(){
  const query = searchInput.value.trim().toLowerCase();
  resultDiv.innerHTML = "";
  loader.classList.remove("hidden");

  if (!query){
    loader.classList.add("hidden");
    resultDiv.innerHTML = msgCard("❌ Please enter a name or email.", "bad");
    return;
  }

  const allUsers = [];
  try{
    // Fetch data from both Firestore collections
    for (const col of ["tickets", "attendees"]){
      const snapshot = await db.collection(col).get();
      snapshot.forEach((doc) => allUsers.push({ ...doc.data(), id: doc.id, source: col }));
    }

    // Run fuzzy search
    const fuse = new Fuse(allUsers, { keys:["name","email"], threshold:0.3 });
    const results = fuse.search(query);

    loader.classList.add("hidden");

    if (results.length === 0){
      resultDiv.innerHTML = msgCard(
        `⚠️ No match found for "<strong>${escapeHtml(query)}</strong>". Try again?`, 
        "warn"
      );
      return;
    }

    // Limit to 10 results
    const topResults = results.slice(0, 10);

    // Build list
    resultDiv.innerHTML = topResults.map((res, idx) => {
      const user = res.item;
      return `
        <div class="result-card" id="userCard-${idx}">
          <p><strong>Name:</strong> ${escapeHtml(user.name || "")}</p>
          <p><strong>Email:</strong> ${escapeHtml(user.email || "")}</p>
          <p><strong>Phone:</strong> ${escapeHtml(user.phone || "")}</p>
          <p><strong>Church:</strong> ${escapeHtml(user.church || "")}</p>
          <p class="meta"><strong>Source:</strong> ${escapeHtml(user.source || "")}</p>

          <div class="result-actions">
            <button class="btn success" id="checkBtn-${idx}">✅ Confirm Check-In</button>
          </div>
        </div>
      `;
    }).join("");

    // Attach event listeners for each button
    topResults.forEach((res, idx) => {
      const user = res.item;
      document.getElementById(`checkBtn-${idx}`).addEventListener("click", () => {
        checkInUser(user.name, user.email, user.phone, user.church, user.source);
      });
    });

  }catch(err){
    loader.classList.add("hidden");
    resultDiv.innerHTML = msgCard(`❌ Error: ${escapeHtml(err.message)}`, "bad");
  }
}

// -------------------- Check-In (with loader + WOW) --------------------
async function checkInUser(name, email, phone, church, source){
  showBusy(true);

  const url = `${scriptURL}?name=${encodeURIComponent(name||"")}&email=${encodeURIComponent(email||"")}&phone=${encodeURIComponent(phone||"")}&church=${encodeURIComponent(church||"")}&source=${encodeURIComponent(source||"")}`;

  try{
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    let result;
    try{ result = JSON.parse(text); }
    catch{ result = inferStatusFromText(text); }

    if (result.status === "success"){
      toast(`✅ ${name} has been checked in and logged to Google Sheets!`, "good");
      playWow();
    } else if (result.status === "duplicate"){
      toast(`⚠️ ${name} is already checked in. Duplicate blocked.`, "warn");
      bumpCard();
    } else {
      toast(`❌ Error: ${result.message || "Unknown error"}`, "bad");
      bumpCard();
    }
  }catch(err){
    toast(`❌ Failed to log check-in: ${err.message}`, "bad");
    bumpCard();
  }finally{
    showBusy(false);
  }
}

// -------------------- UI Helpers --------------------
function msgCard(html, tone="good"){
  return `<div class="result-card ${tone}">${html}</div>`;
}

function toast(message, tone="good"){
  const el = document.createElement("div");
  el.className = `result-card ${tone}`;
  el.style.marginTop = "12px";
  el.innerHTML = escapeHtml(message).replace(/\n/g,"<br/>");
  resultDiv.appendChild(el);
  setTimeout(()=> el.remove(), 6000);
}

function showBusy(flag){
  busyOverlay.classList.toggle("hidden", !flag);
}

function bumpCard(){
  const cards = document.querySelectorAll(".result-card");
  cards.forEach(card => {
    card.classList.remove("shake");
    void card.offsetWidth; // restart animation
    card.classList.add("shake");
  });
}

function escapeHtml(str=""){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function inferStatusFromText(text=""){
  const t = text.toLowerCase();
  if (t.includes("duplicate")) return { status:"duplicate", message:"Already checked in" };
  if (t.includes("success"))   return { status:"success" };
  return { status:"error", message:text };
}

// -------------------- WOW Effects --------------------
function playWow(){
  // Neon success blast
  successBlast.classList.remove("hidden");
  successBlast.querySelector("span").style.animation = "none";
  void successBlast.offsetWidth;
  successBlast.querySelector("span").style.animation = "";
  setTimeout(()=> successBlast.classList.add("hidden"), 1300);

  // Confetti burst from center
  confettiBurst();
}

// Simple canvas confetti
let confetti = [];
function confettiBurst(){
  const cx = fxCanvas.width / 2;
  const cy = fxCanvas.height / 2;

  confetti = [];
  const count = 220;
  for (let i=0;i<count;i++){
    const angle = Math.random()*Math.PI*2;
    const speed = 4 + Math.random()*6;
    confetti.push({
      x: cx, y: cy,
      vx: Math.cos(angle)*speed,
      vy: Math.sin(angle)*speed - 2,
      g: 0.15 + Math.random()*0.2,
      size: 5 + Math.random()*6,
      life: 60 + Math.random()*40,
      hue: Math.floor(180 + Math.random()*180)
    });
  }
  animateConfetti();
}

function animateConfetti(){
  ctx.clearRect(0,0,fxCanvas.width, fxCanvas.height);
  confetti = confetti.filter(p => p.life>0);

  for (const p of confetti){
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(((60 - p.life)/60) * Math.PI*2);
    ctx.fillStyle = `hsl(${p.hue} 90% 60%)`;
    ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
    ctx.restore();
  }

  if (confetti.length) requestAnimationFrame(animateConfetti);
  else ctx.clearRect(0,0,fxCanvas.width, fxCanvas.height);
}
