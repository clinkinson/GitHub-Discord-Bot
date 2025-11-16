import logging
import discord
from discord.ext import commands

from gdb import config

log = logging.getLogger(__name__)

def create_bot():
    intents = discord.Intents.default()
    intents.members = True

    bot = commands.Bot(command_prefix="!",
                       intents=intents)

    @bot.event
    async def on_ready():
        log.info(f"Logged in as {bot.user}")
        try:
            bot.load_extension("gdb.cogs.github")
            log.info("Loaded GitHub cog.")
        except Exception as e:
            log.error(f"Failed to load cog: {e}")
    return bot

def run_bot():
    logging.basicConfig(level=logging.INFO)
    if not config.BOT_TOKEN:
        raise RuntimeError("Missing Bot_Token in environment variables.")
    bot = create_bot()
    bot.run(config.BOT_TOKEN)