// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBi5kmYtQXv6E0PhNgjSAJ5IM5TQGr0mz4",
  authDomain: "gotl-tickets.firebaseapp.com",
  projectId: "gotl-tickets",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const searchInput = document.getElementById("searchInput");
const resultDiv = document.getElementById("result");
const loader = document.getElementById("loader");

// Trigger search on Enter key
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    searchUser();
  }
});

async function searchUser() {
  const query = searchInput.value.trim().toLowerCase();
  resultDiv.innerHTML = "";
  loader.classList.remove("hidden");

  if (!query) {
    loader.classList.add("hidden");
    resultDiv.innerHTML = `
      <div class="result-card" style="background:#ffe6e6;border-left:4px solid #dc3545;">
        ❌ Please enter a name or email.
      </div>`;
    return;
  }

  const allUsers = [];

  try {
    // Fetch from both collections
    for (const col of ["tickets", "attendees"]) {
      const snapshot = await db.collection(col).get();
      snapshot.forEach((doc) => {
        allUsers.push({ ...doc.data(), id: doc.id, source: col });
      });
    }

    // Fuzzy search
    const fuse = new Fuse(allUsers, {
      keys: ["name", "email"],
      threshold: 0.3,
    });

    const results = fuse.search(query);
    loader.classList.add("hidden");

    if (results.length === 0) {
      resultDiv.innerHTML = `
        <div class="result-card" style="background:#fff3cd;border-left:4px solid #ffc107;">
          ⚠️ No match found for "<strong>${query}</strong>". Try again?
        </div>`;
      return;
    }

    const user = results[0].item;

    // Show result card with animation
    resultDiv.innerHTML = `
      <div class="result-card" id="userCard">
        <p><strong>Name:</strong> ${user.name}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Phone:</strong> ${user.phone}</p>
        <p><strong>Church:</strong> ${user.church}</p>
        <p><strong>Source:</strong> ${user.source}</p>
        <button onclick="checkInUser('${user.name}', '${user.email}', '${user.phone}', '${user.church}', '${user.source}')"
          style="margin-top: 12px; background: #28a745; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer;">
          ✅ Confirm Check-In
        </button>
      </div>
    `;

    // Animate card
    const card = document.getElementById("userCard");
    card.style.opacity = 0;
    card.style.transform = "translateY(20px)";
    setTimeout(() => {
      card.style.transition = "all 0.5s ease";
      card.style.opacity = 1;
      card.style.transform = "translateY(0)";
    }, 50);

  } catch (error) {
    loader.classList.add("hidden");
    resultDiv.innerHTML = `
      <div class="result-card" style="background:#ffe6e6;border-left:4px solid #dc3545;">
        ❌ Error: ${error.message}
      </div>`;
  }
}

async function checkInUser(name, email, phone, church, source) {
  const webhookURL =
    "https://script.google.com/macros/s/AKfycbzsUjkeMPvbuyxbZtwRYQykqOFQiuvMJEwstSOLXvHBY_djnrQlhEMg1PNfChB11j9Fjg/exec";

  try {
    await fetch("/.netlify/functions/proxy", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ name, email, phone, church, source })
});


    resultDiv.innerHTML += `
      <div class="result-card" style="margin-top: 10px; background:#e6ffed;border-left:4px solid #28a745; text-align:center;">
        ✅ ${name} has been checked in and logged to Google Sheets!
      </div>`;
  } catch (err) {
    resultDiv.innerHTML += `
      <div class="result-card" style="margin-top: 10px; background:#ffe6e6;border-left:4px solid #dc3545; text-align:center;">
        ❌ Failed to log check-in: ${err.message}
      </div>`;
  }
}
