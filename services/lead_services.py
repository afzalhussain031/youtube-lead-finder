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
            email = row.get("email", "").strip().lower()  # ✅ Normalize to lowercase
            
            lead_data = dict(row)
            lead_data["email"] = email
            lead_data["channel_name"] = row.get("channel_name", "").strip()
            lead_data["contacted"] = email in sent
            
            # Ensure defaults for expanded columns if missing in old CSV
            lead_data.setdefault("channel_id", "")
            lead_data.setdefault("total_views", 0)
            lead_data.setdefault("video_count", 0)
            lead_data.setdefault("upload_freq", 0)
            lead_data.setdefault("subscribers", 0)
            lead_data.setdefault("avg_views", 0)
            lead_data.setdefault("score", 0)
            lead_data.setdefault("niche", "N/A")
            lead_data.setdefault("country", "N/A")
            lead_data.setdefault("about_snippet", "N/A")
            lead_data.setdefault("channel_link", "N/A")
            lead_data.setdefault("extracted_emails", "N/A")

            leads.append(lead_data)
    return leads