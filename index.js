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
app.post('/github', async (request, response) => {
    if (!verifySignature(request))
        return response.status(401).send('Invalid signature');
    const event = request.headers['x-github-event'];

    if (event === "push") {
        const payload = request.body;
        const repo = payload.repository.full_name;
        const branch = payload.ref.replace("refs/heads/", "");
        const commit = payload.head_commit;
        try {
            const channel = await client.channels.fetch(process.env.CHANNEL_ID);
            await channel.send(
                `📦 **${repo}** received a new push on **${branch}**\n` +
                `👤 Author: ${commit.author.name}\n` +
                `💬 Message: ${commit.message}\n` +
                `⏰ Commit Timestamp: ${commit.timestamp}\n` +
                `🔗 ${commit.url}`
            );
        } catch (err) {
            console.error("Error sending Discord message:", err);
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
    } else if (event === "issues") {
        const issueAction = payload.action;
        const issueTitle = payload.issue.title;
        const issueUrl = payload.issue.html_url;
        const repoName = payload.repository.full_name;
        const actor = payload.sender.login;

        let issueMessage;

        if (issueAction === "opened")
            issueMessage = `New Issue Request in ${repoName}: "${issueTitle}" opened by ${actor} @ ${issueUrl}\n`;
        else if (issueAction === "closed")
            issueMessage = `Issue closed in ${repoName}: "${issueTitle}" closed by ${actor}\n`;
        else if (issueAction === "assigned"){
            const reviewer = payload.issue.assignee.login;
            issueMessage = `Issue in ${issueUrl}: ${issueTitle} assigned to "${reviewer}" by ${actor}\n`;
        } else if (issueAction === "labled"){
            const label = payload.label.name;
            issueMessage = `Issue labeled ${label} in ${issueUrl}: ${issueTitle} labeled by "${actor}"\n`;
        }
        else
            issueMessage = `error handling pull request: ${issueTitle}\n`;
    }
    response.sendStatus(200);
});
app.listen(process.env.PORT, () => {
    console.log(`GitHub webhook server running on port ${process.env.PORT}`);
});