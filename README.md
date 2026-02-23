# Madison Properties

A web app displaying recently listed properties for sale in Madison, WI. Data is fetched from the [RentCast API](https://www.rentcast.io/).

## Live Site

View the site at: `https://YOUR_USERNAME.github.io/Madison-houses/`

## Setup

### 1. Get a RentCast API Key

1. Sign up at [RentCast](https://www.rentcast.io/)
2. Navigate to your dashboard and generate an API key
3. You get 50 free API requests to start

### 2. Add API Key to GitHub Secrets

1. Go to your repository on GitHub
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Name: `RENTCAST_API_KEY`
5. Value: Your API key from RentCast

### 3. Enable GitHub Pages

1. Go to **Settings** > **Pages**
2. Under "Source", select **Deploy from a branch**
3. Select **main** branch and **/ (root)** folder
4. Click **Save**

### 4. Run the Data Fetch

- The GitHub Action runs automatically daily at 8 AM UTC
- To run manually: Go to **Actions** > **Fetch Property Data** > **Run workflow**

## Local Development

### Run the frontend locally

```bash
# Using Python
cd Madison-houses
python -m http.server 8000
# Open http://localhost:8000

# Or using Node.js
npx serve .
```

### Fetch data locally

```bash
# Install dependencies
pip install -r requirements.txt

# Set your API key
export RENTCAST_API_KEY="your_key_here"

# Run the fetch script
python scripts/fetch_properties.py
```

## Project Structure

```
Madison-houses/
├── index.html              # Main frontend page
├── styles.css              # Styling
├── script.js               # Frontend logic
├── data/
│   └── properties.json     # Property data (auto-updated)
├── scripts/
│   └── fetch_properties.py # RentCast API fetch script
├── .github/
│   └── workflows/
│       └── fetch-data.yml  # GitHub Action for auto-updates
└── requirements.txt        # Python dependencies
```

## API Usage

The free RentCast tier includes 50 requests. The GitHub Action is configured to run once daily, which uses ~30 requests/month. You can adjust the schedule in `.github/workflows/fetch-data.yml`.

## License

MIT
