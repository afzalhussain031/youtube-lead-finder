let leadsData = [];
let filteredLeads = []; // For search filtering
let activeFilter = "all"; // Track active filter (all, pending, sent)
let sortConfig = { key: null, direction: 'asc' }; // For column sorting
let activeTags = new Set(); // For multi-filters like high-score

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

// ================================================================
// ERROR MODAL MANAGEMENT (NEW)
// ================================================================

let lastErrorData = null; // Store last error payload for copy/download actions

function showErrorModal(errorData) {
  lastErrorData = errorData || {};
  const overlay = document.getElementById("error-modal-overlay");

  if (!overlay) {
    console.error("Error modal overlay not found in DOM");
    return;
  }

  // Set title and error type badge - with null checks
  const titleEl = document.getElementById("error-modal-title");
  if (titleEl) {
    titleEl.textContent = errorData.error_type || "Discovery Error";
  }

  const badgeEl = document.getElementById("error-type-badge");
  if (badgeEl) {
    badgeEl.textContent = errorData.error_type || "Error";
  }

  // Set main error message
  const messageEl = document.getElementById("error-message");
  if (messageEl) {
    messageEl.textContent =
      errorData.message || "An error occurred during discovery.";
  }

  // Populate solutions list
  const solutionsList = document.getElementById("error-solutions");
  if (solutionsList) {
    solutionsList.innerHTML = "";
    const solutions =
      errorData.recommended_actions || errorData.solutions || [];
    if (Array.isArray(solutions) && solutions.length > 0) {
      solutions.forEach((solution) => {
        const li = document.createElement("li");
        li.textContent = solution;
        solutionsList.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.textContent = "Check the raw error details for more information";
      solutionsList.appendChild(li);
    }
  }

  // Show raw error for debugging (hidden by default in details)
  const rawDetailsEl = document.getElementById("error-raw-details");
  if (rawDetailsEl) {
    rawDetailsEl.textContent =
      errorData.raw_error ||
      errorData.error_log ||
      "No raw error details available.";
  }

  // Configure quick-fix button
  const quickFixBtn = document.getElementById("error-quickfix-btn");
  if (quickFixBtn) {
    if (errorData.quick_fix) {
      quickFixBtn.classList.remove("hidden");
      if (errorData.quick_fix === "open_credentials") {
        quickFixBtn.textContent = "🔑 Fix credentials";
      } else if (errorData.quick_fix === "open_quota_help") {
        quickFixBtn.textContent = "🧮 Check quota";
      } else {
        quickFixBtn.textContent = "⚡ Take action";
      }
    } else {
      quickFixBtn.classList.add("hidden");
    }
  }

  // Show modal
  overlay.classList.remove("hidden");
  console.log("✅ Error modal opened with error type:", errorData.error_type);
}

function closeErrorModal() {
  const overlay = document.getElementById("error-modal-overlay");
  overlay.classList.add("hidden");
}

function copyErrorDetails() {
  if (!lastErrorData) {
    showToast("No error details available to copy", "warning");
    return;
  }

  const payload = {
    type: lastErrorData.error_type,
    message: lastErrorData.message,
    raw_error: lastErrorData.raw_error,
    solutions:
      lastErrorData.solutions || lastErrorData.recommended_actions || [],
    log: lastErrorData.error_log || "",
  };

  const text = JSON.stringify(payload, null, 2);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast("Error details copied to clipboard", "success"))
      .catch((err) => {
        console.error("Failed to copy error details", err);
        showToast("Could not copy error details", "error");
      });
  } else {
    // Fallback: create a temporary textarea
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      showToast("Error details copied to clipboard", "success");
    } catch (err) {
      showToast("Could not copy error details", "error");
    }
    document.body.removeChild(textarea);
  }
}

