from flask import Flask
from routes.dashboard import dashboard_bp
from services.discovery_service import discovery_service  # Initialize global instance

app = Flask(__name__, template_folder='templates', static_folder='static')

# Register the dashboard blueprint
app.register_blueprint(dashboard_bp)

if __name__ == "__main__":
    app.run(debug=True)