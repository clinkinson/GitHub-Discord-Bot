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
    const payload = request.body;
    const repo = payload.repository ? payload.repository.full_name : 'Unknown Repository';
    let message = null;

    try{
        switch (event) {
            case "push":
                message = pushNotifMessage(payload,repo);
                break;
            case "pull_request":
                message = pullNotifMessage(payload,repo);
                break;
            case "issues":
                message = issuesNotifMessage(payload,repo);
                break;
            default:
                const action = payload.action ? ` (${payload.action})` : '';
                message = `Generic Event in ${repo}:\n\`${event}\`${action} occurred`;
        }
        if (message) {
            const channel = await client.channels.fetch(process.env.CHANNEL_ID);
            await channel.send(message);
        }
    } catch (error) {
        console.error(`Error processing GitHub event '${event}':`, error);
    }
    response.sendStatus(200);
});

function pushNotifMessage(payload, repo){
    const branch = payload.pull_request.head.ref;
    const commit = payload.head_commit;

    return(`${repo} received new push on ${branch}\n` +
           `Author: ${commit.author.name}\n` +
           `Message: ${commit.message}\n` +
           `URL: ${commit.url}`);
}

function pullNotifMessage(payload, repo) {
    const branch = payload.ref.replace("refs/heads/", "");
    const action = payload.action;
    const title = payload.pull_request.title;
    const url = payload.pull_request.html_url;
    const user = payload.pull_request.user.login;
    const reviewer = payload.requested_reviewer ? payload.requested_reviewer.login : 'Unknown Reviewer';
    if (action === "opened"){
        return(`${repo} received new pull request on ${branch}\n` +
               `Title: ${title}\n` +
               `Opened by: ${user}\n` +
               `URL: ${url}`);
    }
    else if (action === "closed" && payload.pull_request.merged){
        return(`${repo} pull request merged\n` +
               `Branch: ${branch}\n` +
               `Title: ${title}\n` +
               `Closed by: ${user}\n` +
               `URL: ${url}`);
    }
    else if (action === "review_requested"){
        return(`${repo} pull request review requested\n` +
               `Branch: ${branch}\n` +
               `Title: ${title}\n` +
               `Requested by: ${reviewer}\n` +
               `URL: ${url}`);
    }
    else
        return(`Error handling pull request notif for: ${repo}\n${url}`);
}

function issuesNotifMessage(payload, repo) {
    const action = payload.action;
    const title = payload.issue.title;
    const url = payload.issue.html_url;
    const actor = payload.sender.login;
    const reviewer = payload.issue.assignee ? payload.issue.assignee.login : 'Unknown';
    const label = payload.label ? payload.label.name : 'Unknown Label';

    if (action === "opened"){
        return(`New Issue Request created for ${repo}:\n` +
               `Title: ${title}\n` +
               `Opened by: ${actor}\n` +
               `URL: ${url}`);
    }
    else if (action === "closed"){
        return(`New Issue Request closed for ${repo}:\n` +
               `Title: ${title}\n` +
               `Closed by: ${actor}\n` +
               `URL: ${url}`);
    }
    else if (action === "assigned"){
        return(`Issue in ${repo} reassigned:\n` +
               `Title: ${title}\n` +
               `Assigned TO: ${reviewer}\n` +
               `Assigned BY: ${actor}\n` +
               `URL: ${url}`);
    } else if (action === "labeled"){
        return(`Issue in ${repo} labeled:\n` +
               `Title: ${title}\n` +
               `Label: ${label}\n` +
               `Labeled by: ${actor}\n` +
               `URL: ${url}`);
    }
    else
        return(`Error handling pull request notif for: ${repo}\n${url}`);
}

app.listen(process.env.PORT, () => {
    console.log(`GitHub webhook server running on port ${process.env.PORT}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);