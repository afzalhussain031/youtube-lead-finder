from flask import Blueprint, render_template, request, jsonify
from services.lead_services import load_leads
from services.email_services import send_personalized_email, load_sent_emails, save_sent_email
from services.discovery_service import discovery_service  # NEW
from services.template_service import TemplateService  # NEW
from api.youtube_api import YouTubeAPI
import os

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route("/")
def index():
    return render_template("index.html")

@dashboard_bp.route("/api/leads")
def api_leads():
    try:
        return jsonify(load_leads())
    except Exception as e:
        print(f"Error loading leads: {e}")
        return jsonify({"error": str(e)}), 500

@dashboard_bp.route("/send-single", methods=["POST"])
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

@dashboard_bp.route("/send-all", methods=["POST"])
def send_all():
    leads = load_leads()
    sent_count = 0
    logs = []  # ✅ Track logs
    for lead in leads:
        if not lead["contacted"]:
            success = send_personalized_email(lead["email"], lead["channel_name"])
            if success:
                save_sent_email(lead["email"])
                sent_count += 1
                # ✅ Log each successful send
                logs.append({
                    "email": lead["email"],
                    "channel_name": lead["channel_name"],
                    "status": "sent"
                })
    return jsonify({
        "success": True,
        "message": f"Sent {sent_count} emails",
        "logs": logs  # ✅ Return logs
    })

@dashboard_bp.route("/send-selected", methods=["POST"])
def send_selected():
    data = request.get_json()
    emails = data.get("emails", [])
    sent = load_sent_emails()
    sent_count = 0
    logs = []  # ✅ Track logs
    for email in emails:
        if email not in sent:
            leads = load_leads()
            channel_name = next((l["channel_name"] for l in leads if l["email"] == email), "")
            success = send_personalized_email(email, channel_name)
            if success:
                save_sent_email(email)
                sent_count += 1
                # ✅ Log each successful send
                logs.append({
                    "email": email,
                    "channel_name": channel_name,
                    "status": "sent"
                })
    return jsonify({
        "success": True,
        "message": f"Sent {sent_count} selected emails",
        "logs": logs  # ✅ Return logs
    })

@dashboard_bp.route("/api/progress")
def api_progress():
    leads = load_leads()
    sent = load_sent_emails()
    total_leads = len(leads)
    sent_count = len(sent)
    pending_count = total_leads - sent_count
    return jsonify({
        "total": total_leads,
        "sent": sent_count,
        "pending": pending_count,
        "percentage": (sent_count / total_leads * 100) if total_leads > 0 else 0
    })

# ============================================================
# DISCOVERY PIPELINE ROUTES (NEW)
# ============================================================

@dashboard_bp.route("/api/discovery/status")
def discovery_status():
    """Get current discovery status"""
    return jsonify(discovery_service.get_status())

@dashboard_bp.route("/api/discovery/start", methods=["POST"])
def start_discovery():
    """Start discovery pipeline with optional config overrides"""
    if discovery_service.get_status()['is_running']:
        return jsonify({"error": "Discovery already running"}), 400

    # Get config overrides from request
    config_overrides = request.get_json() or {}

    result = discovery_service.start_discovery(config_overrides)
    if 'error' in result:
        return jsonify(result), 400

    return jsonify(result)

@dashboard_bp.route("/api/discovery/stop", methods=["POST"])
def stop_discovery():
    """Stop running discovery"""
    result = discovery_service.stop_discovery()
    if 'error' in result:
        return jsonify(result), 400

    return jsonify(result)

@dashboard_bp.route("/api/discovery/config")
def get_discovery_config():
    """Get current discovery configuration"""
    from config import (
        MAX_RESULTS, MAX_WORKERS, MAX_CHANNELS_TO_PROCESS,
        DEFAULT_REGION, DEFAULT_LANGUAGE, MIN_SUBSCRIBERS, MAX_SUBSCRIBERS
    )

    return jsonify({
        'max_results': MAX_RESULTS,
        'max_workers': MAX_WORKERS,
        'max_channels': MAX_CHANNELS_TO_PROCESS,
        'default_region': DEFAULT_REGION,
        'default_language': DEFAULT_LANGUAGE,
        'min_subscribers': MIN_SUBSCRIBERS,
        'max_subscribers': MAX_SUBSCRIBERS
    })

