let leadsData = [];
let filteredLeads = []; // For search filtering
let activeFilter = "all"; // Track active filter (all, pending, sent)

// Load leads and populate table
async function loadLeads() {
  const table = document.getElementById("leads-table");
  const loading = document.getElementById("loading-state");
  const empty = document.getElementById("empty-state");
  table.classList.add("hidden");
  empty.classList.add("hidden");
  loading.classList.remove("hidden");

  try {
    const response = await fetch("/api/leads");
    leadsData = await response.json();
    filteredLeads = [...leadsData]; // Initialize filtered
    activeFilter = "all"; // Reset to "All" when loading
    updateFilterButtonUI(); // Update button styling
    applyFilters(); // Apply filters and render
    table.classList.remove("hidden");
  } catch (error) {
    console.error("Error loading leads:", error);
    document.getElementById("lead-body").innerHTML =
      '<tr><td colspan="5" class="px-4 py-4 text-center text-red-500">Error loading leads. Please refresh the page.</td></tr>';
    table.classList.remove("hidden");
  } finally {
    loading.classList.add("hidden");
  }
}

// Render table rows with clean component classes
function renderTable() {
  const tbody = document.getElementById("lead-body");
  const empty = document.getElementById("empty-state");
  const table = document.getElementById("leads-table");

  tbody.innerHTML = "";
  if (filteredLeads.length === 0) {
    empty.classList.remove("hidden");
    table.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  table.classList.remove("hidden");

  filteredLeads.forEach((lead) => {
    const row = document.createElement("tr");
    const isContacted = lead.contacted;

    row.className = "table-row";
    row.innerHTML = `
      <td class="table-cell">
        <input 
          type="checkbox" 
          class="lead-checkbox checkbox-custom" 
          data-email="${lead.email}" 
          ${isContacted ? "disabled" : ""}>
      </td>
      <td class="table-cell">${lead.email}</td>
      <td class="table-cell">${lead.channel_name}</td>
      <td class="table-cell">
        <span class="${isContacted ? "badge-sent" : "badge-pending"}">
          ${isContacted ? "✓ Sent" : "⏳ Pending"}
        </span>
      </td>
      <td class="table-cell text-center">
        <button
          data-email="${lead.email}"
          data-channel="${lead.channel_name}"
          class="${isContacted ? "btn-secondary" : "btn-primary"} btn-sm"
          ${isContacted ? "disabled" : ""}>
          ${isContacted ? "Sent" : "Send"}
        </button>
      </td>
    `;
    tbody.appendChild(row);

    const button = row.querySelector("button[data-email]");
    if (button && !isContacted) {
      button.addEventListener("click", function () {
        sendSingleEmail(this.dataset.email, this.dataset.channel, this);
      });
    }
  });

  updateSelectAll();
  updateSelectedCount();
}

// Combined filter function for search + status
function applyFilters() {
  const searchQuery = document
    .getElementById("search-input")
    .value.toLowerCase();

  filteredLeads = leadsData.filter((lead) => {
    // 1. Apply status filter
    if (activeFilter === "pending" && lead.contacted) return false; // Hide contacted
    if (activeFilter === "sent" && !lead.contacted) return false; // Hide pending
    // activeFilter === "all" shows everything

    // 2. Apply search filter
    const matchesSearch =
      lead.email.toLowerCase().includes(searchQuery) ||
      lead.channel_name.toLowerCase().includes(searchQuery);

    return matchesSearch;
  });

  // 3. Sort: pending leads first, sent leads at end (alphabetically within each group)
  filteredLeads.sort((a, b) => {
    if (a.contacted !== b.contacted) {
      return a.contacted ? 1 : -1; // Pending (false) first, Sent (true) last
    }
    return a.email.localeCompare(b.email); // Alphabetical within same status
  });

  renderTable();
}

// Search functionality (now uses combined filter)
document.getElementById("search-input").addEventListener("input", function () {
  applyFilters();
});

// Filter button click handlers
document.getElementById("filter-all").addEventListener("click", function () {
  activeFilter = "all";
  updateFilterButtonUI();
  applyFilters();
});

document
  .getElementById("filter-pending")
  .addEventListener("click", function () {
    activeFilter = "pending";
    updateFilterButtonUI();
    applyFilters();
  });

document.getElementById("filter-sent").addEventListener("click", function () {
  activeFilter = "sent";
  updateFilterButtonUI();
  applyFilters();
});

// Update button styling to show which filter is active (using component classes)
function updateFilterButtonUI() {
  const allBtn = document.getElementById("filter-all");
  const pendingBtn = document.getElementById("filter-pending");
  const sentBtn = document.getElementById("filter-sent");

  // Reset all buttons to inactive state
  [allBtn, pendingBtn, sentBtn].forEach((btn) => {
    btn.classList.remove("filter-tab-active");
    btn.classList.add("filter-tab-inactive");
  });

  // Set active filter button with active component class
  if (activeFilter === "all") {
    allBtn.classList.remove("filter-tab-inactive");
    allBtn.classList.add("filter-tab-active");
  } else if (activeFilter === "pending") {
    pendingBtn.classList.remove("filter-tab-inactive");
    pendingBtn.classList.add("filter-tab-active");
  } else if (activeFilter === "sent") {
    sentBtn.classList.remove("filter-tab-inactive");
    sentBtn.classList.add("filter-tab-active");
  }
}

// Handle select-all checkbox
document.getElementById("select-all").addEventListener("change", function () {
  const checkboxes = document.querySelectorAll(".lead-checkbox:not(:disabled)");
  checkboxes.forEach((cb) => (cb.checked = this.checked));
  updateSelectedCount();
});

// Update select-all based on individual checkboxes
function updateSelectAll() {
  const checkboxes = document.querySelectorAll(".lead-checkbox:not(:disabled)");
  const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
  const selectAllElement = document.getElementById("select-all");
  if (selectAllElement) {
    selectAllElement.checked = allChecked;
  }
}

function updateSelectedCount() {
  const selected = document.querySelectorAll(
    ".lead-checkbox:checked:not(:disabled)",
  ).length;
  const countElement = document.getElementById("selected-count");
  if (countElement) {
    countElement.textContent = selected;
  }
}

// Add event listener for checkboxes to update count
document.addEventListener("change", function (e) {
  if (e.target.classList.contains("lead-checkbox")) {
    updateSelectAll();
    updateSelectedCount();
  }
});

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
      showToast(`Email sent to ${email}`, "success");
      addLog(email, channelName, "success"); // ✅ Log the send
      await loadProgress();
      await loadLeads();
    } else {
      showToast(result.message || "Failed to send email", "error");
      addLog(email, channelName, "error"); // ✅ Log the failure
      button.textContent = "Send";
      button.disabled = false;
      button.classList.remove("loading");
    }
  } catch (error) {
    showToast("Error sending email", "error");
    addLog(email, channelName, "error"); // ✅ Log the error
    button.textContent = "Send";
    button.disabled = false;
    button.classList.remove("loading");
  }
}

