# Gapless - AI-Powered Text Explanation Service

Gapless is an AI-powered service that provides detailed explanations for any given text. It's designed to help users better understand complex or ambiguous text content through AI-generated explanations.

## Features

- **Text Explanation**: Get AI-generated explanations for any text input
- **Multi-Platform Support**: Available on Slack and Discord
- **Interactive Interface**: Request more detailed explanations through interactive buttons
- **Real-time Processing**: Quick and efficient text analysis

## Directory Structure

```
gapless-enduser/
├── discord/           # Discord bot implementation
├── slack/            # Slack app implementation
├── .vscode/          # VS Code configuration
└── README.md         # Project documentation
```

## Platform Implementations

### Slack Integration
Located in `slack/` directory:
- `index.js`: Main Slack bot implementation
- Handles slash commands and message interactions
- Provides interactive buttons for requesting more detailed explanations

### Discord Integration
Located in `discord/` directory:
- Discord bot implementation
- Similar functionality to Slack version
- Customized for Discord's platform features

## How It Works

1. User sends a text message through Slack or Discord
2. The text is processed by the AI service
3. An explanation is generated and sent back to the user
4. Users can request more detailed explanations through interactive buttons

## Setup and Installation

### Prerequisites
- Node.js
- npm or yarn
- Slack/Discord bot tokens
- Environment variables configured

### Environment Variables
Required environment variables:
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_APP_TOKEN`
- `FASTAPI_URL`
- `PORT` (optional, defaults to 3000)

## Usage

### Slack
1. Use the `/explain` slash command followed by your text
2. Or use the message shortcut to explain any message
3. Click "Explain more!" for additional details

### Discord
1. Use the explain command with your text
2. Similar interactive features as Slack version