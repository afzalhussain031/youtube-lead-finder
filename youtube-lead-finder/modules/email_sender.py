import os
import smtplib
import time
import time
import csv
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables from a .env file (create one in the project root)
load_dotenv()

# Gmail credentials (set these in your .env file)
GMAIL_USER = os.getenv('GMAIL_USER') # Your Gmail address
GMAIL_APP_PASSWORD = os.getenv('GMAIL_APP_PASSWORD') # App Password from Google

# Email template (customize as needed)
SUBJECT_TEMPLATE = "Collaboration Opportunity:  Video Editing Services for {channel_name}"
BODY_TEMPLATE = """
Hi {channel_name} Team,

I hope this email finds you well. I'm reaching out because I admire your content on YouTube and believe we could collaborate on video editing work.

As a professional editor, I specialize in enhancing videos to boost engagement. If you're interested in outsourcing editing for your channel, I'd love to discuss how I can help.

Please let me know if you'd like to chat further!

Best regards, 
[Your Name]
[Your Contact Info]
[Your website/Portfolio, if any]
"""

def load_sent_emails():
    """Reads sent_log.csv and returns a set of already contacted emails."""
    sent_log_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'sent_log.csv')
    sent_emails = set()
    try:
        with open(sent_log_file, 'r', encoding='utf-8') as file:
            for line in file:
                email = line.strip()
                if email:
                    sent_emails.add(email)
    except FileNotFoundError:
        # If the file doesn't exist, return an empty set
        pass
    return sent_emails

def save_sent_email(email):
    """Appends the email to sent_log.csv."""
    sent_log_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'sent_log.csv')
    with open(sent_log_file, 'a', encoding='utf-8') as file:
        file.write(email + '\n')

def send_personalized_email(to_email, channel_name):
    """Senda personalized email to a single recipient."""
    try:
        # Set up the email
        msg = MIMEMultipart()
        msg['From'] = GMAIL_USER
        msg['To'] = to_email
        msg['Subject'] = SUBJECT_TEMPLATE.format(channel_name=channel_name)

        body = BODY_TEMPLATE.format(channel_name=channel_name)
        msg.attach(MIMEText(body, 'plain'))

        # Connect to Gmail SMTP
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls() #Secures the connection
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)

        # Send the email
        server.sendmail(GMAIL_USER, to_email, msg.as_string())
        server.quit()

        print(f"Email sent successfully to {to_email} for {channel_name}")
        return True
    except Exception as e:
        print(f"Failed to send email to {to_email}: {str(e)}")
        return False
    
def send_email_from_leads():
    """Read leads.csv and send emails to each lead individually."""
    leads_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'leads.csv')
    
    # Load already sent emails
    sent_emails = load_sent_emails()

    with open(leads_file, 'r', encoding='utf-8-sig') as file:
        reader = csv.DictReader(file)
        for row in reader:
            email = row['email'].strip()
            channel_name = row['channel_name'].strip()

            if email and channel_name:
                if email in sent_emails:
                    print(f"Skipping {email} (already contacted)")
                    continue
                success = send_personalized_email(email, channel_name)
                if success:
                    # Save the sent email
                    save_sent_email(email)
                    sent_emails.add(email)
                    time.sleep(2) # Delay to avoid rate limits (adjust as needed)
                else:
                    print(f"skipping {email} due to error.")

if __name__ == "__main__":
    send_email_from_leads()
