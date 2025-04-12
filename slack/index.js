const { App } = require("@slack/bolt");
const express = require("express");
const axios = require("axios");

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });


// 🔸 Constants and Templates
// ------------------------------------------------------------------------------------

const SENTENCE = {
  EXPLAIN: "EXPLAIN!",
  RESPONSE: (input, output) => `
Input Text:
\`\`\`
${input}
\`\`\`

Explanation:
\`\`\`
${output}
\`\`\`
  `,
  ERROR: "❌ Sorry. Error occurred. Please try again.",
  LOADING: "LOADING…",
  EXPLAIN_MORE: "Explain more!",
  NO_TEXT: "❗Please provide a text like: `/explain Hello World`",
  INTRODUCTION: {
    TITLE: "👋 Hello! I'm your AI-Powered Explanation Bot.",
    DESCRIPTION: "\nI can help you understand complex texts and provide detailed explanations.\n\n- Just use the `/explain` command or\n- *right-click* on any message to get started!",
  },
};

// ------------------------------------------------------------------------------------

// ✅ Slack App Configuration
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false,
  appToken: process.env.SLACK_APP_TOKEN,
  port: process.env.PORT || 3000,
});

// ✅ Express App Setup
const expressApp = express();
expressApp.use(express.json());
expressApp.use(express.urlencoded({ extended: true }));

// 🔸 Utility: Build Slack message blocks
function buildMessageBlocks(text, explanation) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: SENTENCE.RESPONSE(text, explanation),
        verbatim: false,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            emoji: true,
            text: SENTENCE.EXPLAIN_MORE,
          },
          value: JSON.stringify({
            text,
            previous_explanation: explanation,
          }),
          action_id: "explain_more",
        },
      ],
    },
  ];
}

// 🔸 Utility: Request explanation from FastAPI
async function postExplain({ text }) {
  const { data } = await axios.post(process.env.FASTAPI_URL + "/api/explain", {
    text,
    platform: 'slack',
  });
  if (!data.result) throw new Error("No explanation returned");
  return data.result;
}

async function postExplainMore({ text, result }) {
  const { data } = await axios.post(
    process.env.FASTAPI_URL + "/api/explain-more",
    { text, result }
  );
  if (!data.result) throw new Error("No explanation returned");
  return data.result;
}

// 🔹 Handler: Slash Command
async function handleSlashCommand(req, res) {
  const text = req.body.text || "";

  if (!text) {
    return res.json({ response_type: "ephemeral", text: SENTENCE.NO_TEXT });
  }

  try {
    const result = await postExplain({ text });
    return res.json({
      response_type: "ephemeral",
      blocks: buildMessageBlocks(text, result),
    });
  } catch (error) {
    console.error("Slash command error:", error);
    return res.json({ response_type: "ephemeral", text: SENTENCE.ERROR });
  }
}

// 🔹 Handler: Message Shortcut
async function handleShortcut(req, res, payload) {
  const messageText = payload.message.text.replace(/[•\-\*#]/g, "");
  const responseUrl = payload.response_url;

  res.status(200).send(); // Immediate response to Slack

  try {
    const result = await postExplain({ text: messageText });
    await axios.post(responseUrl, {
      response_type: "ephemeral",
      blocks: buildMessageBlocks(messageText, result),
      replace_original: false,
    });
  } catch (error) {
    console.error("Shortcut error:", error);
    await axios.post(responseUrl, {
      response_type: "ephemeral",
      text: SENTENCE.ERROR,
      replace_original: false,
    });
  }
}

// 🔹 Handler: Button Click
async function handleButton(req, res, payload) {
  const action = payload.actions[0];
  const { text, previous_explanation } = JSON.parse(action.value);
  const responseUrl = payload.response_url;

  res.status(200).send(); // Respond immediately

  try {
    let result;
    if (previous_explanation) {
      result = await postExplainMore({text, result: previous_explanation});
    } else {
      result = await postExplain({ text });
    }
    await axios.post(responseUrl, {
      response_type: "ephemeral",
      blocks: buildMessageBlocks(text, result),
      replace_original: true,
    });
  } catch (error) {
    console.error("Button error:", error);
    await axios.post(responseUrl, {
      response_type: "ephemeral",
      text: SENTENCE.ERROR,
      replace_original: true,
    });
  }
}

// 🔸 Main Router
expressApp.post("/", async (req, res) => {
  console.log('req', req.body)
  try {
    // URL 검증 요청 처리
    if (req.body.type === "url_verification") {
      console.log(req.body.type);
      return res.json({ challenge: req.body.challenge });
    }

    // Slash command
    if (req.body.command === "/explain") {
      return await handleSlashCommand(req, res);
    }

    // Interactive payload (shortcut or button)
    if (req.body.payload) {
      const payload = JSON.parse(req.body.payload);

      if (
        payload.type === "message_action" &&
        payload.callback_id === "gapless_explain"
      ) {
        return await handleShortcut(req, res, payload);
      }

      if (payload.actions && payload.actions[0].action_id === "explain_more") {
        return await handleButton(req, res, payload);
      }
    }

    // member_joined_channel 이벤트 처리
    if (req.body?.event?.type === 'member_joined_channel') {
      const event = req.body.event;
      
      // 이벤트 ID를 확인하여 중복 처리 방지
      if (event.user === app.botUserId) {  // 봇이 채널에 추가된 경우에만 처리
        try {
          await app.client.chat.postMessage({
            channel: event.channel,
            blocks: [
              {
                type: "header",
                text: {
                  type: "plain_text",
                  text: SENTENCE.INTRODUCTION.TITLE,
                  emoji: true
                }
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: SENTENCE.INTRODUCTION.DESCRIPTION
                }
              }
            ]
          });
        } catch (error) {
          console.error('Error sending welcome message:', error);
        }
      }
      return res.status(200).send();
    }

    res.status(200).end();
  } catch (error) {
    console.error("Main router error:", error);
    res.status(200).end();
  }
});

// 🔸 Server Start
expressApp.listen(process.env.PORT || 3000, () => {
  console.log(`⚡️ Express server running on port ${process.env.PORT || 3000}`);
});