function downloadErrorLog() {
  if (!lastErrorData) {
    showToast("No error details available to download", "warning");
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `discovery-error-${timestamp}.txt`;

  const lines = [];
  lines.push(`Error Type: ${lastErrorData.error_type || "Unknown"}`);
  lines.push(`Message: ${lastErrorData.message || "No message"}`);
  lines.push("");
  lines.push("Raw Error:");
  lines.push(lastErrorData.raw_error || "(none)");
  lines.push("");
  lines.push("Recommended Actions:");
  const solutions =
    lastErrorData.recommended_actions || lastErrorData.solutions || [];
  solutions.forEach((s) => lines.push(`- ${s}`));
  lines.push("");
  lines.push("Error Log:");
  lines.push(lastErrorData.error_log || "(no additional log)");

  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function handleErrorQuickFix() {
  if (!lastErrorData || !lastErrorData.quick_fix) {
    return;
  }

  const action = lastErrorData.quick_fix;
  if (action === "open_credentials") {
    closeErrorModal();
    openCredsModal();
  } else if (action === "open_quota_help") {
    closeErrorModal();
    showToast("Quota exceeded. Check your API usage or reset quota.", "info");
  } else {
    closeErrorModal();
  }
}

// ================================================================
// KEYWORDS MANAGEMENT MODAL SYSTEM
// Allow users to edit keywords directly from the UI
// ================================================================

function openKeywordsModal() {
  const modal = document.getElementById("keywords-modal");
  if (modal) {
    modal.classList.remove("hidden");
    loadKeywords(); // Fetch and populate keywords
  }
}

function closeKeywordsModal() {
  const modal = document.getElementById("keywords-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

let activeKeywords = [];

async function loadKeywords() {
  try {
    const response = await fetch("/api/keywords", { method: "GET" });
    const data = await response.json();

    if (data.success && data.keywords) {
      activeKeywords = [...data.keywords];
      renderKeywordChips();
      console.log("✅ Keywords loaded:", data.keywords.length, "keywords");
    } else {
      console.error("❌ Failed to load keywords:", data.message);
      showToast("Failed to load keywords", "error");
    }
  } catch (error) {
    console.error("❌ Error loading keywords:", error);
    showToast("Error loading keywords: " + error.message, "error");
  }
}

function renderKeywordChips() {
  const container = document.getElementById("keywords-container");
  const countEl = document.getElementById("keywords-count");
  if (!container) return;
  
  container.innerHTML = "";
  
  if (activeKeywords.length === 0) {
    container.innerHTML = '<span class="text-gray-400 text-sm italic py-2">No keywords added yet.</span>';
  } else {
    activeKeywords.forEach((kw, index) => {
      const chip = document.createElement("div");
      chip.className = "flex items-center gap-1 bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded-full text-sm shadow-sm transition hover:bg-gray-50";
      chip.innerHTML = `
        <span class="font-medium">${kw}</span>
        <button class="text-gray-400 hover:text-red-500 ml-1 cursor-pointer focus:outline-none transition font-bold" onclick="removeKeyword(${index})" title="Remove">✕</button>
      `;
      container.appendChild(chip);
    });
  }
  
  if (countEl) countEl.textContent = activeKeywords.length;
}

function addKeywordFromInput() {
  const input = document.getElementById("new-keyword-input");
  if (!input) return;
  addKeyword(input.value);
  input.value = "";
  input.focus();
}

function addKeyword(keywordStr) {
  const kw = keywordStr.trim();
  if (!kw) return;
  
  // Validation for duplicates
  if (activeKeywords.map(k => k.toLowerCase()).includes(kw.toLowerCase())) {
    showToast(`Keyword "${kw}" already exists.`, "warning");
    return;
  }
  
  activeKeywords.push(kw);
  renderKeywordChips();
}

function removeKeyword(index) {
  activeKeywords.splice(index, 1);
  renderKeywordChips();
}

async function saveKeywords() {
  try {
    if (activeKeywords.length === 0) {
      showToast("Please enter at least one keyword", "warning");
      return;
    }

    // Send to backend
    const response = await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: activeKeywords }),
    });

    const data = await response.json();

    if (data.success) {
      console.log("✅ Keywords saved successfully:", activeKeywords.length);
      showToast(
        `✅ Saved ${activeKeywords.length} keywords successfully!`,
        "success",
      );
      closeKeywordsModal();
      
      const wizardCount = document.getElementById("wizard-keywords-count");
      if (wizardCount) wizardCount.textContent = `${activeKeywords.length} words`;
    } else {
      console.error("❌ Failed to save keywords:", data.message);
      showToast("Failed to save keywords: " + data.message, "error");
    }
  } catch (error) {
    console.error("❌ Error saving keywords:", error);
    showToast("Error saving keywords: " + error.message, "error");
  }
}

// ================================================================
// EMAIL TEMPLATES MANAGEMENT MODAL SYSTEM
// Allow users to create and manage email templates with variations
// ================================================================

function openTemplatesModal() {
  const modal = document.getElementById("templates-modal");
  if (modal) {
    modal.classList.remove("hidden");
    loadTemplates(); // Fetch and display templates
  }
}

