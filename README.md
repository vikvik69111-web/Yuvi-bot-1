# Yuvi-bot-1

This is a Discord statistics bot built with Node.js, MongoDB, and Discord.js.

## Run it locally

1. Install dependencies:
   npm install
2. Create a .env file using the sample file:
   copy .env.example .env
3. Fill in your values:
   TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_application_id
   MONGO_URI=your_mongodb_connection_string
   DASHBOARD_PORT=10000
4. Start both independent processes:
   npm start

The dashboard listens independently on `DASHBOARD_PORT` and remains available when the Discord bot is offline or restarting. To run them separately, use `npm run start:dashboard` and `npm run start:bot` in two terminals. Database settings continue to work while the bot is offline; Discord actions show a `Bot Offline` response until the bot reconnects.

## Keep it online 24/7

A bot only stays online while the machine is running. To keep it online all the time, use a hosted server or a VPS and run it with PM2.

### Option 1: VPS / Linux server

1. Upload the project to a Linux VPS.
2. Install Node.js and MongoDB.
3. Run:
   npm install
   npm install -g pm2
4. Start with:
   pm2 start ecosystem.config.js
5. Save the process so it restarts automatically:
   pm2 save
   pm2 startup

### Option 2: Free or cheap cloud deployment

Use services like Render, Railway, or Cyclic for a Node app. Keep your bot token and MongoDB URI in environment variables.

### Important

- The bot needs a constant internet connection.
- A server must not sleep.
- Use MongoDB Atlas or another cloud MongoDB service.
- Never commit your Discord token to GitHub.

## Health check

The app exposes a basic HTTP endpoint on the PORT value so monitoring services can confirm the bot is live.