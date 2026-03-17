from flask import Blueprint, render_template, request, jsonify
from services.lead_services import load_leads
from services.email_services import send_personalized_email, load_sent_emails, save_sent_email

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
    for lead in leads:
        if not lead["contacted"]:
            success = send_personalized_email(lead["email"], lead["channel_name"])
            if success:
                save_sent_email(lead["email"])
                sent_count += 1
    return jsonify({"success": True, "message": f"Sent {sent_count} emails"})

@dashboard_bp.route("/send-selected", methods=["POST"])
def send_selected():
    data = request.get_json()
    emails = data.get("emails", [])
    sent = load_sent_emails()
    sent_count = 0
    for email in emails:
        if email not in sent:
            leads = load_leads()
            channel_name = next((l["channel_name"] for l in leads if l["email"] == email), "")
            success = send_personalized_email(email, channel_name)
            if success:
                save_sent_email(email)
                sent_count += 1
    return jsonify({"success": True, "message": f"Sent {sent_count} selected emails"})

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