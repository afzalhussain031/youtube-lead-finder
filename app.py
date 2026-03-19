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