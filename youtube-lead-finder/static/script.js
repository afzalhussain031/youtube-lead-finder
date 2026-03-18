let leadsData = [];
let filteredLeads = []; // For search filtering
let activeFilter = "all"; // Track active filter (all, pending, sent)

// ================================================================
// SEND OPERATION STATE MANAGER
// Controls pause, stop, resume of bulk email sending
// ================================================================
let sendState = {
  isRunning: false, // Currently sending?
  isPaused: false, // Paused?
  isStopped: false, // User clicked stop?
  currentIndex: 0, // Which email are we on?
  totalCount: 0, // Total emails to send
  sentCount: 0, // Successfully sent
  failedCount: 0, // Failed sends
  emailsToSend: [], // Queue of emails
};

// ================================================================
// CUSTOM CONFIRMATION MODAL SYSTEM
// Replaces browser confirm() with beautiful on-page dialog
// ================================================================
let confirmAction = null; // Stores the function to execute on confirm

function showConfirmModal(
  title,
  message,
  confirmButtonText = "Confirm",
  cancelButtonText = "Cancel",
  callback = null,
) {
  // Set title and message
  const titleEl = document.getElementById("confirm-modal-title");
  if (titleEl) titleEl.textContent = title;

  const messageEl = document.getElementById("confirm-modal-message");
  if (messageEl) messageEl.textContent = message;

  // Set button text
  const confirmBtn = document.getElementById("confirm-modal-confirm");
  if (confirmBtn) confirmBtn.textContent = confirmButtonText;

  const cancelBtn = document.getElementById("confirm-modal-cancel");
  if (cancelBtn) cancelBtn.textContent = cancelButtonText;

  // Store callback (the function to execute if user confirms)
  confirmAction = callback;

  // Show modal
  const overlay = document.getElementById("confirm-modal-overlay");
  if (overlay) {
    overlay.classList.remove("hidden");
  }
}

function closeConfirmModal() {
  // Hide modal
  const overlay = document.getElementById("confirm-modal-overlay");
  if (overlay) {
    overlay.classList.add("hidden");
  }

  // Clear callback
  confirmAction = null;
}

function executeConfirmAction() {
  // Execute the stored callback if it exists
  if (confirmAction && typeof confirmAction === "function") {
    confirmAction();
  }

  // Close modal
  closeConfirmModal();
}

// ================================================================
// DISCOVERY PIPELINE MANAGEMENT
// Control and monitor the lead discovery process
// ================================================================

let discoveryStatus = {}; // Cache current status
let discoveryStatusInterval = null; // Polling interval

function startDiscoveryStatusPolling() {
  // Poll every 2 seconds for status updates
  if (discoveryStatusInterval) clearInterval(discoveryStatusInterval);

  discoveryStatusInterval = setInterval(() => {
    fetchDiscoveryStatus();
  }, 2000);
}

function stopDiscoveryStatusPolling() {
  if (discoveryStatusInterval) {
    clearInterval(discoveryStatusInterval);
    discoveryStatusInterval = null;
  }
}

// Credentials Modal Functions
function openCredsModal() {
  document.getElementById("creds-modal").classList.remove("hidden");
  // Load saved credentials when opening modal
  loadSavedCredentials();
}

function closeCredsModal() {
  document.getElementById("creds-modal").classList.add("hidden");
}

async function loadSavedCredentials() {
  try {
    const response = await fetch("/api/env");
    const credentials = await response.json();

    if (response.ok) {
      // Autofill the form with saved credentials
      if (credentials.YOUTUBE_API_KEY) {
        document.getElementById("env-youtube-key").value =
          credentials.YOUTUBE_API_KEY;
      }
      if (credentials.GMAIL_USER) {
        document.getElementById("env-gmail-user").value =
          credentials.GMAIL_USER;
      }
      if (credentials.GMAIL_APP_PASSWORD) {
        document.getElementById("env-gmail-password").value =
          credentials.GMAIL_APP_PASSWORD;
      }
    }
  } catch (error) {
    console.error("Error loading credentials:", error);
  }
}

