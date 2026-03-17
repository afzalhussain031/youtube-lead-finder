let leadsData = [];

// Load leads and populate table
async function loadLeads() {
  try {
    const response = await fetch("/api/leads");
    leadsData = await response.json();
    renderTable();
  } catch (error) {
    console.error("Error loading leads:", error);
    document.getElementById("lead-body").innerHTML =
      '<tr><td colspan="5">Error loading leads.</td></tr>';
  }
}

// Render table rows with checkboxes/buttons
function renderTable() {
  const tbody = document.getElementById("lead-body");
  tbody.innerHTML = "";
  leadsData.forEach((lead) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="checkbox" class="lead-checkbox" data-email="${lead.email}"></td>
      <td>${lead.email}</td>
      <td>${lead.channel_name}</td>
      <td>${lead.contacted ? "✅" : "❌"}</td>
      <td>
        <button 
          onclick="sendSingleEmail('${lead.email}', '${lead.channel_name}', this)" 
          ${lead.contacted ? "disabled" : ""}>
          ${lead.contacted ? "Sent" : "Send Email"}
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
  updateSelectAll();
}

// Handle select-all checkbox
document.getElementById("select-all").addEventListener("change", function () {
  const checkboxes = document.querySelectorAll(".lead-checkbox");
  checkboxes.forEach((cb) => (cb.checked = this.checked));
});

// Update select-all based on individual checkboxes
function updateSelectAll() {
  const checkboxes = document.querySelectorAll(".lead-checkbox");
  const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
  document.getElementById("select-all").checked = allChecked;
}

async function sendSingleEmail(email, channelName, button) {
  button.textContent = "Sending...";
  button.disabled = true;
  button.classList.add("loading");
  try {
    const response = await fetch("/send-single", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, channel_name: channelName }),
    });
    const result = await response.json();
    if (result.success) {
      showToast(`Email sent to ${email} ✅`, "success");
      await loadLeads();
    } else {
      showToast(result.message || "Failed to send email", "error");
      button.textContent = "Send Email";
      button.disabled = false;
      button.classList.remove("loading");
    }
  } catch (error) {
    showToast("Error sending email", "error");
    button.textContent = "Send Email";
    button.disabled = false;
    button.classList.remove("loading");
  }
}

// Send all unsent emails
async function sendAllEmails() {
  const btn = document.getElementById("send-all-btn");
  btn.textContent = "Sending...";
  btn.disabled = true;
  try {
    const response = await fetch("/send-all", { method: "POST" });
    const result = await response.json();
    showToast(result.message, result.success ? "success" : "error");
    await loadLeads();
  } catch (error) {
    showToast("Error sending emails", "error");
  } finally {
    btn.textContent = "Send Emails (All Unsent)";
    btn.disabled = false;
  }
}

// Send selected emails
async function sendSelectedEmails() {
  const selected = Array.from(
    document.querySelectorAll(".lead-checkbox:checked"),
  ).map((cb) => cb.dataset.email);
  if (selected.length === 0) {
    showToast("No leads selected", "warning");
    return;
  }
  const btn = document.getElementById("send-selected-btn");
  btn.textContent = "Sending...";
  btn.disabled = true;
  try {
    const response = await fetch("/send-selected", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: selected }),
    });
    const result = await response.json();
    showToast(result.message, result.success ? "success" : "error");
    await loadLeads();
  } catch (error) {
    showToast("Error sending selected emails", "error");
  } finally {
    btn.textContent = "Send Selected";
    btn.disabled = false;
  }
}

// Show toast notification
function showToast(message, type) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => container.removeChild(toast), 500);
  }, 3000);
}

// Initial load
loadLeads();
