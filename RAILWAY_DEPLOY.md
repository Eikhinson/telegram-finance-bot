# Deploy Bot to Railway

This guide describes how to deploy the Telegram Finance Bot to Railway.com.

## Prerequisites
- A GitHub account (to host the repository).
- A Railway.com account.

## Steps

### 1. Push to GitHub
Ensure this project is pushed to a GitHub repository.
```bash
git add .
git commit -m "Prepare for Railway deployment"
git push
```

### 2. Create Project on Railway
1. Log in to [Railway.com](https://railway.com).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select your repository (`telegram-finance-bot`).
4. Click **Deploy Now**.

### 3. Add Database
1. In your project view on Railway, click **+ New** (or "Create").
2. Select **Database** -> **PostgreSQL**.
3. Railway will automatically deploy a Postgres instance.

### 4. Configure Environment Variables
1. Click on your **telegram-finance-bot** service card.
2. Go to the **Variables** tab.
3. Add the following variables:
    - `TELEGRAM_BOT_TOKEN`: Your Telegram Bot Token (from BotFather).
    - `OPENAI_API_KEY`: Your OpenAI API Key.
    - `NODE_ENV`: `production`

4. **Connect Database**:
    - Under the **Variables** tab, you might see "Reference a Variable".
    - Railway automatically provides `DATABASE_URL` to services in the same project if they are linked.
    - If not automatically linked:
        - Go to the **Settings** tab of your Bot service.
        - Scroll to **Networking** or **Environment**.
        - Ensure it has access to the Postgres service.
    - **Verify**: In the **Variables** list, you should see `DATABASE_URL` (injected by Railway) OR you can manually add `DATABASE_URL` and set the value to `${{Postgres.DATABASE_URL}}`.

### 5. Deployment
- Once variables are saved, Railway will automatically redeploy.
- Go to the **Deployments** tab to see logs.
- You should see "✅ Database initialized successfully" and "✅ Bot is ready!".

## Troubleshooting
- **Build Failed**: Check the Build logs. Ensure `npm ci` runs correctly.
- **Bot Crashes**: Check the Deploy logs. Verify `TELEGRAM_BOT_TOKEN` is correct.