function togglePasswordVisibility(fieldId) {
  const input = document.getElementById(fieldId);
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
}

async function saveEnvCredentials() {
  const youtubeKey = document.getElementById("env-youtube-key").value.trim();
  const gmailUser = document.getElementById("env-gmail-user").value.trim();
  const gmailPassword = document
    .getElementById("env-gmail-password")
    .value.trim();

  if (!youtubeKey || !gmailUser || !gmailPassword) {
    showToast("All fields are required", "error");
    return;
  }

  try {
    const response = await fetch("/api/env", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        YOUTUBE_API_KEY: youtubeKey,
        GMAIL_USER: gmailUser,
        GMAIL_APP_PASSWORD: gmailPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || "Failed to save credentials", "error");
      return;
    }

    showToast(
      "Credentials saved successfully! Changes applied immediately.",
      "success",
    );
    closeCredsModal();
  } catch (error) {
    console.error("Error saving credentials:", error);
    showToast("Error: " + error.message, "error");
  }
}

async function fetchDiscoveryStatus() {
  try {
    const response = await fetch("/api/discovery/status");
    const status = await response.json();
    updateDiscoveryUI(status);
  } catch (error) {
    console.error("Error fetching discovery status:", error);
  }
}

function updateDiscoveryUI(status) {
  discoveryStatus = status;

  // Update status indicator
  const indicator = document.getElementById("discovery-indicator");
  const statusText = document.getElementById("discovery-status-text");
  const details = document.getElementById("discovery-details");

  if (status.is_running) {
    indicator.className = "w-3 h-3 bg-green-500 rounded-full animate-pulse";
    statusText.textContent = `Running: ${status.current_step.replace("_", " ")}`;
    details.textContent = `${status.progress}% complete`;

    // Show progress section
    document
      .getElementById("discovery-progress-section")
      .classList.remove("hidden");
    document
      .getElementById("discovery-logs-section")
      .classList.remove("hidden");

    // Update buttons
    document.getElementById("start-discovery-btn").classList.add("hidden");
    document.getElementById("stop-discovery-btn").classList.remove("hidden");

    // Start polling if not already
    if (!discoveryStatusInterval) startDiscoveryStatusPolling();
  } else {
    indicator.className = "w-3 h-3 bg-gray-400 rounded-full";

    if (status.error) {
      statusText.textContent = "Error occurred";
      details.textContent = status.error;
      indicator.className = "w-3 h-3 bg-red-500 rounded-full";
      // Hide progress section on error
      document
        .getElementById("discovery-progress-section")
        .classList.add("hidden");
    } else if (status.current_step === "completed") {
      statusText.textContent = "Discovery completed";
      details.textContent = `Generated ${status.new_leads_generated || 0} leads - view analytics below`;
      showToast(
        `Discovery completed! ${status.new_leads_generated || 0} leads generated`,
        "success",
      );
      // Keep progress section visible to show final analytics
      // Do not hide it
    } else {
      statusText.textContent = "Ready to discover leads";
      details.textContent = "No discovery running";
      // Hide progress section
      document
        .getElementById("discovery-progress-section")
        .classList.add("hidden");
    }

    // Update buttons
    document.getElementById("start-discovery-btn").classList.remove("hidden");
    document.getElementById("stop-discovery-btn").classList.add("hidden");

    // Stop polling
    stopDiscoveryStatusPolling();
  }

  // Update progress bar
  const progressBar = document.getElementById("discovery-progress-bar");
  if (progressBar) progressBar.style.width = `${status.progress}%`;

  // Update stats
  document.getElementById("discovery-step").textContent =
    status.current_step.replace("_", " ");
  document.getElementById("discovery-percent").textContent =
    `${status.progress}%`;
  document.getElementById("new-channels-found").textContent =
    status.new_channels_found || 0;
  document.getElementById("new-channels-analyzed").textContent =
    status.new_channels_analyzed || 0;
  document.getElementById("new-leads-generated").textContent =
    status.new_leads_generated || 0;

  // Update elapsed time
  if (status.start_time) {
    const start = new Date(status.start_time);
    const now = new Date();
    const elapsed = Math.floor((now - start) / 1000);
    document.getElementById("discovery-time").textContent = `${elapsed}s`;
  }

  // Update logs
  updateDiscoveryLogs(status.logs);
}

