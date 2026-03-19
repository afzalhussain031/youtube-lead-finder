import json
import random
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
TEMPLATES_FILE = os.path.join(DATA_DIR, "email_templates.json")


class TemplateService:
    """Service for managing and processing email templates with variations."""

    @staticmethod
    def load_templates():
        """Load all templates from JSON file."""
        try:
            with open(TEMPLATES_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('templates', [])
        except FileNotFoundError:
            print(f"Templates file not found at {TEMPLATES_FILE}")
            return []
        except json.JSONDecodeError:
            print(f"Error parsing templates JSON")
            return []

    @staticmethod
    def save_templates(templates):
        """Save templates to JSON file."""
        try:
            data = {'templates': templates}
            with open(TEMPLATES_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving templates: {e}")
            return False

    @staticmethod
    def get_random_variation(text):
        """
        Given a text with variations separated by |, randomly pick one.
        Example: "Hi|Hello|Hey" -> randomly returns one of them
        """
        if not text or '|' not in text:
            return text
        
        variations = [v.strip() for v in text.split('|')]
        return random.choice(variations)

    @staticmethod
    def get_template_by_id(template_id):
        """Get a single template by ID."""
        templates = TemplateService.load_templates()
        for template in templates:
            if template['id'] == int(template_id):
                return template
        return None

    @staticmethod
    def get_random_template():
        """Get a random active template."""
        templates = TemplateService.load_templates()
        active_templates = [t for t in templates if t.get('active', True)]
        
        if not active_templates:
            # Fallback to first template if none active
            return templates[0] if templates else None
        
        return random.choice(active_templates)

    @staticmethod
    def personalize_template(template, channel_name, sender_name="Best regards"):
        """
        Create a personalized email from template with random variations.
        
        Args:
            template: Template dict with subject and body
            channel_name: Name of the channel being contacted
            sender_name: Name of the sender (optional)
        
        Returns:
            Dict with subject and body with variations randomized and placeholders replaced
        """
        if not template:
            return None

        # Get random variations for subject and body
        subject_with_variations = TemplateService.get_random_variation(
            template.get('subject', '')
        )
        body_with_variations = TemplateService.get_random_variation(
            template.get('body', '')
        )

        # Replace placeholders
        subject = subject_with_variations.format(
            channel_name=channel_name,
            sender_name=sender_name
        )
        body = body_with_variations.format(
            channel_name=channel_name,
            sender_name=sender_name
        )

        return {
            'subject': subject,
            'body': body,
            'template_id': template.get('id'),
            'template_name': template.get('name')
        }

    @staticmethod
    def get_all_templates_for_ui():
        """Get all templates formatted for UI display."""
        templates = TemplateService.load_templates()
        return [
            {
                'id': t['id'],
                'name': t['name'],
                'subject': t['subject'],
                'body': t['body'],
                'active': t.get('active', True),
                'preview_subject': TemplateService.get_random_variation(t['subject']).replace('{channel_name}', 'Channel Name'),
                'preview_body': TemplateService.get_random_variation(t['body']).replace('{channel_name}', 'Channel Name')[:100] + '...'
            }
            for t in templates
        ]

    @staticmethod
    def update_template(template_id, name, subject, body, active):
        """Update an existing template."""
        templates = TemplateService.load_templates()
        
        for template in templates:
            if template['id'] == int(template_id):
                template['name'] = name
                template['subject'] = subject
                template['body'] = body
                template['active'] = active
                break
        
        return TemplateService.save_templates(templates)

    @staticmethod
    def add_template(name, subject, body):
        """Add a new template."""
        templates = TemplateService.load_templates()
        
        # Generate new ID
        max_id = max([t['id'] for t in templates], default=0)
        new_id = max_id + 1
        
        new_template = {
            'id': new_id,
            'name': name,
            'subject': subject,
            'body': body,
            'active': True
        }
        
        templates.append(new_template)
        return TemplateService.save_templates(templates)

    @staticmethod
    def delete_template(template_id):
        """Delete a template by ID."""
        templates = TemplateService.load_templates()
        templates = [t for t in templates if t['id'] != int(template_id)]
        return TemplateService.save_templates(templates)
