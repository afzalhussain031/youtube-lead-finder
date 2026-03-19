import os
from modules.email_sender import send_personalized_email
from modules.email_sender import load_sent_emails

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

def save_sent_email(email):
    """Appends email to sent_log.csv if not already sent."""
    
    email = email.strip().lower()  # ✅ normalize
    sent_emails = load_sent_emails()  # ✅ fixed name

    if email in sent_emails:
        return False  # already exists
    sent_log_file = os.path.join(DATA_DIR, "sent_log.csv")

    with open(sent_log_file, 'a', encoding='utf-8') as file:
        file.write(email + '\n')

    return True  # successfully saved

# Note: send_personalized_email is imported from modules.email_sender
# (No changes needed here, as it's already modular)