function updateDiscoveryLogs(logs) {
  const logsContainer = document.getElementById("discovery-logs");
  if (!logsContainer) return;

  logsContainer.innerHTML = "";

  logs.forEach((log) => {
    const logElement = document.createElement("div");
    logElement.className = "mb-1";

    const levelClass =
      log.level === "error"
        ? "text-red-400"
        : log.level === "warning"
          ? "text-yellow-400"
          : "text-green-400";

    logElement.innerHTML = `<span class="text-gray-500">${log.timestamp}</span> <span class="${levelClass}">${log.message}</span>`;
    logsContainer.appendChild(logElement);
  });

  // Auto-scroll to bottom
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

async function startDiscovery() {
  try {
    const response = await fetch("/api/discovery/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // Empty config for now
    });

    const result = await response.json();

    if (result.success) {
      showToast("Discovery started! Check progress above.", "info");

      // ✅ FIX: Immediately start polling after successful POST
      // Fetch current status once
      fetchDiscoveryStatus();
      // Begin the polling interval (checks every 2 seconds)
      startDiscoveryStatusPolling();
    } else {
      showToast(result.error || "Failed to start discovery", "error");
    }
  } catch (error) {
    showToast("Error starting discovery", "error");
    console.error(error);
  }
}

async function stopDiscovery() {
  try {
    const response = await fetch("/api/discovery/stop", { method: "POST" });
    const result = await response.json();

    if (result.success) {
      showToast("Stopping discovery...", "warning");
    } else {
      showToast(result.error || "Failed to stop discovery", "error");
    }
  } catch (error) {
    showToast("Error stopping discovery", "error");
    console.error(error);
  }
}

function showDiscoveryConfig() {
  // Load current config
  fetch("/api/discovery/config")
    .then((response) => response.json())
    .then((config) => {
      document.getElementById("config-max-channels").value =
        config.max_channels;
      document.getElementById("config-region").value =
        config.default_region || "";
      document.getElementById("config-language").value =
        config.default_language || "";
      document.getElementById("config-min-subs").value = config.min_subscribers;
      document.getElementById("config-max-subs").value = config.max_subscribers;

      document
        .getElementById("discovery-config-modal")
        .classList.remove("hidden");
    })
    .catch((error) => {
      console.error("Error loading config:", error);
      showToast("Error loading configuration", "error");
    });
}

function closeDiscoveryConfig() {
  document.getElementById("discovery-config-modal").classList.add("hidden");
}