function closeTemplatesModal() {
  const modal = document.getElementById("templates-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
  // Hide form if open
  const form = document.getElementById("template-form");
  if (form) {
    form.classList.add("hidden");
  }
}

function toggleTemplateForm() {
  const form = document.getElementById("template-form");
  if (form) {
    form.classList.toggle("hidden");
    // Clear form when toggling
    if (!form.classList.contains("hidden")) {
      document.getElementById("template-name-input").value = "";
      document.getElementById("template-subject-input").value = "";
      document.getElementById("template-body-input").value = "";
    }
  }
}

let loadedTemplates = [];

async function loadTemplates() {
  try {
    const response = await fetch("/api/templates", { method: "GET" });
    const data = await response.json();

    if (data.success && data.templates) {
      loadedTemplates = data.templates;
      renderTemplatesList();
      console.log("✅ Templates loaded:", data.templates.length, "templates");
    } else {
      console.error("❌ Failed to load templates:", data.message);
      showToast("Failed to load templates", "error");
    }
  } catch (error) {
    console.error("❌ Error loading templates:", error);
    showToast("Error loading templates: " + error.message, "error");
  }
}

function renderTemplatesList() {
  const listContainer = document.getElementById("templates-list");
  if (!listContainer) return;

  const searchInput = document.getElementById("template-search-input");
  const query = searchInput ? searchInput.value.toLowerCase() : "";

  listContainer.innerHTML = ""; // Clear existing

  const filtered = loadedTemplates.filter(t => 
    t.name.toLowerCase().includes(query) || 
    t.preview_subject.toLowerCase().includes(query) ||
    t.preview_body.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    listContainer.innerHTML = '<div class="text-sm text-gray-500 italic py-4 text-center">No templates match your search.</div>';
    return;
  }

  filtered.forEach((template) => {
        const templateEl = document.createElement("div");
        templateEl.className =
          "border rounded p-4 bg-gray-50 hover:bg-gray-100 transition cursor-pointer";

        templateEl.innerHTML = `
          <div class="flex justify-between items-start mb-2">
            <div class="flex-1 cursor-pointer" onclick="openEditTemplateModal(${template.id})">
              <h4 class="font-semibold hover:text-blue-600">${escapeHtml(template.name)}</h4>
              <div class="text-xs text-gray-600 mt-1">
                <div><strong>Subject Preview:</strong> ${escapeHtml(template.preview_subject)}</div>
              </div>
              <div class="text-xs text-gray-500 mt-2">
                <span class="italic">👆 Click to edit template details</span>
              </div>
            </div>
            <div class="flex gap-2 ml-4">
              <button
                class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition font-medium"
                onclick="event.stopPropagation(); duplicateTemplate(${template.id})"
                title="Duplicate this template"
              >
                📋 Duplicate
              </button>
              <button
                class="text-xs px-2 py-1 ${template.active ? "bg-green-200 text-green-800" : "bg-gray-300 text-gray-700"} rounded hover:opacity-75"
                onclick="toggleTemplateActive(${template.id}, ${!template.active})"
                title="${template.active ? "Click to deactivate" : "Click to activate"}"
              >
                ${template.active ? "✓ Active" : "✗ Inactive"}
              </button>
              <button
                class="text-xs px-2 py-1 bg-red-200 text-red-800 rounded hover:bg-red-300"
                onclick="deleteTemplate(${template.id}, '${escapeHtml(template.name).replace(/'/g, "&apos;")}')"
                title="Delete this template"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        `;

        listContainer.appendChild(templateEl);
      });
}

function filterTemplates() {
  renderTemplatesList();
}

async function duplicateTemplate(id) {
  try {
    const response = await fetch(`/api/templates/${id}`);
    const data = await response.json();
    
    if (data.success && data.template) {
      const t = data.template;
      // Show new form
      const form = document.getElementById("template-form");
      if (form) form.classList.remove("hidden");
      
      // Pre-fill
      document.getElementById("template-name-input").value = t.name + " (Copy)";
      document.getElementById("template-subject-input").value = t.subject;
      document.getElementById("template-body-input").value = t.body;
      
      // Scroll to form
      form.scrollIntoView({ behavior: 'smooth' });
    }
  } catch(e) {
    console.error(e);
    showToast("Error duplicating template", "error");
  }
}

async function sendTestEmail() {
  const emailInput = document.getElementById("test-email-address");
  const subjectStr = document.getElementById("edit-template-subject").value;
  const bodyStr = document.getElementById("edit-template-body").value;
  
  if (!emailInput || !emailInput.value) {
    showToast("Please enter a test email address", "warning");
    return;
  }
  
  const originalBtnText = event.target.textContent;
  event.target.textContent = "Sending...";
  event.target.disabled = true;
  
  try {
    const response = await fetch("/api/templates/test_email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to_email: emailInput.value,
        subject: subjectStr,
        body: bodyStr
      })
    });
    
    const data = await response.json();
    if (data.success) {
      showToast("Test email sent successfully!", "success");
    } else {
      showToast(data.message || "Failed to send test email", "error");
    }
  } catch(e) {
    console.error(e);
    showToast("Error sending test email", "error");
  } finally {
    event.target.textContent = originalBtnText;
    event.target.disabled = false;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function saveNewTemplate() {
  try {
    const name = document.getElementById("template-name-input").value.trim();
    const subject = document
      .getElementById("template-subject-input")
      .value.trim();
    const body = document.getElementById("template-body-input").value.trim();

    if (!name || !subject || !body) {
      showToast("All fields are required", "warning");
      return;
    }

    const response = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, subject, body }),
    });

    const data = await response.json();

    if (data.success) {
      console.log("✅ Template saved successfully");
      showToast("✅ Template created successfully!", "success");
      toggleTemplateForm(); // Hide form
      loadTemplates(); // Reload list
    } else {
      console.error("❌ Failed to save template:", data.error);
      showToast("Failed to save template: " + data.error, "error");
    }
  } catch (error) {
    console.error("❌ Error saving template:", error);
    showToast("Error saving template: " + error.message, "error");
  }
}

