from flask import Blueprint, render_template, request, jsonify
from services.lead_services import load_leads
from services.email_services import send_personalized_email, load_sent_emails, save_sent_email
from services.discovery_service import discovery_service  # NEW
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