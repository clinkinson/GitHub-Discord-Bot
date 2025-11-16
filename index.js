//code based on discord-node.js bot tutorial from Andy's Tech Tutorials
//https://www.youtube.com/watch?v=pDQAn18-2go

const { Octokit } = require('@octokit/rest'); // <-- ADD THIS

const octokit = new Octokit({
    auth: process.env.GITHUB_PAT
});

require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });


client.on('ready', () => {
    console.log('bot online');
})

const app = express();
app.use(express.json({verify: (req, res, buf) => {req.rawBuf = buf}}));

function verifySignature(req) {
    const signature = req.headers['x-hub-signature-256'];
    const expected = "sha256=" +
        crypto
            .createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET)
            .update(req.rawBuf)
            .digest("hex");

    return signature === expected;
}

app.post('/github', async (req, res) => {
   if (!verifySignature(req)) {
        console.warn('Received invalid signature from webhook');
    return res.status(401).send('Invalid signature');
  }
  const event = req.headers['x-github-event'];
  const payload = req.body;
  const repo = payload.repository.full_name;
  const branch = payload.ref.replace("refs/heads/", "");
  const commit = payload.head_commit;
  if (event === "push") {
    const map = readRepoMap();
    const channelId = map[repo];
    if (!channelId) {
        console.log(`Received push from unmapped repo: ${repo}. Ignoring.`);
        return res.sendStatus(200);
    }
    try {
      const channel = await client.channels.fetch(channelId);
            if (!commit) {
                console.log(`Received push event for ${repo} with no head_commit (e.g., new branch).`);
                return res.sendStatus(200);
            }
      await channel.send(
        `📦 **${repo}** received a new push on **${branch}**\n` +
        `👤 Author: ${commit.author.name}\n` +
        `💬 Message: ${commit.message}\n` +
        `⏰ Timestamp: ${commit.timestamp}\n` +
        `🔗 ${commit.url}`
      );
    } catch (err) {
      console.error(`Error sending Discord message for repo ${repo} to channel ${channelId}:`, err);
    }
  } else if (event === "pull") {
      const action = payload.action;
      const prTitle = payload.pull_request.title;
      const prUrl = payload.pull_request.html_url;
      const user = payload.pull_request.user.login;
      let message;
      if (action === "opened")
          message = `New Pull Request formed: "${prTitle}" opened by ${user} @ ${repo}\n`;
      else if (action === "closed" && payload.pull_request.merged)
          message = `Pull Request merged: "${prTitle}" closed by ${user} @ ${repo}\n`;
      else if (action === "review_requested"){
          const reviewer = payload.requested_reviewer.login;
          message = `Review requested: ${reviewer} on "${prTitle}" requested @ ${repo}\n`;
      }
      else
          message = `error handling pull request: ${prTitle}\n`;
      if (message) {
          await channel.send(message);
      }
  }
  res.sendStatus(200);
});

const fs = require('fs');
const mapFilePath = './repo-map.json';
const commandPrefix = '!';
function readRepoMap() {
    try {
        if (fs.existsSync(mapFilePath)) {
            const data = fs.readFileSync(mapFilePath);
            return JSON.parse(data);
        }
    } catch (err) {
        console.error("Error reading repo map:", err);
    }
    return {}; 
}
function writeRepoMap(map) {
    try {
        fs.writeFileSync(mapFilePath, JSON.stringify(map, null, 2));
    } catch (err) {
        console.error("Error writing repo map:", err);
    }
}
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(commandPrefix)) {
        return;
    }
    const args = message.content.slice(commandPrefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    // ... (all the existing code for parsing commands) ...

    if (command === 'setrepo') {
        // ... (all your existing permission checks and args checks) ...

        const repoName = args[0]; // e.g., "clinkinson/GitHub-Discord-Bot"
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply("You need 'Manage Server' permissions to use this command.");
        }
        const repoName = args[0];
        if (!repoName) {
            return message.reply("Please provide a repository name in the format `user/repo`.\nExample: `!setrepo my-username/my-project`");
        }
        const channelId = message.channel.id;
        try {
            // --- Part 1: Save to your local map (This is your existing code) ---
            const map = readRepoMap();
            map[repoName] = channelId;
            writeRepoMap(map);
            message.reply(`✅ Successfully mapped repository **${repoName}** to this channel.`);

            // We'll reply *after* the webhook is made.
            // message.reply(`✅ Successfully mapped repository **${repoName}** to this channel.`);


            // --- Part 2: NEW - Create the webhook on GitHub ---
            const [owner, repo] = repoName.split('/'); // Splits "user/repo" into ["user", "repo"]
            if (!owner || !repo) {
                return message.reply("Invalid repo format. Please use `owner/repo`.");
            }

            try {
                await octokit.repos.createWebhook({
                    owner: owner,
                    repo: repo,
                    name: "web", // This is the standard name
                    config: {
                        url: process.env.WEBHOOK_RECEIVER_URL,
                        content_type: "json",
                        secret: process.env.GITHUB_WEBHOOK_SECRET
                    },
                    events: ["push"], // Only listen for push events
                    active: true
                });

                // If both steps succeed:
                message.reply(`✅ Successfully mapped **${repoName}** and created the GitHub webhook!`);

            } catch (apiError) {
                console.error("GitHub API error:", apiError);
                message.reply(`Error creating webhook on GitHub: ${apiError.message}. \n(The repo *was* mapped to this channel, but you may need to set up the webhook manually.)`);
            }

        } catch (err) {
            console.error("Error in setrepo command:", err);
            message.reply("An error occurred while trying to set the repo.");
        }
    }
});


app.listen(process.env.PORT, () => {
    console.log(`GitHub webhook server running on port ${process.env.PORT}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);