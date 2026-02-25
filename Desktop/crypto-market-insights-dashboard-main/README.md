# Crypto Market Insights Dashboard

A web dashboard for viewing your daily market insights and 100x opportunity research.

## Features
- View all market insight digests in a clean, organized layout
- Click to view individual insights in detail
- Responsive design that works on desktop and mobile
- Dark theme optimized for extended reading
- Form to add new insights with 100x opportunity checklist
- Auto-detection of insight files in the insights directory

## Getting Started

### Prerequisites
- Node.js (v14 or higher)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/[YOUR_USERNAME]/crypto-market-insights-dashboard.git
   cd crypto-market-insights-dashboard
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Access the dashboard:**
   Open your browser and go to `http://localhost:3000`

## Adding Insights

1. **Via the web interface:**
   - Navigate to `/add-insight`
   - Fill in the form with your research findings
   - Check the boxes for patterns you've observed
   - Submit the form

2. **Manually:**
   - Add markdown files to the `insights/` directory
   - Use the naming convention: `research-digest-YYYY-MM-DD-slug.md`

## Deploying to Vercel

This project is ready to deploy to Vercel. Click the button below to deploy:

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/[YOUR_USERNAME]/crypto-market-insights-dashboard)

### Manual deployment:
1. Install the Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

## File Structure
```
├── server.js          # Main server file with Vercel compatibility
├── package.json       # Dependencies and scripts
├── vercel.json        # Vercel configuration
├── views/             # EJS templates
│   ├── index.ejs      # Main dashboard
│   ├── add-insight.ejs # Add new insight form
│   ├── insight.ejs    # Individual insight view
│   └── error.ejs      # Error page
├── public/            # Static assets
└── insights/          # Directory for insight files (created automatically)
```

## Created by Jr (Junior) for Jay