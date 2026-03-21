from flask import Flask
from routes.dashboard import dashboard_bp
from services.discovery_service import discovery_service  # Initialize global instance
from database.db_manager import DatabaseManager
from config import DB_PATH

app = Flask(__name__, template_folder='templates', static_folder='static')

# Ensure database tables exist so quota tracking and keywords work reliably
db_manager = DatabaseManager(DB_PATH)
db_manager.create_tables()

# Register the dashboard blueprint
app.register_blueprint(dashboard_bp)

if __name__ == "__main__":
    app.run(debug=True)


@app.route('/test-smtp-debug')
def test_smtp_debug():
    """Temporary endpoint to test SMTP connectivity in Render"""
    results = {}
    
    # Test 1: Can we reach smtp.gmail.com?
    try:
        import socket
        s = socket.create_connection(('smtp.gmail.com', 587), timeout=5)
        s.close()
        results['socket_connect'] = 'OK'
    except Exception as e:
        results['socket_connect'] = f'FAILED: {str(e)}'
    
    # Test 2: Can we authenticate?
    try:
        import smtplib
        from dotenv import load_dotenv
        import os
        
        load_dotenv()
        gmail_user = os.getenv('GMAIL_USER')
        gmail_pass = os.getenv('GMAIL_APP_PASSWORD')
        
        if not gmail_user or not gmail_pass:
            results['credentials'] = 'MISSING'
        else:
            server = smtplib.SMTP('smtp.gmail.com', 587, timeout=5)
            server.starttls()
            server.login(gmail_user, gmail_pass)
            server.quit()
            results['smtp_auth'] = 'OK'
    except Exception as e:
        results['smtp_auth'] = f'FAILED: {str(e)}'
    
    return results, 200