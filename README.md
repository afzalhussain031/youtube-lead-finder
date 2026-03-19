<div align="center">
  <h1>🎯 YouTube Creator Lead Generation System</h1>
  <p><strong>A full-stack Flask web application that automatically discovers YouTube creators, qualifies them, extracts contact emails, and mass-sends personalized outreach emails directly from the dashboard.</strong></p>
  
  [![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
  [![YouTube API](https://img.shields.io/badge/YouTube%20API-v3-red.svg)](https://developers.google.com/youtube/v3)
  [![Flask](https://img.shields.io/badge/Framework-Flask-black.svg)](https://flask.palletsprojects.com/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
</div>

---

## 🚀 Overview

The original script-based YouTube crawler has been completely reimagined into a **beautiful, fully-functional web dashboard**. Built for content creators, marketers, and businesses, this app provides an end-to-end interface for finding high-quality YouTube influencers and launching outreach campaigns without ever touching a terminal.

### ✨ Key Features

- **🌐 Interactive Web Dashboard**: A slick, responsive UI built with Tailwind CSS and Vanilla JavaScript.
- **🌙 Native Dark Mode**: Toggle seamlessly between Light and Dark themes (persisted reliably via your browser's local storage).
- **🔍 Channel Discovery Wizard**: Configure keywords, regions, languages, and strict subscriber thresholds via a user-friendly modal to find the exact creators you want.
- **✉️ Integrated Mass Email Sender**: Connect your standard SMTP email credentials to write custom email templates and mass-send them simultaneously in the background (preventing the UI from freezing!)
- **📊 Live Progress Tracking**: Watch discovery pipelines and email sending queues operate in real-time with visual progress bars.
- **📉 API Quota Protection**: Avoid costly API bills! The app actively tracks your remaining Google YouTube Developer API Quota as a live dashboard metric and stops execution if you exhausted your daily limit.
- **🗂️ Data Export & Management**: Manage all valid leads in a searchable table. Delete leads, track which ones you've already contacted, or export identically to a `.csv` file.

## 📸 Dashboard Preview

*(Drop a screenshot of your web dashboard here!)*

---

## 🛠️ Installation & Setup

### 1. Prerequisites
- **Python 3.8+** installed on your system.
- A **YouTube Data API v3 key** (Get one from the [Google Cloud Console](https://console.cloud.google.com/)).
- Optional (for emailing): Ensure your Gmail or SMTP provider allows "App Passwords."

### 2. Clone the Repository
```bash
git clone https://github.com/yourusername/youtube-lead-finder.git
cd youtube-lead-finder
```

### 3. Create a Virtual Environment
```bash
python -m venv venv

# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Start the Web Server
Launch the Flask development server:
```bash
python app.py
```
> **Note:** The console output will say `Running on http://127.0.0.1:5000`. Open this exact URL in your browser to access the Web Dashboard!

---

## ⚙️ How to Use It

1. **Set Up Credentials**: In the web UI, click **"🔑 Configure Credentials"**. Enter your Google YouTube API Key and (optionally) your SMTP App Password to enable the mailing system.
2. **Launch the Discovery Wizard**: Click **"🚀 Start Discovery"**. Define your keywords (e.g., `tech reviews, unboxing`), select target regions/languages, and define minimum and maximum subscriber limits.
3. **Wait for Pipelines**: The backend scripts will rapidly search the API, navigate channel "About" pages to scrape for business emails, calculate a "Lead Quality Score", and inject the valid leads dynamically into the browser table.
4. **Mass Outreach**: Select leads using checkboxes, write a custom HTML message template with variables (e.g., `Hi {Channel Name}!`), and click **Send Selected**. The background threads will begin safely distributing the emails through your connected SMTP provider.

---

## 💾 Project Storage Structure

This app saves your operational data persistently in the `data/` directory so you never lose progress:
- `data/leads.csv` — Stores all structurally valid channels discovered by the pipeline.
- `data/sent_log.csv` — Retains the history of emails you have successfully dispatched to prevent double-messaging.
- `data/keywords.txt` — Maintains your custom lists of expansion seed keywords.
- *(Note: Legacy SQLite database references from the older CLI-only codebase are also stored here depending on your scraping preferences).*

---

## ☁️ Deployment Guide (Portfolio)

If you wish to deploy this app online so a recruiter or end-user can test the dashboard, it is structured to support easy cloud deployment:
1. **Host Options**: Use a free cloud hosting provider supporting Python WSGI (like **Render** or **PythonAnywhere**).
2. **Production Web Server**: Make sure your cloud provider uses `gunicorn` instead of `app.run()`. Add a `Start Command`: 
   ```bash
   gunicorn app:app
   ```
3. **Ephemeral Disks Warning**: Free cloud tiers (like Render) restart servers randomly. Any leads stored in the `data/*.csv` files will be wiped when the container sleeps unless you upgrade to a Persistent Volume disk or refactor the app to use an external PostgreSQL database. 

## ⚖️ License & Disclaimer

**License**: Distributed under the MIT License. See `LICENSE` for more information.

**Disclaimer**: This tool is designed for educational use and ethical B2B outreach.
- By using this software, you are responsible for maintaining compliance with YouTube's Terms of Service regarding botting or scraping API endpoints.
- Ensure your cold-emailing practices comply with international spam legislation (CAN-SPAM, GDPR, CCPA).
- Do not utilize this stack for malicious data scraping or unsolicited mass spam.
