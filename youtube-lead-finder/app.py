from flask import Flask
from routes.dashboard import dashboard_bp

app = Flask(__name__, template_folder='templates', static_folder='static')

# Register the dashboard blueprint
app.register_blueprint(dashboard_bp)

if __name__ == "__main__":
    app.run(debug=True)