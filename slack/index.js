const { App } = require("@slack/bolt");
const express = require("express");
const axios = require("axios");
require("dotenv").config();

// 🔸 Constants and Templates
const SENTENCE = {
  EXPLAIN: "EXPLAIN!",
  RESPONSE: (input, output) => `\`\`\`📝 *Input Text:*\n${input}\n\n💡 *Explanation:*\n${output}\`\`\``,
  ERROR: "❌ Sorry. Error occurred. Please try again.",
  LOADING: "LOADING...",
  EXPLAIN_MORE: "Explain more!",
  NO_TEXT: "❗Please provide a text like: \`/gapless Hello World\`",
};

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
        verbatim: false
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            emoji: true,
            text: SENTENCE.EXPLAIN_MORE
          },
          value: JSON.stringify({
            text,
            previous_explanation: explanation
          }),
          action_id: "explain_more"
        }
      ]
    }
  ];
}

// 🔸 Utility: Request explanation from FastAPI
async function fetchExplanation(text, previous = null) {
  const payload = previous ? { text, previous_explanation: previous } : { text };
  const { data } = await axios.post(process.env.FASTAPI_URL + "/api/explain", payload);
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
    const result = await fetchExplanation(text);
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
  const messageText = payload.message.text.replace(/[•\-\*#]/g, '');
  const responseUrl = payload.response_url;

  res.status(200).send(); // Immediate response to Slack

  try {
    const result = await fetchExplanation(messageText);
    await axios.post(responseUrl, {
      response_type: "ephemeral",
      blocks: buildMessageBlocks(messageText, result),
      replace_original: false
    });
  } catch (error) {
    console.error("Shortcut error:", error);
    await axios.post(responseUrl, {
      response_type: "ephemeral",
      text: SENTENCE.ERROR,
      replace_original: false
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
    const result = await fetchExplanation(text, previous_explanation);
    await axios.post(responseUrl, {
      response_type: "ephemeral",
      blocks: buildMessageBlocks(text, result),
      replace_original: true
    });
  } catch (error) {
    console.error("Button error:", error);
    await axios.post(responseUrl, {
      response_type: "ephemeral",
      text: SENTENCE.ERROR,
      replace_original: true
    });
  }
}

// 🔸 Main Router
expressApp.post("/", async (req, res) => {
  try {
    // Slash command
    if (req.body.command === "/explain") {
      return await handleSlashCommand(req, res);
    }

    // Interactive payload (shortcut or button)
    if (req.body.payload) {
      const payload = JSON.parse(req.body.payload);

      if (payload.type === "message_action" && payload.callback_id === "gapless_explain") {
        return await handleShortcut(req, res, payload);
      }

      if (payload.actions && payload.actions[0].action_id === "explain_more") {
        return await handleButton(req, res, payload);
      }
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