// ================================================================
// EDIT TEMPLATE MODAL SYSTEM
// ================================================================

function openEditTemplateModal(templateId) {
  const modal = document.getElementById("edit-template-modal");
  if (modal) {
    modal.classList.remove("hidden");
    loadTemplateForEditing(templateId);
  }
}

function closeEditTemplateModal() {
  const modal = document.getElementById("edit-template-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

async function loadTemplateForEditing(templateId) {
  try {
    const response = await fetch(`/api/templates/${templateId}`);
    const data = await response.json();

    if (data.success && data.template) {
      const template = data.template;

      // Store template ID for later use
      document.getElementById("edit-template-modal").dataset.templateId =
        templateId;

      // Fill form fields
      document.getElementById("edit-template-name").value = template.name || "";
      document.getElementById("edit-template-subject").value =
        template.subject || "";
      document.getElementById("edit-template-body").value = template.body || "";
      document.getElementById("edit-template-active").checked =
        template.active !== false;

      // Add event listeners for live preview
      document
        .getElementById("edit-template-subject")
        .addEventListener("input", updateEditPreview);
      document
        .getElementById("edit-template-body")
        .addEventListener("input", updateEditPreview);
      document
        .getElementById("edit-template-name")
        .addEventListener("input", updateEditPreview);

      // Update preview
      updateEditPreview();

      console.log("✅ Template loaded for editing:", template.id);
    } else {
      console.error("❌ Failed to load template:", data.error);
      showToast("Failed to load template", "error");
      closeEditTemplateModal();
    }
  } catch (error) {
    console.error("❌ Error loading template:", error);
    showToast("Error loading template: " + error.message, "error");
    closeEditTemplateModal();
  }
}

function updateEditPreview() {
  const subject = document.getElementById("edit-template-subject").value;
  const body = document.getElementById("edit-template-body").value;

  // Replace {channel_name} with sample value for preview
  const previewSubject = subject.replace(/{channel_name}/g, "Sample Channel");
  const previewBody = body.replace(/{channel_name}/g, "Sample Channel");

  // Update preview elements
  const previewSubjectEl = document.getElementById("edit-preview-subject");
  const previewBodyEl = document.getElementById("edit-preview-body");

  if (previewSubjectEl) {
    previewSubjectEl.textContent = previewSubject || "(empty)";
  }

  if (previewBodyEl) {
    previewBodyEl.textContent = previewBody || "(empty)";
  }
}

async function saveEditedTemplate() {
  try {
    const modal = document.getElementById("edit-template-modal");
    const templateId = modal.dataset.templateId;

    const name = document.getElementById("edit-template-name").value.trim();
    const subject = document
      .getElementById("edit-template-subject")
      .value.trim();
    const body = document.getElementById("edit-template-body").value.trim();
    const active = document.getElementById("edit-template-active").checked;

    if (!name || !subject || !body) {
      showToast("All fields are required", "warning");
      return;
    }

    const response = await fetch(`/api/templates/${templateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, subject, body, active }),
    });

    const data = await response.json();

    if (data.success) {
      console.log("✅ Template updated successfully");
      showToast("✅ Template updated successfully!", "success");
      closeEditTemplateModal();
      loadTemplates(); // Reload list
    } else {
      console.error("❌ Failed to save template:", data.error);
      showToast("Failed to save template: " + data.error, "error");
    }
  } catch (error) {
    console.error("❌ Error saving template:", error);
    showToast("Error saving template: " + error.message, "error");
  }
}

// ================================================================
// DELETE TEMPLATE MODAL SYSTEM
// ================================================================

function openDeleteTemplateModal(templateId, templateName) {
  const modal = document.getElementById("delete-template-modal");
  if (modal) {
    // Store template ID for later use
    modal.dataset.templateId = templateId;
    // Display template name in confirmation
    document.getElementById("delete-template-name").textContent = templateName;
    modal.classList.remove("hidden");
  }
}

function closeDeleteTemplateModal() {
  const modal = document.getElementById("delete-template-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

async function confirmDeleteTemplate() {
  try {
    const modal = document.getElementById("delete-template-modal");
    const templateId = modal.dataset.templateId;

    const response = await fetch(`/api/templates/${templateId}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (data.success) {
      console.log("✅ Template deleted successfully");
      showToast("✅ Template deleted successfully!", "success");
      closeDeleteTemplateModal();
      loadTemplates(); // Reload list
    } else {
      console.error("❌ Failed to delete template:", data.error);
      showToast("Failed to delete template", "error");
    }
  } catch (error) {
    console.error("❌ Error deleting template:", error);
    showToast("Error deleting template: " + error.message, "error");
  }
}

// Old functions (keeping for backward compatibility, but replaced)
async function editTemplate(templateId) {
  openEditTemplateModal(templateId);
}

async function deleteTemplate(templateId, templateName) {
  openDeleteTemplateModal(templateId, templateName);
}

async function toggleTemplateActive(templateId, newActive) {
  try {
    // First fetch the template
    const getResponse = await fetch(`/api/templates/${templateId}`);
    const getData = await getResponse.json();

    if (!getData.success) {
      showToast("Failed to fetch template", "error");
      return;
    }

    const template = getData.template;

    // Then update with new active status
    const response = await fetch(`/api/templates/${templateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: template.name,
        subject: template.subject,
        body: template.body,
        active: newActive,
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Template ${newActive ? "activated" : "deactivated"}`);
      showToast(
        `✅ Template ${newActive ? "activated" : "deactivated"}!`,
        "success",
      );
      loadTemplates(); // Reload list
    } else {
      console.error("❌ Failed to update template:", data.error);
      showToast("Failed to update template", "error");
    }
  } catch (error) {
    console.error("❌ Error toggling template:", error);
    showToast("Error toggling template: " + error.message, "error");
  }
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

  // ✨ CHECK FOR ERRORS FIRST
  if (status.error) {
    console.log("🔴 Error detected in discovery status:", status.error_type);
    console.log("Error details:", status.error_details);

    // Show error modal with details
    if (status.error_details) {
      showErrorModal(status.error_details);
    } else {
      console.warn("Error flag set but no error_details provided");
    }

    // Update status indicator - with null check
    const indicator = document.getElementById("discovery-indicator");
    if (indicator) {
      indicator.className = "w-3 h-3 bg-red-500 rounded-full";
    }

    // Update status text - with null check
    const statusText = document.getElementById("discovery-status-text");
    if (statusText) {
      statusText.textContent = `Error: ${status.error_type || "Discovery failed"}`;
    }

    // Hide progress sections on error - with null checks
    const progressSection = document.getElementById(
      "discovery-progress-section",
    );
    if (progressSection) {
      progressSection.classList.add("hidden");
    }

    const logsSection = document.getElementById("discovery-logs-section");
    if (logsSection) {
      logsSection.classList.add("hidden");
    }

    // Show start button, hide stop button - with null checks
    const startBtn = document.getElementById("start-discovery-btn");
    if (startBtn) {
      startBtn.classList.remove("hidden");
    }

    const stopBtn = document.getElementById("stop-discovery-btn");
    if (stopBtn) {
      stopBtn.classList.add("hidden");
    }

    // Stop polling
    stopDiscoveryStatusPolling();
    return; // Exit early - don't update other UI elements
  }

  // ✅ No error - continue with normal update logic
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

    if (status.current_step === "completed") {
      indicator.className = "w-3 h-3 bg-blue-500 rounded-full";
      statusText.textContent = "✅ Discovery Completed";
      const added = status.new_leads_added || 0;
      const qualified = status.new_leads_qualified || 0;
      details.textContent = `Added ${added} leads, ${qualified} qualified - view analytics below`;
      showToast(
        `Discovery completed! ${added} leads added, ${qualified} qualified`,
        "success",
      );
      // Keep progress section visible to show final analytics

      // Refresh campaign progress stats and leads list
      setTimeout(() => {
        loadProgress(); // Update campaign progress (total leads, sent, pending)
        loadLeads(); // Reload leads table to show new discovered emails
      }, 1000); // Wait 1 second to ensure backend has persisted the data

      // Show next steps set
      const nextSteps = document.getElementById("discovery-next-steps");
      if (nextSteps) nextSteps.classList.remove("hidden");
    } else {
      statusText.textContent = "Ready to discover leads";
      details.textContent = "No discovery running";
      // Hide progress section
      document
        .getElementById("discovery-progress-section")
        .classList.add("hidden");

      // Hide next steps if not completed
      const nextSteps = document.getElementById("discovery-next-steps");
      if (nextSteps) nextSteps.classList.add("hidden");
    }

    // Update buttons
    document.getElementById("start-discovery-btn").classList.remove("hidden");
    document.getElementById("stop-discovery-btn").classList.add("hidden");

    // Stop polling
    stopDiscoveryStatusPolling();

    // Refresh the discovery wizard (config/quota) when discovery stops
    loadDiscoveryWizard();
  }

  // Update progress bar
  const progressBar = document.getElementById("discovery-progress-bar");
  if (progressBar) progressBar.style.width = `${status.progress}%`;

  // Update stats - with null checks
  const discoveryStep = document.getElementById("discovery-step");
  if (discoveryStep) {
    discoveryStep.textContent = status.current_step.replace("_", " ");
  }

  const discoveryPercent = document.getElementById("discovery-percent");
  if (discoveryPercent) {
    discoveryPercent.textContent = `${status.progress}%`;
  }

  const newChannelsFound = document.getElementById("new-channels-found");
  if (newChannelsFound) {
    newChannelsFound.textContent = status.new_channels_found || 0;
  }

  const newChannelsAnalyzed = document.getElementById("new-channels-analyzed");
  if (newChannelsAnalyzed) {
    newChannelsAnalyzed.textContent = status.new_channels_analyzed || 0;
  }

  const newLeadsAdded = document.getElementById("new-leads-added");
  if (newLeadsAdded) {
    newLeadsAdded.textContent = status.new_leads_added || 0;
  }

  const newLeadsQualified = document.getElementById("new-leads-qualified");
  if (newLeadsQualified) {
    newLeadsQualified.textContent = status.new_leads_qualified || 0;
  }

  // Update elapsed time - with null check
  if (status.start_time) {
    const start = new Date(status.start_time);
    const now = new Date();
    const elapsed = Math.floor((now - start) / 1000);
    const discoveryTime = document.getElementById("discovery-time");
    if (discoveryTime) {
      discoveryTime.textContent = `${elapsed}s`;
    }
  }

  // Update logs
  updateDiscoveryLogs(status.logs);

  // Refresh quota display each time discovery status updates
  if (document.getElementById("quota-details")) {
    loadQuotaStatus();
  }
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

async function startDiscovery(config = {}) {
  try {
    const response = await fetch("/api/discovery/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    const result = await response.json();

    if (result.success) {
      showToast("Discovery started! Check progress above.", "info");

      // Start polling after successful start
      fetchDiscoveryStatus();
      startDiscoveryStatusPolling();
    } else {
      showToast(result.error || "Failed to start discovery", "error");
    }
  } catch (error) {
    showToast("Error starting discovery", "error");
    console.error(error);
  }
}

async function confirmStartDiscovery() {
  try {
    // Load current config, keywords, and quota to summarize to user
    const [configRes, keywordsRes, quotaRes] = await Promise.all([
      fetch("/api/discovery/config"),
      fetch("/api/keywords"),
      fetch("/api/quota"),
    ]);

    const config = await configRes.json();
    const keywords = await keywordsRes.json();
    const quota = await quotaRes.json();

    const keywordCount =
      keywords.count || (keywords.keywords ? keywords.keywords.length : 0);
    const quotaText = quota.quota
      ? `${quota.quota.used}/${quota.quota.limit} (${Math.round(quota.quota.percentage)}%)`
      : "Unknown";

    const message =
      `You are about to start a discovery run with:\n` +
      `• Keywords: ${keywordCount}\n` +
      `• Region: ${config.default_region || "Any"}\n` +
      `• Language: ${config.default_language || "Any"}\n` +
      `• Subscribers: ${config.min_subscribers} - ${config.max_subscribers}\n` +
      `• Quota remaining: ${quotaText}\n\n` +
      `Discovery will run in the background and won\'t block the UI. Continue?`;

    showConfirmModal(
      "Confirm Discovery",
      message,
      "Start Discovery",
      "Cancel",
      () => startDiscovery(config),
    );
  } catch (error) {
    console.error("Error preparing discovery confirmation:", error);
    showToast("Unable to prepare discovery confirmation", "error");
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
      loadDiscoveryWizard();
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
    const isContacted = lead.contacted;
    const emailSanitized = (lead.email || Math.random().toString()).replace(/[^a-zA-Z0-9]/g, '-');
    
    // Main Row
    const mainRow = document.createElement("tr");
    mainRow.className = "table-row border-b border-gray-100 hover:bg-gray-50 transition";
    mainRow.innerHTML = `
      <td class="table-cell">
        <input 
          type="checkbox" 
          class="lead-checkbox checkbox-custom" 
          data-email="${lead.email}" 
          ${isContacted ? "disabled" : ""}>
      </td>
      <td class="table-cell font-medium cursor-pointer text-blue-600 hover:text-blue-800 flex items-center gap-1" onclick="toggleDetails('${emailSanitized}')">
        <span class="text-xs">▶</span> ${lead.channel_name || 'N/A'}
      </td>
      <td class="table-cell text-sm text-gray-600">${lead.email || 'N/A'}</td>
      <td class="table-cell text-sm">${Number(lead.subscribers || 0).toLocaleString()}</td>
      <td class="table-cell text-sm">${Number(lead.avg_views || 0).toLocaleString()}</td>
      <td class="table-cell text-sm font-semibold text-indigo-600">${lead.score || 0}</td>
      <td class="table-cell text-sm"><span class="px-2 py-1 bg-gray-100 rounded-full">${lead.niche || 'N/A'}</span></td>
      <td class="table-cell text-sm text-gray-500">${lead.country || 'N/A'}</td>
      <td class="table-cell">
        <span class="${isContacted ? "badge-sent" : "badge-pending"} text-xs">
          ${isContacted ? "✓ Sent" : "⏳ Pending"}
        </span>
      </td>
      <td class="table-cell text-center">
        <button
          data-email="${lead.email}"
          data-channel="${lead.channel_name}"
          class="${isContacted ? "btn-secondary" : "btn-primary"} px-3 py-1 text-xs"
          ${isContacted ? "disabled" : ""}>
          ${isContacted ? "Sent" : "Send"}
        </button>
      </td>
    `;
    
    // Detail Row
    const detailRow = document.createElement("tr");
    detailRow.id = `detail-${emailSanitized}`;
    detailRow.className = "hidden bg-blue-50/30 border-b border-gray-200";
    
    const channelLink = lead.channel_link && lead.channel_link !== 'N/A' 
      ? lead.channel_link 
      : (lead.channel_id && lead.channel_id !== 'N/A' && lead.channel_id !== '' 
          ? `https://youtube.com/channel/${lead.channel_id}` 
          : `https://www.youtube.com/results?search_query=${encodeURIComponent(lead.channel_name)}`);
      
    detailRow.innerHTML = `
      <td colspan="10" class="p-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 class="font-semibold text-gray-700 mb-2">Channel Description</h4>
            <div class="text-gray-600 bg-white p-3 border rounded overflow-y-auto max-h-32 mb-3 text-xs leading-relaxed shadow-sm">
              ${lead.about_snippet || 'No description available.'}
            </div>
            
            <a href="${channelLink}" target="_blank" class="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 transition">
               🔗 Open Channel on YouTube
            </a>
          </div>
          <div>
            <div class="grid grid-cols-2 gap-3 mb-3">
              <div class="bg-white p-3 border rounded shadow-sm text-xs">
                <span class="block text-gray-500 mb-1">Total Views</span>
                <span class="font-semibold text-gray-800 text-sm">${Number(lead.total_views || 0).toLocaleString()}</span>
              </div>
              <div class="bg-white p-3 border rounded shadow-sm text-xs">
                <span class="block text-gray-500 mb-1">Video Count</span>
                <span class="font-semibold text-gray-800 text-sm">${Number(lead.video_count || 0).toLocaleString()}</span>
              </div>
              <div class="bg-white p-3 border rounded shadow-sm text-xs">
                <span class="block text-gray-500 mb-1">Uploads/Week</span>
                <span class="font-semibold text-indigo-600 text-sm">${Number(lead.upload_freq || 0).toFixed(1)}</span>
              </div>
              <div class="bg-white p-3 border rounded shadow-sm text-xs">
                <span class="block text-gray-500 mb-1">Target Score</span>
                <span class="font-bold text-green-600 text-sm">${lead.score || 0}<span class="text-gray-400 font-normal">/100</span></span>
              </div>
            </div>
            
          </div>
          </div>
        </div>
      </td>
    `;
    
    tbody.appendChild(mainRow);
    tbody.appendChild(detailRow);

    const button = mainRow.querySelector("button[data-email]");
    if (button && !isContacted) {
      button.addEventListener("click", function () {
        sendSingleEmail(this.dataset.email, this.dataset.channel, this);
      });
    }
  });

  updateSelectAll();
  updateSelectedCount();
}

function toggleDetails(emailSanitized) {
  const detailRow = document.getElementById(`detail-${emailSanitized}`);
  if (detailRow) {
    detailRow.classList.toggle('hidden');
    // Simple rotation animation for the caret
    const prevRow = detailRow.previousElementSibling;
    if (prevRow) {
      const caret = prevRow.querySelector('td:nth-child(2) span');
      if (caret) {
        caret.textContent = detailRow.classList.contains('hidden') ? '▶' : '▼';
      }
    }
  }
}

// Download Filtered CSV functionality
function downloadFilteredCSV() {
  if (filteredLeads.length === 0) {
    showToast("No leads matching filters to download.", "warning");
    return;
  }
  
  // Expose extended fields to CSV downloaded from UI
  const headers = ['channel_name', 'subscribers', 'avg_views', 'email', 'score', 'niche', 'country', 'status', 'channel_link'];
  
  const csvRows = [headers.join(',')];
  
  filteredLeads.forEach(lead => {
    const row = [
      `"${(lead.channel_name || '').replace(/"/g, '""')}"`,
      lead.subscribers || 0,
      lead.avg_views || 0,
      `"${(lead.email || '').replace(/"/g, '""')}"`,
      lead.score || 0,
      `"${(lead.niche || '').replace(/"/g, '""')}"`,
      `"${(lead.country || 'N/A').replace(/"/g, '""')}"`,
      lead.contacted ? 'Sent' : 'Pending',
      `"${(lead.channel_link || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });
  
  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  let filename = 'leads_export';
  if (activeFilter !== 'all') filename += `_${activeFilter}`;
  if (activeTags.has('high-score')) filename += '_highscore';
  filename += '.csv';
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Tag/Pill toggling
function toggleTag(tag) {
  const btn = document.getElementById(`tag-${tag}`);
  if (activeTags.has(tag)) {
    activeTags.delete(tag);
    btn.classList.remove('bg-blue-100', 'border-blue-300', 'text-blue-800');
    btn.classList.add('bg-white', 'border-gray-300', 'text-gray-600');
    btn.dataset.active = "false";
  } else {
    activeTags.add(tag);
    btn.classList.remove('bg-white', 'border-gray-300', 'text-gray-600');
    btn.classList.add('bg-blue-100', 'border-blue-300', 'text-blue-800');
    btn.dataset.active = "true";
  }
  applyFilters();
}

// Column sorting handler
function handleSort(key) {
  let direction = 'asc';
  if (sortConfig.key === key && sortConfig.direction === 'asc') {
    direction = 'desc';
  }
  sortConfig = { key, direction };
  
  // Unset arrows securely
  document.querySelectorAll('th span[id^="sort-"]').forEach(el => el.textContent = '↕️');
  const sortIcon = document.getElementById(`sort-${key}`);
  if (sortIcon) sortIcon.textContent = direction === 'asc' ? '↑' : '↓';
  
  applyFilters();
}

// Combined filter function for search + status + tags + niche + sorting
function applyFilters() {
  const searchQuery = document.getElementById("search-input").value.toLowerCase();
  const nicheSelect = document.getElementById("filter-niche");
  const activeNiche = nicheSelect ? nicheSelect.value : "all";

  filteredLeads = leadsData.filter((lead) => {
    // 1. Apply status filter
    if (activeFilter === "pending" && lead.contacted) return false;
    if (activeFilter === "sent" && !lead.contacted) return false;

    // 2. Apply tag filters
    if (activeTags.has('high-score') && Number(lead.score || 0) <= 70) return false;
    if (activeTags.has('has-email') && (!lead.email || lead.email === 'N/A' || lead.email.trim() === '')) return false;

    // 3. Apply niche filter
    if (activeNiche !== "all" && lead.niche !== activeNiche) return false;

    // 4. Apply search filter
    const matchesSearch =
      (lead.email && lead.email.toLowerCase().includes(searchQuery)) ||
      (lead.channel_name && lead.channel_name.toLowerCase().includes(searchQuery));

    return matchesSearch;
  });

  // 5. Apply sorting
  if (sortConfig.key) {
    filteredLeads.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      // Handle numerical sort
      if (!isNaN(valA) && !isNaN(valB)) {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      }
      
      // Handle string sort
      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  } else {
    // Default sort: pending leads first, sent leads at end
    filteredLeads.sort((a, b) => {
      if (a.contacted !== b.contacted) {
        return a.contacted ? 1 : -1; // Pending (false) first, Sent (true) last
      }
      return String(a.email || '').localeCompare(String(b.email || ''));
    });
  }

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

// Load wizard info (config, keyword count, quota)
async function loadDiscoveryWizard() {
  try {
    const [configRes, keywordsRes, quotaRes] = await Promise.all([
      fetch("/api/discovery/config"),
      fetch("/api/keywords"),
      fetch("/api/quota"),
    ]);

    const config = await configRes.json();
    const keywords = await keywordsRes.json();
    const quota = await quotaRes.json();

    const keywordCount =
      keywords.count || (keywords.keywords ? keywords.keywords.length : 0);

    document.getElementById("wizard-keywords-count").textContent = keywordCount;
    document.getElementById("wizard-region").textContent =
      config.default_region || "Any";
    document.getElementById("wizard-language").textContent =
      config.default_language || "Any";
    document.getElementById("wizard-subs-range").textContent =
      `${config.min_subscribers} - ${config.max_subscribers}`;

    if (quota.quota) {
      document.getElementById("wizard-quota").textContent =
        `${quota.quota.used}/${quota.quota.limit} (${Math.round(quota.quota.percentage)}%)`;
    } else {
      document.getElementById("wizard-quota").textContent = "Unknown";
    }
  } catch (error) {
    console.error("Error loading discovery wizard info:", error);
  }
}

// Load and display API quota usage
async function loadQuotaStatus() {
  try {
    const response = await fetch("/api/quota");
    const data = await response.json();

    if (!data.success || !data.quota) {
      throw new Error(data.error || "Invalid quota response");
    }

    const quota = data.quota;
    const details = document.getElementById("quota-details");
    const bar = document.getElementById("quota-progress-bar");

    if (details) {
      details.textContent = `Used ${quota.used} / ${quota.limit} units (${Math.round(quota.percentage)}%). Last reset: ${quota.last_reset || "unknown"}`;
    }

    if (bar) {
      bar.style.width = `${Math.min(100, quota.percentage)}%`;
    }
  } catch (error) {
    console.error("Error loading quota status:", error);
    const details = document.getElementById("quota-details");
    if (details) {
      details.textContent = "Unable to load quota status.";
    }
  }
}

async function resetQuota() {
  try {
    const response = await fetch("/api/quota/reset", { method: "POST" });
    const data = await response.json();

    if (data.success) {
      showToast("Quota reset successfully", "success");
      loadQuotaStatus();
    } else {
      throw new Error(data.error || "Failed to reset quota");
    }
  } catch (error) {
    console.error("Error resetting quota:", error);
    showToast("Error resetting quota: " + error.message, "error");
  } finally {
    // Refresh all UI state after quota change
    loadDiscoveryWizard();
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

// ==========================================
// Help Modal Management
// ==========================================

function openHelpModal() {
  document.getElementById("help-modal").classList.remove("hidden");
}

function closeHelpModal() {
  document.getElementById("help-modal").classList.add("hidden");
}

// Initial load
loadLeads();
loadProgress();
loadQuotaStatus();
loadDiscoveryWizard();
