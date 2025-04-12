const {
  REST,
  Routes,
  Client,
  ButtonStyle,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  GatewayIntentBits,
  SlashCommandBuilder,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
} = require('discord.js');

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });


// ------------------------------------------------------------------------------------

const SENTENCE = {
  EXPLAIN: "EXPLAIN!",
  RESPONSE: (input, output) => `
Input Text:
\`\`\`md
${input}
\`\`\`

Explanation:
\`\`\`md
${output}
\`\`\`
  `,
  ERROR: "❌ Sorry. Error occurred. Please try again.",
  LOADING: "LOADING…",
  EXPLAIN_MORE: "Explain more!",
  NO_TEXT: "❗Please provide a text like: `/explain Hello World`",
  INTRODUCTION: {
    TITLE: "👋 Hello! I’m your **AI-Powered Explanation Bot**.",
    DESCRIPTION: "\nI can help you understand complex texts and provide detailed explanations.\n\n- Just use the `/explain` command or\n- *right-click* on any message to get started!",
  },
};

// ------------------------------------------------------------------------------------

const stripCodeBlock = (text) => {
  const regex = /^```(?:md)?\n([\s\S]*?)```$/;
  const match = text.match(regex);
  const result = match ? match[1] : text;
  return result.trim();
};


const parseInputOutput = (_result) => {
  let [text, ...result] = _result.split('Explanation:');
  text = stripCodeBlock(text.split('Input Text:')[1].trim());
  result = stripCodeBlock(result.at(-1).trim());

  return { text, result }
}

// ------------------------------------------------------------------------------------

const fetch = global.fetch;

const postExplain = async ({ text, interaction }) => {
  try {
    const response = await fetch(process.env.FASTAPI_URL + '/api/explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        platform: 'discord',
        server_id: interaction.guildId,
        // userId: interaction.user.id,
        // messageId: interaction.id
      }),
    });

    if (!response.ok) {
      throw new Error(`서버 응답 에러: ${response.status}`);
    }

    const data = await response.json();

    if (!data.result) {
      throw new Error('No explanation provided');
    }

    await interaction.editReply({
      content: SENTENCE.RESPONSE(text, data.result),
      components: [row]
    });
  } catch (err) {
    console.error(err);
    await interaction.editReply(SENTENCE.ERROR);
  }
}

const postExplainMore = async ({ text, result, interaction }) => {
  try {
    const response = await fetch(process.env.FASTAPI_URL + '/api/explain-more', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        result,
        platform: 'discord',
        server_id: interaction.guildId,
        // userId: interaction.user.id,
        // messageId: interaction.id
      }),
    });

    if (!response.ok) {
      throw new Error(`서버 응답 에러: ${response.status}`);
    }

    const data = await response.json();

    if (!data.result) {
      throw new Error('No explanation provided');
    }

    await interaction.editReply({
      content: SENTENCE.RESPONSE(text, data.result),
      components: [row]
    });
  } catch (err) {
    console.error(err);
    await interaction.editReply(SENTENCE.ERROR);
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once('ready', () => {
  console.log(`✅ 봇 로그인됨: ${client.user.tag}`);
  client.guilds.cache.forEach(guild => {
    console.log(`✅ 서버 이름: ${guild.name}`);
    console.log(`🆔 서버 ID: ${guild.id}`);
  });
});

const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('explain_more')
    .setLabel(SENTENCE.EXPLAIN_MORE)
    .setStyle(ButtonStyle.Primary),
);

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === 'explain_more') {
      await interaction.reply({ content: SENTENCE.LOADING, ephemeral: true });
      postExplainMore({ ...parseInputOutput(interaction.message.content), interaction });
    }
  }
});

// 슬래시 명령 정의
const commands = [
  new SlashCommandBuilder()
    .setName('explain')
    .setDescription(SENTENCE.LOADING)
    .addStringOption(option =>
      option.setName('text')
        .setDescription('Input text to explain')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup the bot'),
  new SlashCommandBuilder()
    .setName('dict')
    .setDescription('Add custom dictionary'),
  new ContextMenuCommandBuilder()
    .setName(SENTENCE.EXPLAIN)
    .setType(ApplicationCommandType.Message)
].map(command => command.toJSON());

// 슬래시 명령 배포
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('📦 슬래시 명령 배포 중...');
    await rest.put(Routes.applicationCommands(process.env.DISCORD_APP_ID), { body: commands });
    console.log('✅ 명령 배포 완료!');
  } catch (err) {
    console.error('명령 배포 실패:', err);
  }
})();


// 명령어 처리
client.on('interactionCreate', async interaction => {
  if (interaction.commandName === SENTENCE.EXPLAIN) {
    if (!interaction.isMessageContextMenuCommand()) return;
    const message = interaction.targetMessage;
    const text = message.content;
    await interaction.deferReply({ ephemeral: true });
    await postExplain({ text, interaction });
  }
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'explain') {
    const text = interaction.options.getString('text');

    await interaction.deferReply({ ephemeral: true });

    await postExplain({ text, interaction });
  }
  if (interaction.commandName === 'setup') {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply({
      content: `🛠️ Please [click here](https://gapless.vercel.app/setup/${interaction.guildId}) to set up your custom server.`,
    });
  }
  if (interaction.commandName === 'dict') {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply({
      content: `🛠️ Please [click here](https://gapless.vercel.app/dict/${interaction.guildId}) to set up your custom dictionary.`,
    });
  }
});

client.on('guildCreate', async (guild) => {
  try {
    // 1. 봇이 접근할 수 있는 텍스트 채널 중 첫 번째 찾기
    const channel = guild.channels.cache.find(
      (ch) =>
        ch.type === 0 && // ChannelType.GuildText (숫자 0)
        ch.permissionsFor(guild.members.me).has('SendMessages')
    );

    if (!channel) return;

    // 2. 인사 메시지 전송
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(SENTENCE.INTRODUCTION.TITLE)
          .setDescription(SENTENCE.INTRODUCTION.DESCRIPTION)
      ]
    });

    console.log(`📥 봇이 새 서버에 초대됨: ${guild.name}`);
  } catch (err) {
    console.error('인사 메시지 전송 실패:', err);
  }
});

client.login(process.env.DISCORD_TOKEN);
