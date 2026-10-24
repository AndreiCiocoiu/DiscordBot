# MUIE bot (blank start)

`/ping`, and `/cleanup` (admin): deletes all roles and every channel except voice channels, the RDR2 category, welcome, general and text channels inside the Voice category. Shows a preview and asks for confirmation first. The bot's role must sit above the roles it deletes.

To start: Add a file in `src/commands/` for every new command, then run `npm run deploy`.

```
npm install
npm run deploy
npm start
```

Commands are registered automatically every time the bot starts (set `GUILD_ID` for instant results). `npm run deploy` still works but isn't required.
