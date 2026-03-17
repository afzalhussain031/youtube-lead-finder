import os
import csv
from flask import Flask, render_template_string, redirect, url_for, jsonify
from modules.email_sender import send_email_from_leads, load_sent_emails

app = Flask(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
LEADS_FILE = os.path.join(DATA_DIR, "leads.csv")

# Simple in-memory log list (expand to read from file if needed)
app_logs = ["Dashboard started.", "Ready to send emails."]

# Updated HTML template with placeholders and JS
TEMPLATE = """
<!doctype html>
<title>Lead Dashboard</title>
<h1>YouTube Lead Dashboard</h1>

<h2>Stats</h2>
<p>Total Leads: <span id="total">Loading...</span></p>
<p>Sent: <span id="sent">Loading...</span></p>
<p>Pending: <span id="pending">Loading...</span></p>

<h2>Leads</h2>
<table border="1" cellpadding="4" cellspacing="0">
  <thead>
    <tr><th>Email</th><th>Channel</th><th>Contacted?</th></tr>
  </thead>
  <tbody id="lead-body">
    <tr><td colspan="3">Loading leads...</td></tr>
  </tbody>
</table>

<form action="{{ url_for('send_email') }}" method="post">
  <button type="submit">Send Emails (new leads only)</button>
</form>

<h2>Recent Logs</h2>
<div id="logs">Loading logs...</div>

<script>
  // Function to update leads table
  async function updateLeads() {
    try {
      const response = await fetch('/api/leads');
      const leads = await response.json();
      const tbody = document.getElementById('lead-body');
      tbody.innerHTML = '';  // Clear existing rows
      leads.forEach(lead => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${lead.email}</td>
          <td>${lead.channel_name}</td>
          <td>${lead.contacted ? '✅' : '❌'}</td>
        `;
        tbody.appendChild(row);
      });
    } catch (error) {
      console.error('Error updating leads:', error);
      document.getElementById('lead-body').innerHTML = '<tr><td colspan="3">Error loading leads.</td></tr>';
    }
  }

  // Function to update stats
  async function updateStats() {
    try {
      const response = await fetch('/api/stats');
      const stats = await response.json();
      document.getElementById('total').textContent = stats.total;
      document.getElementById('sent').textContent = stats.sent;
      document.getElementById('pending').textContent = stats.pending;
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  // Function to update logs
  async function updateLogs() {
    try {
      const response = await fetch('/api/logs');
      const logs = await response.json();
      const logsDiv = document.getElementById('logs');
      logsDiv.innerHTML = logs.map(log => `<p>${log}</p>`).join('');
    } catch (error) {
      console.error('Error updating logs:', error);
      document.getElementById('logs').innerHTML = '<p>Error loading logs.</p>';
    }
  }

  // Auto-refresh every 4 seconds
  setInterval(() => {
    updateLeads();
    updateStats();
    updateLogs();
  }, 4000);

  // Initial load
  updateLeads();
  updateStats();
  updateLogs();
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

@app.route("/send", methods=["POST"])
def send_email():
    # Trigger email sending and add a log entry
    send_email_from_leads()
    app_logs.append("Emails sent successfully.")
    return redirect(url_for("index"))

# New API routes
@app.route("/api/leads")
def api_leads():
    return jsonify(load_leads())

@app.route("/api/stats")
def api_stats():
    leads = load_leads()
    total = len(leads)
    sent = sum(1 for lead in leads if lead["contacted"])
    pending = total - sent
    return jsonify({"total": total, "sent": sent, "pending": pending})

@app.route("/api/logs")
def api_logs():
    # Return last 10 logs (expand to read from file)
    return jsonify(app_logs[-10:])

if __name__ == "__main__":
    app.run(debug=True)