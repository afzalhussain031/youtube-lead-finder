import os
import csv
from flask import Flask, render_template_string, redirect, url_for
from modules.email_sender import send_email_from_leads, load_sent_emails

app = Flask(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
LEADS_FILE = os.path.join(DATA_DIR, "leads.csv")

# Simple HTML template (inline for minimal setup)
TEMPLATE = """
<!doctype html>
<title>Lead Dashboard</title>
<h1>YouTube Lead Dashboard</h1>

<h2>Leads</h2>
<table border="1" cellpadding="4" cellspacing="0">
  <tr><th>Email</th><th>Channel</th><th>Contacted?</th></tr>
  {% for lead in leads %}
  <tr>
    <td>{{ lead.email }}</td>
    <td>{{ lead.channel_name }}</td>
    <td>{{ '✅' if lead.contacted else '❌' }}</td>
  </tr>
  {% endfor %}
</table>

<form action="{{ url_for('send_email') }}" method="post">
  <button type="submit">Send Emails (new leads only)</button>
</form>
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
    return render_template_string(TEMPLATE, leads=load_leads())

@app.route("/send", methods=["POST"])
def send_email():
    # This will use the existing logic from email_sender.py
    send_email_from_leads()
    return redirect(url_for("index"))

if __name__ == "__main__":
    app.run(debug=True)