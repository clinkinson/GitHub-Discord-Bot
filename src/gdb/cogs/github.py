from discord.ext import commands

class Github(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command()
    async def ping(self, ctx):
        await ctx.send("GitHub bot is online")

def setup(bot):
    bot.add_cog(Github(bot))