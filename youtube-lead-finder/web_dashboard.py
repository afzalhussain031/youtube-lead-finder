import os
import csv
from flask import Flask, render_template_string, request, jsonify
from modules.email_sender import send_personalized_email, load_sent_emails, save_sent_email

app = Flask(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
LEADS_FILE = os.path.join(DATA_DIR, "leads.csv")

# HTML Template with Table, Buttons, Checkboxes, and Toasts
TEMPLATE = """
<!doctype html>
<title>Lead Dashboard</title>
<style>
  /* Toast Styles */
  .toast { position: fixed; top: 20px; right: 20px; background: #333; color: white; padding: 10px; border-radius: 5px; z-index: 1000; opacity: 0; transition: opacity 0.5s; }
  .toast.show { opacity: 1; }
  .toast.success { background: #4CAF50; }
  .toast.error { background: #f44336; }
  .toast.warning { background: #ff9800; }
  /* Button Styles */
  button:disabled { background: #ccc; cursor: not-allowed; }
  .loading { background: #ffeb3b; }
</style>

<h1>YouTube Lead Dashboard</h1>

<h2>Actions</h2>
<button id="send-all-btn" onclick="sendAllEmails()">Send Emails (All Unsent)</button>
<button id="send-selected-btn" onclick="sendSelectedEmails()">Send Selected</button>

<h2>Leads</h2>
<table border="1" cellpadding="4" cellspacing="0">
  <thead>
    <tr>
      <th><input type="checkbox" id="select-all"></th>
      <th>Email</th>
      <th>Channel</th>
      <th>Contacted?</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody id="lead-body">
    <tr><td colspan="5">Loading leads...</td></tr>
  </tbody>
</table>

<div id="toast-container"></div>

<script>
  let leadsData = [];  // Store leads for checkbox logic

  // Load leads and populate table
  async function loadLeads() {
    try {
      const response = await fetch('/api/leads');
      leadsData = await response.json();
      renderTable();
    } catch (error) {
      console.error('Error loading leads:', error);
      document.getElementById('lead-body').innerHTML = '<tr><td colspan="5">Error loading leads.</td></tr>';
    }
  }

  // Render table rows with checkboxes/buttons
  function renderTable() {
    const tbody = document.getElementById('lead-body');
    tbody.innerHTML = '';
    leadsData.forEach((lead, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><input type="checkbox" class="lead-checkbox" data-email="${lead.email}"></td>
        <td>${lead.email}</td>
        <td>${lead.channel_name}</td>
        <td>${lead.contacted ? '✅' : '❌'}</td>
        <td>
          <button 
            onclick="sendSingleEmail('${lead.email}', '${lead.channel_name}', this)" 
            ${lead.contacted ? 'disabled' : ''}>
            ${lead.contacted ? 'Sent' : 'Send Email'}
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
    updateSelectAll();
  }

  // Handle select-all checkbox
  document.getElementById('select-all').addEventListener('change', function() {
    const checkboxes = document.querySelectorAll('.lead-checkbox');
    checkboxes.forEach(cb => cb.checked = this.checked);
  });

  // Update select-all based on individual checkboxes
  function updateSelectAll() {
    const checkboxes = document.querySelectorAll('.lead-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    document.getElementById('select-all').checked = allChecked;
  }

  // Send single email
  async function sendSingleEmail(email, channelName, button) {
    button.textContent = 'Sending...';
    button.disabled = true;
    button.classList.add('loading');
    try {
      const response = await fetch('/send-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, channel_name: channelName })
      });
      const result = await response.json();
      if (result.success) {
        showToast(`Email sent to ${email} ✅`, 'success');
        await loadLeads();  // Refresh table
      } else {
        showToast(result.message || 'Failed to send email', 'error');
        button.textContent = 'Send Email';
        button.disabled = false;
        button.classList.remove('loading');
      }
    } catch (error) {
      showToast('Error sending email', 'error');
      button.textContent = 'Send Email';
      button.disabled = false;
      button.classList.remove('loading');
    }
  }

  // Send all unsent emails
  async function sendAllEmails() {
    const btn = document.getElementById('send-all-btn');
    btn.textContent = 'Sending...';
    btn.disabled = true;
    try {
      const response = await fetch('/send-all', { method: 'POST' });
      const result = await response.json();
      showToast(result.message, result.success ? 'success' : 'error');
      await loadLeads();  // Refresh
    } catch (error) {
      showToast('Error sending emails', 'error');
    } finally {
      btn.textContent = 'Send Emails (All Unsent)';
      btn.disabled = false;
    }
  }

  // Send selected emails
  async function sendSelectedEmails() {
    const selected = Array.from(document.querySelectorAll('.lead-checkbox:checked')).map(cb => cb.dataset.email);
    if (selected.length === 0) {
      showToast('No leads selected', 'warning');
      return;
    }
    const btn = document.getElementById('send-selected-btn');
    btn.textContent = 'Sending...';
    btn.disabled = true;
    try {
      const response = await fetch('/send-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: selected })
      });
      const result = await response.json();
      showToast(result.message, result.success ? 'success' : 'error');
      await loadLeads();  // Refresh
    } catch (error) {
      showToast('Error sending selected emails', 'error');
    } finally {
      btn.textContent = 'Send Selected';
      btn.disabled = false;
    }
  }

  // Show toast notification
  function showToast(message, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => container.removeChild(toast), 500);
    }, 3000);
  }

  // Initial load
  loadLeads();
</script>
"""

def load_leads():
    leads = []
    sent = load_sent_emails()
    with open(LEADS_FILE, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            leads.append({
                "email": row["email"].strip(),
                "channel_name": row["channel_name"].strip(),
                "contacted": row["email"].strip() in sent,
            })
    return leads

@app.route("/")
def index():
    return render_template_string(TEMPLATE)

# API to get leads
@app.route("/api/leads")
def api_leads():
    return jsonify(load_leads())

# Send single email
@app.route("/send-single", methods=["POST"])
def send_single():
    data = request.get_json()
    email = data.get("email")
    channel_name = data.get("channel_name")
    sent = load_sent_emails()
    if email in sent:
        return jsonify({"success": False, "message": f"Already contacted {email}"})
    success = send_personalized_email(email, channel_name)
    if success:
        save_sent_email(email)
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Failed to send email"})

# Send all unsent
@app.route("/send-all", methods=["POST"])
def send_all():
    leads = load_leads()
    sent_count = 0
    for lead in leads:
        if not lead["contacted"]:
            success = send_personalized_email(lead["email"], lead["channel_name"])
            if success:
                save_sent_email(lead["email"])
                sent_count += 1
    return jsonify({"success": True, "message": f"Sent {sent_count} emails"})

# Send selected
@app.route("/send-selected", methods=["POST"])
def send_selected():
    data = request.get_json()
    emails = data.get("emails", [])
    sent = load_sent_emails()
    sent_count = 0
    for email in emails:
        if email not in sent:
            # Find channel_name from leads
            leads = load_leads()
            channel_name = next((l["channel_name"] for l in leads if l["email"] == email), "")
            success = send_personalized_email(email, channel_name)
            if success:
                save_sent_email(email)
                sent_count += 1
    return jsonify({"success": True, "message": f"Sent {sent_count} selected emails"})

if __name__ == "__main__":
    app.run(debug=True)