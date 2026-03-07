import re
import logging

logger = logging.getLogger(__name__)

class EmailExtractor:
    def __init__(self):
        # Regex pattern for email extraction
        self.email_pattern = r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'

    def extract_emails(self, text):
        """Extract emails from text using regex."""
        try:
            emails = re.findall(self.email_pattern, text)
            # Remove duplicates while preserving order
            seen = set()
            unique_emails = []
            for email in emails:
                if email not in seen:
                    seen.add(email)
                    unique_emails.append(email)
            return unique_emails
        except Exception as e:
            logger.error(f"Error extracting emails: {e}")
            return []