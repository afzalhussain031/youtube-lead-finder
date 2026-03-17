import os
import csv

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
LEADS_FILE = os.path.join(DATA_DIR, "leads.csv")

def load_sent_emails():
    """Reads sent_log.csv and returns a set of already contacted emails."""
    sent_log_file = os.path.join(DATA_DIR, "sent_log.csv")
    sent_emails = set()
    try:
        with open(sent_log_file, 'r', encoding='utf-8') as file:
            for line in file:
                email = line.strip()
                if email:
                    sent_emails.add(email)
    except FileNotFoundError:
        pass  # No log yet
    return sent_emails

def load_leads():
    """Loads leads from CSV and marks contacted status."""
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