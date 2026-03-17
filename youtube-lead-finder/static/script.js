let leadsData = [];
let filteredLeads = [];  // For search filtering

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
    filteredLeads = [...leadsData];  // Initialize filtered
    renderTable();
    table.classList.remove("hidden");
  } catch (error) {
    console.error("Error loading leads:", error);
    document.getElementById("lead-body").innerHTML =
      '<tr><td colspan="5" class="px-4 py-4 text-center text-red-500">Error loading leads.</td></tr>';
    table.classList.remove("hidden");
  } finally {
    loading.classList.add("hidden");
  }
}

// Render table rows with Tailwind styling
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

  filteredLeads.forEach((lead, index) => {
    const row = document.createElement("tr");
    const isContacted = lead.contacted;
    row.className = `hover:bg-gray-50 transition duration-150 ${isContacted ? 'opacity-60' : ''} ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`;  // Zebra and hover
    row.innerHTML = `
      <td class="px-4 py-4 whitespace-nowrap">
        <input type="checkbox" class="lead-checkbox accent-primary" data-email="${lead.email}" ${isContacted ? 'disabled' : ''}>
      </td>
      <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${lead.email}</td>
      <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${lead.channel_name}</td>
      <td class="px-4 py-4 whitespace-nowrap">
        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${isContacted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
          ${isContacted ? 'Contacted' : 'Pending'}
        </span>
      </td>
      <td class="px-4 py-4 whitespace-nowrap">
        <button
          data-email="${lead.email}"
          data-channel="${lead.channel_name}"
          class="bg-primary text-white px-3 py-1 rounded hover:bg-blue-700 transition duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
          ${isContacted ? "disabled" : ""}>
          ${isContacted ? "Sent" : "Send"}
        </button>
      </td>
    `;
    tbody.appendChild(row);
    const button = row.querySelector('button[data-email]');
    if (button) {
      button.addEventListener('click', function() {
        sendSingleEmail(this.dataset.email, this.dataset.channel, this);
      });
    }
  });
  updateSelectAll();
  updateSelectedCount();
}

// Search functionality
document.getElementById("search-input").addEventListener("input", function () {
  const query = this.value.toLowerCase();
  filteredLeads = leadsData.filter(lead =>
    lead.email.toLowerCase().includes(query) || lead.channel_name.toLowerCase().includes(query)
  );
  renderTable();
});

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
  document.getElementById("select-all").checked = allChecked;
}

function updateSelectedCount() {
  const selected = document.querySelectorAll(".lead-checkbox:checked:not(:disabled)").length;
  document.getElementById("selected-count").textContent = selected;
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
      await loadLeads();
    } else {
      showToast(result.message || "Failed to send email", "error");
      button.textContent = "Send";
      button.disabled = false;
      button.classList.remove("loading");
    }
  } catch (error) {
    showToast("Error sending email", "error");
    button.textContent = "Send";
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
    btn.textContent = "Send All Unsent";
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
    btn.textContent = "Send Selected (0)";
    updateSelectedCount();
    btn.disabled = false;
  }
}

// Show toast notification with Tailwind animations
function showToast(message, type) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  const colorClass = type === "success" ? "bg-green-500" : type === "error" ? "bg-red-500" : "bg-yellow-500";
  toast.className = `text-white px-4 py-2 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300 ${colorClass}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.remove("translate-x-full"), 100);  // Slide in
  setTimeout(() => {
    toast.classList.add("translate-x-full");
    setTimeout(() => container.removeChild(toast), 300);
  }, 3000);
}

// Initial load
loadLeads();