// Send all unsent emails - REALTIME VERSION (one by one)
async function sendAllEmails() {
  const btn = document.getElementById("send-all-btn");
  btn.textContent = "Sending...";
  btn.disabled = true;
  
  const allLeads = leadsData.filter(lead => !lead.contacted);
  
  if (allLeads.length === 0) {
    showToast("No unsent emails", "info");
    btn.textContent = "Send All Unsent";
    btn.disabled = false;
    return;
  }

  let sentCount = 0;
  
  try {
    // Send each email one by one with real-time logging
    for (const lead of allLeads) {
      try {
        const response = await fetch("/send-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: lead.email,
            channel_name: lead.channel_name,
          }),
        });
        const result = await response.json();
        
        if (result.success) {
          addLog(lead.email, lead.channel_name, "success");  // ✅ LOG IMMEDIATELY
          sentCount++;
        } else {
          addLog(lead.email, lead.channel_name, "error");
        }
        
        // Small delay between emails (optional, prevents server overload)
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error sending to ${lead.email}:`, error);
        addLog(lead.email, lead.channel_name, "error");
      }
    }
    
    showToast(`Sent ${sentCount} emails`, "success");
    await loadProgress();
    await loadLeads();
  } catch (error) {
    showToast("Error in bulk send operation", "error");
  } finally {
    btn.textContent = "Send All Unsent";
    btn.disabled = false;
  }
}

// Send selected emails - REALTIME VERSION (one by one)
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

  let sentCount = 0;

  try {
    // Send each email one by one with real-time logging
    for (const email of selected) {
      try {
        // Find the lead to get channel name
        const lead = leadsData.find((l) => l.email === email);
        if (!lead) continue;

        const response = await fetch("/send-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email,
            channel_name: lead.channel_name,
          }),
        });
        const result = await response.json();

        if (result.success) {
          addLog(email, lead.channel_name, "success");  // ✅ LOG IMMEDIATELY
          sentCount++;
        } else {
          addLog(email, lead.channel_name, "error");
        }

        // Small delay between emails (optional, prevents server overload)
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error sending to ${email}:`, error);
        const lead = leadsData.find((l) => l.email === email);
        if (lead) {
          addLog(email, lead.channel_name, "error");
        }
      }
    }

    showToast(`Sent ${sentCount} selected emails`, "success");
    await loadProgress();
    await loadLeads();
  } catch (error) {
    showToast("Error in send operation", "error");
  } finally {
    btn.innerHTML =
      '✓ Send Selected <span class="text-xs">(<span id="selected-count">0</span>)</span>';
    btn.onclick = function () {
      sendSelectedEmails();
    };
    updateSelectedCount();
    btn.disabled = false;
  }
}