@dashboard_bp.route("/api/discovery/config", methods=["POST"])
def update_discovery_config():
    """Update discovery configuration (for this session)"""
    # Note: This updates runtime config, not persistent config.py
    # For persistence, you'd need to modify config.py file

    config_updates = request.get_json()

    # Validate and apply temporary overrides
    # This is a simplified version - you'd want more validation

    # Update global config variables (temporary)
    if 'max_channels' in config_updates:
        import config
        config.MAX_CHANNELS_TO_PROCESS = config_updates['max_channels']

    return jsonify({"success": True, "message": "Configuration updated"})

# ============================================================
# ENVIRONMENT VARIABLES / CREDENTIALS ROUTES
# ============================================================

@dashboard_bp.route("/api/env", methods=["POST"])
def set_env_vars():
    """Save environment variables to .env file"""
    try:
        data = request.get_json() or {}
        allowed_keys = ["YOUTUBE_API_KEY", "GMAIL_USER", "GMAIL_APP_PASSWORD"]
        
        # Get path to .env file in youtube-lead-finder directory
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        env_path = os.path.join(project_root, ".env")
        
        # Load existing .env content
        existing_vars = {}
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, value = line.split("=", 1)
                        existing_vars[key.strip()] = value.strip()
        
        # Update with new values
        for key in allowed_keys:
            if key in data and data[key]:
                existing_vars[key] = data[key]
        
        # Write back to .env
        with open(env_path, "w", encoding="utf-8") as f:
            for key, value in existing_vars.items():
                f.write(f"{key}={value}\n")
        
        # Update runtime environment variables immediately
        for key in allowed_keys:
            if key in existing_vars:
                os.environ[key] = existing_vars[key]
        
        return jsonify({"success": True, "message": "Credentials saved successfully"})
    
    except Exception as e:
        print(f"Error saving .env file: {e}")
        return jsonify({"error": f"Failed to save credentials: {str(e)}"}), 500

@dashboard_bp.route("/api/env", methods=["GET"])
def get_env_vars():
    """Fetch saved environment variables"""
    try:
        allowed_keys = ["YOUTUBE_API_KEY", "GMAIL_USER", "GMAIL_APP_PASSWORD"]
        
        # Build response with current env vars
        credentials = {}
        for key in allowed_keys:
            value = os.getenv(key)
            credentials[key] = value if value else ""
        
        return jsonify(credentials)
    
    except Exception as e:
        print(f"Error fetching credentials: {e}")
        return jsonify({"error": f"Failed to fetch credentials: {str(e)}"}), 500

# ============================================================
# QUOTA / RATE LIMITING ROUTES
# ============================================================

@dashboard_bp.route("/api/quota", methods=["GET"])
def get_quota():
    """Return YouTube API quota usage status."""
    try:
        api = YouTubeAPI()
        return jsonify({"success": True, "quota": api.get_quota_status()})
    except Exception as e:
        print(f"Error fetching quota status: {e}")
        return jsonify({"error": f"Failed to fetch quota status: {str(e)}"}), 500


@dashboard_bp.route("/api/quota/reset", methods=["POST"])
def reset_quota():
    """Reset the quota usage tracking (manual override)."""
    try:
        api = YouTubeAPI()
        api.reset_quota()
        return jsonify({"success": True, "message": "Quota reset successfully", "quota": api.get_quota_status()})
    except Exception as e:
        print(f"Error resetting quota: {e}")
        return jsonify({"error": f"Failed to reset quota: {str(e)}"}), 500


# ============================================================
# KEYWORDS MANAGEMENT ROUTES
# ============================================================

@dashboard_bp.route("/api/keywords", methods=["GET"])
def get_keywords():
    """Fetch keywords from keywords.txt file"""
    try:
        keywords_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
            "data", 
            "keywords.txt"
        )
        
        keywords = []
        if os.path.exists(keywords_file):
            with open(keywords_file, 'r', encoding='utf-8') as f:
                # Read all lines, strip whitespace, filter empty lines
                keywords = [line.strip() for line in f if line.strip()]
        
        return jsonify({
            "success": True,
            "keywords": keywords,
            "count": len(keywords)
        })
    
    except Exception as e:
        print(f"Error fetching keywords: {e}")
        return jsonify({"error": f"Failed to fetch keywords: {str(e)}"}), 500

