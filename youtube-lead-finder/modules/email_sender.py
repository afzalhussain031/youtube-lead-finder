import os
import smtplib
import time
import csv
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import sys

# Add services directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from services.template_service import TemplateService

# Load environment variables from a .env file (create one in the project root)
load_dotenv()

# Gmail credentials - read at runtime (not cached)
def get_gmail_credentials():
    """Get Gmail credentials at runtime, allowing for dynamic updates."""
    return os.getenv('GMAIL_USER'), os.getenv('GMAIL_APP_PASSWORD')

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
    """Send a personalized email to a single recipient using dynamic templates."""
    try:
        # Get credentials at runtime
        gmail_user, gmail_password = get_gmail_credentials()
        
        if not gmail_user or not gmail_password:
            print(f"Error: Gmail credentials not configured")
            return False
        
        # Get a random template and personalize it
        template = TemplateService.get_random_template()
        if not template:
            print(f"Error: No templates found")
            return False
        
        personalized = TemplateService.personalize_template(template, channel_name)
        
        # Set up the email
        msg = MIMEMultipart()
        msg['From'] = gmail_user
        msg['To'] = to_email
        msg['Subject'] = personalized['subject']

        msg.attach(MIMEText(personalized['body'], 'plain'))

        # Connect to Gmail SMTP
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls() #Secures the connection
        server.login(gmail_user, gmail_password)

        # Send the email
        server.sendmail(gmail_user, to_email, msg.as_string())
        server.quit()

        print(f"Email sent successfully to {to_email} for {channel_name} [Template: {personalized['template_name']}]")
        return True
    except Exception as e:
        print(f"Failed to send email to {to_email}: {str(e)}")
        return False
        
def send_test_email(to_email, subject, body):
    """Send a test email with the provided subject and body directly."""
    try:
        # Get credentials at runtime
        gmail_user, gmail_password = get_gmail_credentials()
        
        if not gmail_user or not gmail_password:
            return {"success": False, "message": "Gmail credentials not configured"}
        
        # Set up the email
        msg = MIMEMultipart()
        msg['From'] = gmail_user
        msg['To'] = to_email
        msg['Subject'] = subject

        msg.attach(MIMEText(body, 'plain'))

        # Connect to Gmail SMTP
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls() #Secures the connection
        server.login(gmail_user, gmail_password)

        # Send the email
        server.sendmail(gmail_user, to_email, msg.as_string())
        server.quit()

        return {"success": True, "message": "Test email sent successfully"}
    except Exception as e:
        print(f"Failed to send test email to {to_email}: {str(e)}")
        return {"success": False, "message": str(e)}
    
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