// Show toast notification using component classes (clean and maintainable)
function showToast(message, type) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");

  // Map type to toast component class
  const typeClass =
    type === "success"
      ? "toast-success"
      : type === "error"
        ? "toast-error"
        : type === "warning"
          ? "toast-warning"
          : "toast-info";

  toast.className = `toast ${typeClass}`;
  toast.textContent = message;
  toast.setAttribute("role", "alert");

  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add("show"), 10);

  // Remove after delay
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => container.removeChild(toast), 300);
  }, 3000);
}

// Load and display campaign progress
async function loadProgress() {
  try {
    const response = await fetch("/api/progress");
    const data = await response.json();

    document.getElementById("total-leads").textContent = data.total;
    document.getElementById("sent-leads").textContent = data.sent;
    document.getElementById("pending-leads").textContent = data.pending;

    const progressBar = document.getElementById("campaign-progress");
    const progressText = document.getElementById("progress-text");

    progressBar.style.width = `${data.percentage}%`;
    progressText.textContent = `${Math.round(data.percentage)}% Complete`;
  } catch (error) {
    console.error("Error loading progress:", error);
  }
}

// Show bulk send progress modal
function showBulkProgress() {
  // For now, just reload progress after bulk send
  // In a real implementation, you'd show a modal with real-time updates
  loadProgress();
}

// Activity Log Management
let emailLogs = [];

function addLog(email, channelName, status = "success") {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = {
    email,
    channelName,
    status,
    timestamp,
  };

  emailLogs.push(logEntry);

  // Show logs section
  const logsSection = document.getElementById("logs-section");
  if (logsSection) {
    logsSection.classList.remove("hidden");
  }

  // Add log to display
  const logsList = document.getElementById("logs-list");
  if (logsList) {
    const logElement = document.createElement("div");
    logElement.className = "px-4 py-3 hover:bg-gray-100 transition";
    logElement.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <p class="font-medium text-gray-900">${email}</p>
          <p class="text-sm text-gray-600">${channelName}</p>
        </div>
        <div class="text-right">
          <span class="text-xs font-semibold px-2 py-1 rounded ${
            status === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }">
            ${status === "success" ? "✓ Sent" : "✗ Failed"}
          </span>
          <p class="text-xs text-gray-500 mt-1">${timestamp}</p>
        </div>
      </div>
    `;
    logsList.insertBefore(logElement, logsList.firstChild);
  }

  // Update count
  updateLogsCount();
}

function clearLogs() {
  emailLogs = [];
  const logsList = document.getElementById("logs-list");
  if (logsList) {
    logsList.innerHTML = "";
  }
  updateLogsCount();

  // Hide logs section if empty
  const logsSection = document.getElementById("logs-section");
  if (logsSection && emailLogs.length === 0) {
    logsSection.classList.add("hidden");
  }
}

function updateLogsCount() {
  const logsCountElement = document.getElementById("logs-count");
  if (logsCountElement) {
    const count = emailLogs.length;
    logsCountElement.textContent = `${count} email${count !== 1 ? "s" : ""} logged`;
  }
}

// Initial load
loadLeads();
loadProgress();