# TODO: Fix Run Issues

## Issue Summary
- Next.js 14 requires Node.js 18.0.0+
- Older Node versions cause NPM "BadEngine" errors
- Bun installs successfully but 'next dev' hangs due to experimental Next.js support
- API errors (422/403) cause crashes due to unhandled exceptions

## Fixes Applied
- Added "engines": {"node": ">=18.0.0"} to package.json to specify Node requirement
- Fixed error handling in searchProviders.tsx to return [] instead of throwing on API failures

## Recommended: Run with Docker (Easiest, No Node Version Issues)

### Prerequisites
- Install Docker Desktop for Windows: https://www.docker.com/products/docker-desktop

### Steps
1. Clone the repository:
   ```
   git clone https://github.com/developersdigest/llm-answer-engine.git
   cd llm-answer-engine
   ```

2. Edit `docker-compose.yml` and replace the placeholder API keys with your actual keys:
   ```
   OPENAI_API_KEY=your_actual_openai_key
   GROQ_API_KEY=your_actual_groq_key
   BRAVE_SEARCH_API_KEY=your_actual_brave_key
   SERPER_API=your_actual_serper_key
   ```

3. Run the application:
   ```
   docker compose up -d
   ```

4. Access the app at: http://localhost:3000

## Alternative: Manual Setup on Windows (No WSL Required)

### 1. Install Node.js 18+ from https://nodejs.org/

### 2. Clone the repository:
```
git clone https://github.com/developersdigest/llm-answer-engine.git
cd llm-answer-engine
```

### 3. Install dependencies:
```
npm install --legacy-peer-deps
```

### 4. Create .env file with your API keys:
```
OPENAI_API_KEY=your_openai_api_key
GROQ_API_KEY=your_groq_api_key
BRAVE_SEARCH_API_KEY=your_brave_search_api_key
SERPER_API=your_serper_api_key
```

### 5. Run the development server:
```
npm run dev
```

### 6. Open browser to http://localhost:3000

## Notes
- Docker is recommended as it avoids Node version conflicts
- Avoid using Bun for now as it's experimental with Next.js
- The app now handles API errors gracefully without crashing
