//code based on discord-node.js bot tutorial from Andy's Tech Tutorials
//https://www.youtube.com/watch?v=pDQAn18-2go

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
        return res.status(401).send('Invalid signature');
    }

    const event = req.headers['x-github-event'];

    // Handle push events
    if (event === "push") {
        const payload = req.body;
        const repo = payload.repository.full_name;
        const branch = payload.ref.replace("refs/heads/", "");
        const commit = payload.head_commit;

        try {
            const channel = await client.channels.fetch(process.env.CHANNEL_ID);

            await channel.send(
                `📦 **${repo}** received a new push on **${branch}**\n` +
                `👤 Author: ${commit.author.name}\n` +
                `💬 Message: ${commit.message}\n` +
                `🔗 ${commit.url}`
            );
        } catch (err) {
            console.error("Error sending Discord message:", err);
        }
    }

    res.sendStatus(200);
});

app.listen(process.env.PORT, () => {
    console.log(`GitHub webhook server running on port ${process.env.PORT}`);
});

client.login(process.env.DISCORD_BOT_ID);