@dashboard_bp.route("/api/keywords", methods=["POST"])
def save_keywords():
    """Save keywords to keywords.txt file"""
    try:
        data = request.get_json() or {}
        keywords = data.get("keywords", [])
        
        # Validate input
        if not isinstance(keywords, list):
            return jsonify({"error": "Keywords must be a list"}), 400
        
        # Filter out empty strings and strip whitespace
        keywords = [kw.strip() for kw in keywords if kw.strip()]
        
        # Get path to keywords.txt
        keywords_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
            "data", 
            "keywords.txt"
        )
        
        # Write keywords to file (one per line)
        with open(keywords_file, 'w', encoding='utf-8') as f:
            for keyword in keywords:
                f.write(f"{keyword}\n")
        
        return jsonify({
            "success": True,
            "message": f"Saved {len(keywords)} keywords successfully",
            "count": len(keywords)
        })
    
    except Exception as e:
        print(f"Error saving keywords: {e}")
        return jsonify({"error": f"Failed to save keywords: {str(e)}"}), 500


# ============================================================
# EMAIL TEMPLATE MANAGEMENT ROUTES (NEW)
# Allow users to manage email templates with variations
# ============================================================

@dashboard_bp.route("/api/templates", methods=["GET"])
def get_templates():
    """Fetch all email templates for UI display."""
    try:
        templates = TemplateService.get_all_templates_for_ui()
        return jsonify({
            "success": True,
            "templates": templates,
            "count": len(templates)
        })
    except Exception as e:
        print(f"Error fetching templates: {e}")
        return jsonify({"error": f"Failed to fetch templates: {str(e)}"}), 500


@dashboard_bp.route("/api/templates/<int:template_id>", methods=["GET"])
def get_template(template_id):
    """Fetch a specific template by ID."""
    try:
        template = TemplateService.get_template_by_id(template_id)
        if not template:
            return jsonify({"error": "Template not found"}), 404
        
        return jsonify({
            "success": True,
            "template": template
        })
    except Exception as e:
        print(f"Error fetching template: {e}")
        return jsonify({"error": f"Failed to fetch template: {str(e)}"}), 500


@dashboard_bp.route("/api/templates", methods=["POST"])
def add_template():
    """Add a new email template."""
    try:
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        subject = data.get("subject", "").strip()
        body = data.get("body", "").strip()
        
        if not name or not subject or not body:
            return jsonify({"error": "Name, subject, and body are required"}), 400
        
        success = TemplateService.add_template(name, subject, body)
        if success:
            return jsonify({
                "success": True,
                "message": "Template added successfully"
            })
        else:
            return jsonify({"error": "Failed to save template"}), 500
    
    except Exception as e:
        print(f"Error adding template: {e}")
        return jsonify({"error": f"Failed to add template: {str(e)}"}), 500


@dashboard_bp.route("/api/templates/<int:template_id>", methods=["PUT"])
def update_template(template_id):
    """Update an existing template."""
    try:
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        subject = data.get("subject", "").strip()
        body = data.get("body", "").strip()
        active = data.get("active", True)
        
        if not name or not subject or not body:
            return jsonify({"error": "Name, subject, and body are required"}), 400
        
        success = TemplateService.update_template(template_id, name, subject, body, active)
        if success:
            return jsonify({
                "success": True,
                "message": "Template updated successfully"
            })
        else:
            return jsonify({"error": "Failed to update template"}), 500
    
    except Exception as e:
        print(f"Error updating template: {e}")
        return jsonify({"error": f"Failed to update template: {str(e)}"}), 500


@dashboard_bp.route("/api/templates/<int:template_id>", methods=["DELETE"])
def delete_template(template_id):
    """Delete a template."""
    try:
        success = TemplateService.delete_template(template_id)
        if success:
            return jsonify({
                "success": True,
                "message": "Template deleted successfully"
            })
        else:
            return jsonify({"error": "Failed to delete template"}), 500
    
    except Exception as e:
        print(f"Error deleting template: {e}")
        return jsonify({"error": f"Failed to delete template: {str(e)}"}), 500


@dashboard_bp.route("/api/templates/<int:template_id>/preview", methods=["GET"])
def preview_template(template_id):
    """Get a preview of a template with sample variations."""
    try:
        template = TemplateService.get_template_by_id(template_id)
        if not template:
            return jsonify({"error": "Template not found"}), 404
        
        # Create a preview by personalizing with sample data
        preview = TemplateService.personalize_template(
            template, 
            channel_name="Sample Channel"
        )
        
        return jsonify({
            "success": True,
            "preview": preview
        })
    
    except Exception as e:
        print(f"Error previewing template: {e}")
        return jsonify({"error": f"Failed to preview template: {str(e)}"}), 500