async function saveDiscoveryConfig() {
  const config = {
    max_channels:
      parseInt(document.getElementById("config-max-channels").value) || 5000,
    region: document.getElementById("config-region").value || null,
    language: document.getElementById("config-language").value || null,
    min_subscribers:
      parseInt(document.getElementById("config-min-subs").value) || 1000,
    max_subscribers:
      parseInt(document.getElementById("config-max-subs").value) || 1000000,
  };

  try {
    // Save config
    await fetch("/api/discovery/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    // Start discovery with config
    const response = await fetch("/api/discovery/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    const result = await response.json();

    if (result.success) {
      showToast("Discovery started with custom config!", "info");
      closeDiscoveryConfig();
    } else {
      showToast(result.error || "Failed to start discovery", "error");
    }
  } catch (error) {
    showToast("Error saving configuration", "error");
    console.error(error);
  }
}

// Initialize discovery status on page load
document.addEventListener("DOMContentLoaded", function () {
  fetchDiscoveryStatus(); // Get initial status
});

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

// ================================================================
// SEND OPERATION CONTROL FUNCTIONS
// Manage pause, stop, resume, and progress display
// ================================================================

function showSendControlPanel() {
  const panel = document.getElementById("send-control-panel");
  if (panel) panel.classList.remove("hidden");
}

function hideSendControlPanel() {
  const panel = document.getElementById("send-control-panel");
  if (panel) panel.classList.add("hidden");
}

function updateSendProgress() {
  const percentage =
    sendState.totalCount > 0
      ? (sendState.currentIndex / sendState.totalCount) * 100
      : 0;

  const progressBar = document.getElementById("send-progress-bar");
  if (progressBar) {
    progressBar.style.width = `${percentage}%`;
  }

  const currentCountEl = document.getElementById("send-current-count");
  if (currentCountEl) currentCountEl.textContent = sendState.sentCount;

  const totalCountEl = document.getElementById("send-total-count");
  if (totalCountEl) totalCountEl.textContent = sendState.totalCount;

  const failedCountEl = document.getElementById("send-failed-count");
  if (failedCountEl) failedCountEl.textContent = sendState.failedCount;

  const statusText = document.getElementById("send-status-text");
  if (statusText) {
    if (sendState.isPaused) {
      statusText.textContent = "⏸️ Paused - Click resume to continue";
    } else if (sendState.isStopped) {
      statusText.textContent = "⏹️ Stopped";
    } else {
      statusText.textContent = "Sending emails...";
    }
  }

  const pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) {
    pauseBtn.textContent = sendState.isPaused ? "▶️ Resume" : "⏸️ Pause";
  }
}

function togglePauseSend() {
  sendState.isPaused = !sendState.isPaused;
  updateSendProgress();

  if (sendState.isPaused) {
    showToast("Operation paused. Click Resume to continue.", "info");
  } else {
    showToast("Operation resumed.", "info");
  }
}

function stopSend() {
  // Show beautiful custom modal instead of browser confirm()
  showConfirmModal(
    "⏹️ Stop Email Operation?",
    "Are you sure you want to stop sending? This will cancel the rest of the unsent emails in the queue.",
    "Stop Operation",
    "Continue Sending",
    () => {
      // This callback executes if user clicks "Stop Operation" (confirm)
      sendState.isStopped = true;
      updateSendProgress();
      showToast("Stopping email operation...", "warning");
    },
  );
}

// Send all unsent emails - WITH PAUSE/STOP/RESUME CONTROL
async function sendAllEmails() {
  const btn = document.getElementById("send-all-btn");
  btn.textContent = "Sending...";
  btn.disabled = true;

  const allLeads = leadsData.filter((lead) => !lead.contacted);

  if (allLeads.length === 0) {
    showToast("No unsent emails", "info");
    btn.textContent = "Send All Unsent";
    btn.disabled = false;
    return;
  }

  // ✅ Initialize send state
  sendState = {
    isRunning: true,
    isPaused: false,
    isStopped: false,
    currentIndex: 0,
    totalCount: allLeads.length,
    sentCount: 0,
    failedCount: 0,
    emailsToSend: allLeads,
  };

  // ✅ Show control panel
  showSendControlPanel();
  updateSendProgress();

  try {
    // ✅ Loop through emails with pause/stop checks
    for (let i = 0; i < allLeads.length; i++) {
      const lead = allLeads[i];
      sendState.currentIndex = i + 1;

      // ✅ CHECK 1: If user clicked stop, exit loop immediately
      if (sendState.isStopped) {
        showToast("Email sending stopped by user", "warning");
        break;
      }

      // ✅ CHECK 2: If paused, wait until resumed
      while (sendState.isPaused && !sendState.isStopped) {
        updateSendProgress();
        await new Promise((resolve) => setTimeout(resolve, 500)); // Check every 500ms
      }

      // ✅ CHECK 3: If stopped while paused, exit
      if (sendState.isStopped) {
        showToast("Email sending stopped by user", "warning");
        break;
      }

      try {
        // Send the email
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
          addLog(lead.email, lead.channel_name, "success");
          sendState.sentCount++;
        } else {
          addLog(lead.email, lead.channel_name, "error");
          sendState.failedCount++;
        }
      } catch (error) {
        console.error(`Error sending to ${lead.email}:`, error);
        addLog(lead.email, lead.channel_name, "error");
        sendState.failedCount++;
      }

      // Update UI after each email
      updateSendProgress();

      // Small delay between emails
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // ✅ Operation complete
    if (sendState.isStopped) {
      showToast(`Stopped at ${sendState.sentCount} emails sent`, "warning");
    } else {
      showToast(
        `Successfully sent ${sendState.sentCount} emails, ${sendState.failedCount} failed`,
        "success",
      );
    }

    await loadProgress();
    await loadLeads();
  } catch (error) {
    showToast("Error in bulk send operation", "error");
    console.error(error);
  } finally {
    // ✅ Clean up
    sendState.isRunning = false;
    btn.textContent = "Send All Unsent";
    btn.disabled = false;

    // Hide control panel after 3 seconds
    setTimeout(() => {
      hideSendControlPanel();
    }, 3000);
  }
}

// Send selected emails - WITH PAUSE/STOP/RESUME CONTROL
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

  // ✅ Initialize send state
  sendState = {
    isRunning: true,
    isPaused: false,
    isStopped: false,
    currentIndex: 0,
    totalCount: selected.length,
    sentCount: 0,
    failedCount: 0,
    emailsToSend: selected,
  };

  // ✅ Show control panel
  showSendControlPanel();
  updateSendProgress();

  try {
    // ✅ Send each email one by one with pause/stop checks
    for (let i = 0; i < selected.length; i++) {
      const email = selected[i];
      sendState.currentIndex = i + 1;

      // ✅ CHECK 1: If user clicked stop, exit loop immediately
      if (sendState.isStopped) {
        showToast("Email sending stopped by user", "warning");
        break;
      }

      // ✅ CHECK 2: If paused, wait until resumed
      while (sendState.isPaused && !sendState.isStopped) {
        updateSendProgress();
        await new Promise((resolve) => setTimeout(resolve, 500)); // Check every 500ms
      }

      // ✅ CHECK 3: If stopped while paused, exit
      if (sendState.isStopped) {
        showToast("Email sending stopped by user", "warning");
        break;
      }

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
          addLog(email, lead.channel_name, "success");
          sendState.sentCount++;
        } else {
          addLog(email, lead.channel_name, "error");
          sendState.failedCount++;
        }
      } catch (error) {
        console.error(`Error sending to ${email}:`, error);
        const lead = leadsData.find((l) => l.email === email);
        if (lead) {
          addLog(email, lead.channel_name, "error");
        }
        sendState.failedCount++;
      }

      // Update UI after each email
      updateSendProgress();

      // Small delay between emails
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // ✅ Operation complete
    if (sendState.isStopped) {
      showToast(`Stopped at ${sendState.sentCount} emails sent`, "warning");
    } else {
      showToast(
        `Successfully sent ${sendState.sentCount} emails, ${sendState.failedCount} failed`,
        "success",
      );
    }

    await loadProgress();
    await loadLeads();
  } catch (error) {
    showToast("Error in send operation", "error");
    console.error(error);
  } finally {
    // ✅ Clean up
    sendState.isRunning = false;
    btn.innerHTML =
      '✓ Send Selected <span class="text-xs">(<span id="selected-count">0</span>)</span>';
    btn.onclick = function () {
      sendSelectedEmails();
    };
    updateSelectedCount();
    btn.disabled = false;

    // Hide control panel after 3 seconds
    setTimeout(() => {
      hideSendControlPanel();
    }, 3000);
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
  const discoveryLogs = document.getElementById("discovery-logs");
  if (discoveryLogs) {
    discoveryLogs.innerHTML = "";
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
