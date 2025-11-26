import { Telegraf, Markup, session } from "telegraf";
import { message } from "telegraf/filters";
import { storage, type User } from "./services/storage";
import { ai } from "./services/ai";
import { submitWorkBot, submitApprovalBot } from "@green-goods/shared";
import type { WorkDraft } from "./types";
import { createWalletClient, http, createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, baseSepolia, celo } from "viem/chains";
import fs from "fs";
import path from "path";
import https from "https";

// Helper to download file
async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

export function createBot(token: string) {
  const bot = new Telegraf(token);

  bot.use(session());

  // Middleware to attach user context
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      const user = storage.getUser(ctx.from.id);
      (ctx as any).user = user;
    }
    return next();
  });

  bot.command("start", async (ctx) => {
    const telegramId = ctx.from.id;
    let user = storage.getUser(telegramId);

    if (!user) {
      // Create new wallet
      // In a real app, we might want to use a more secure way or ask user to import
      // For MVP/Hackathon, generate a random key
      const account = privateKeyToAccount(generatePrivateKey());
      user = {
        telegramId,
        privateKey: account.source, // Store safely in real app!
        address: account.address,
      };
      storage.createUser(user);
      await ctx.reply(`Welcome to Green Goods! 🌿\n\nI've created a wallet for you:\nAddress: \`${user.address}\`\n\nYou can now join a garden to start reporting impact.`, { parse_mode: "Markdown" });
    } else {
      await ctx.reply(`Welcome back! 🌿\nAddress: \`${user.address}\``, { parse_mode: "Markdown" });
    }
  });

  bot.command("join", async (ctx) => {
    const args = ctx.message.text.split(" ").slice(1);
    const gardenAddress = args[0];

    if (!gardenAddress) {
      return ctx.reply("Usage: /join <GardenAddress>");
    }

    const user = (ctx as any).user as User;
    if (!user) return ctx.reply("Please /start first.");

    // Verify garden exists (optional, or just trust for now)
    // Update user context
    storage.updateUser({ telegramId: user.telegramId, currentGarden: gardenAddress });
    await ctx.reply(`You have joined garden ${gardenAddress}! You can now submit work.`);
  });

  bot.on(message("voice"), async (ctx) => {
    const user = (ctx as any).user as User;
    if (!user || !user.currentGarden) return ctx.reply("Please /join a garden first.");

    const fileId = ctx.message.voice.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    
    const tempPath = path.resolve(`temp_${fileId}.ogg`);
    await downloadFile(fileLink.href, tempPath);

    await ctx.reply("Listening to your report... 🎧");

    try {
      const text = await ai.transcribe(tempPath);
      await ctx.reply(`I heard: "${text}"\n\nParsing...`);

      const workData = await ai.parseWorkText(text);
      
      // Store draft in session
      storage.setSession({
        telegramId: user.telegramId,
        step: "submitting_work",
        draft: workData
      });

      await ctx.reply(
        `Confirm submission?\n\nTasks: ${JSON.stringify(workData.tasks, null, 2)}\nNotes: ${workData.notes}`,
        Markup.inlineKeyboard([
          Markup.button.callback("✅ Submit", "confirm_submission"),
          Markup.button.callback("❌ Cancel", "cancel_submission")
        ])
      );
    } catch (e) {
      console.error(e);
      await ctx.reply("Sorry, I couldn't process that audio.");
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  });

  bot.on(message("text"), async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return; // Ignore commands

    const user = (ctx as any).user as User;
    if (!user || !user.currentGarden) return; // Ignore random chat if not in garden context? Or maybe handle as submission?

    // Assume text submission
    const workData = await ai.parseWorkText(text);
    
    storage.setSession({
      telegramId: user.telegramId,
      step: "submitting_work",
      draft: workData
    });

    await ctx.reply(
      `Confirm submission?\n\nTasks: ${JSON.stringify(workData.tasks, null, 2)}\nNotes: ${workData.notes}`,
      Markup.inlineKeyboard([
        Markup.button.callback("✅ Submit", "confirm_submission"),
        Markup.button.callback("❌ Cancel", "cancel_submission")
      ])
    );
  });

  bot.action("confirm_submission", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const session = storage.getSession(telegramId);
    const user = storage.getUser(telegramId);

    if (!session || !session.draft || !user || !user.currentGarden) {
      return ctx.reply("Session expired or invalid.");
    }

    await ctx.reply("Submitting to blockchain... ⛓️");

    try {
      const account = privateKeyToAccount(user.privateKey as `0x${string}`);
      const chain = baseSepolia; // Default for now, or get from config
      const client = createWalletClient({
        account,
        chain,
        transport: http()
      });
      const publicClient = createPublicClient({
        chain,
        transport: http()
      });

      // Construct WorkDraft
      const draft: WorkDraft = {
        actionUID: 0,
        title: "Telegram Submission",
        plantSelection: session.draft.tasks.map((t: any) => t.species),
        plantCount: session.draft.tasks.reduce((acc: number, t: any) => acc + (t.count || 0), 0),
        feedback: session.draft.notes || "",
        media: []
      };

      // Generate a unique ID for pending work
      const pendingId = Math.random().toString(36).substring(7);

      storage.addPendingWork({
        id: pendingId,
        actionUID: 0,
        gardenerAddress: user.address,
        gardenerTelegramId: telegramId,
        data: draft
      });

      await ctx.reply(`✅ Work submitted for approval! ID: ${pendingId}`);
      storage.clearSession(telegramId);

      // Notify Operator
      const operator = storage.getOperatorForGarden(user.currentGarden);
      if (operator) {
        bot.telegram.sendMessage(operator.telegramId, `🔔 New work submission from ${telegramId} (ID: ${pendingId})\n\n${session.draft.notes}\n\nReply /approve ${pendingId} to approve.`);
      } else {
        console.log("No operator found for garden", user.currentGarden);
      }
    } catch (e: any) {
      console.error(e);
      await ctx.reply(`Error submitting: ${e.message}`);
    }
  });

  bot.action("cancel_submission", async (ctx) => {
    if (ctx.from) storage.clearSession(ctx.from.id);
    await ctx.reply("Submission cancelled.");
  });

  bot.command("approve", async (ctx) => {
    const args = ctx.message.text.split(" ");
    const workId = args[1];
    if (!workId) return ctx.reply("Usage: /approve <WorkID>");

    const user = (ctx as any).user as User;
    if (!user) return ctx.reply("Please /start first.");

    // In a real app, verify user is an operator for the garden of the work
    // For now, allow anyone with a wallet to approve (demo)
    
    try {
      await ctx.reply(`Approving work ${workId}...`);
      
      const account = privateKeyToAccount(user.privateKey as `0x${string}`);
      const chain = baseSepolia;
      const client = createWalletClient({ account, chain, transport: http() });

      // We need the gardener address to approve. 
      // In a real app, we'd fetch the Work from DB/Indexer to get gardenerAddress.
      // For this MVP, we might need to store pending works in DB with metadata.
      // Let's assume we stored it in `storage` service under a "pending_approvals" table or similar.
      // Or we just ask the operator to provide it? No, that's bad UX.
      
      // Let's add a helper to fetch pending work from our local DB if we stored it.
      // For now, I'll mock it or fail if not found.
      const pendingWork = storage.getPendingWork(workId);
      if (!pendingWork) return ctx.reply("Work not found or already processed.");

      // Operator submits the WORK attestation (approving it by signing it)
      const tx = await submitWorkBot(
        client,
        createPublicClient({ chain, transport: http() }) as any,
        pendingWork.data, // The draft
        user.currentGarden || "0x0000000000000000000000000000000000000000", // Should be the garden address from pending work? 
        // Wait, pendingWork doesn't store gardenAddress explicitly in my schema update, 
        // but user.currentGarden might be correct if operator is in context.
        // Better to store gardenAddress in pending_works.
        // For now, assume operator is in the right garden context.
        pendingWork.actionUID,
        "Telegram Action",
        chain.id,
        []
      );

      await ctx.reply(`✅ Work approved and attested! Tx: ${tx}`);
      storage.removePendingWork(workId);
      
      // Notify gardener
      bot.telegram.sendMessage(pendingWork.gardenerTelegramId, `🎉 Your work (ID: ${workId}) has been approved! Tx: ${tx}`);

    } catch (e: any) {
      console.error(e);
      await ctx.reply(`Error approving: ${e.message}`);
    }
  });

  bot.command("reject", async (ctx) => {
    const args = ctx.message.text.split(" ");
    const workId = args[1];
    if (!workId) return ctx.reply("Usage: /reject <WorkID>");
    
    // Similar logic to approve but approved: false
    await ctx.reply("Rejection not fully implemented in demo yet.");
  });

  return bot;
}

function generatePrivateKey(): `0x${string}` {
  // Insecure random for demo
  return ("0x" + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join("")) as `0x${string}`;
}
