import { Telegraf, Markup, session, type Context, type NarrowedContext } from "telegraf";
import { message } from "telegraf/filters";
import type { Message, Update } from "telegraf/types";
import { storage, type User } from "./services/storage";
import { ai, type ParsedWorkData } from "./services/ai";
import {
  generateSecurePrivateKey,
  generateSecureId,
  isValidAddress,
} from "./services/crypto";
import {
  rateLimiter,
  formatRateLimitWait,
  type RateLimitType,
} from "./services/rate-limiter";
import { verificationService } from "./services/verification";
import { submitWorkBot } from "@green-goods/shared";
import {
  createWalletClient,
  http,
  createPublicClient,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import fs from "fs";
import path from "path";
import https from "https";

// ============================================================================
// TYPES
// ============================================================================

/** Extended context with user data attached */
interface BotContext extends Context {
  user?: User;
}

/** Work draft prepared for blockchain submission */
interface WorkDraft {
  actionUID: number;
  title: string;
  plantSelection: string[];
  plantCount: number;
  feedback: string;
  media: never[]; // Empty for text-only submissions
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Downloads a file from URL to local filesystem.
 *
 * @param url - Source URL to download from
 * @param dest - Local destination path
 */
async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            fs.unlinkSync(dest);
            return downloadFile(redirectUrl, dest).then(resolve).catch(reject);
          }
        }

        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {
          /* ignore cleanup errors */
        });
        reject(err);
      });
  });
}

/**
 * Rate limit check helper.
 * Returns error message if rate limited, undefined if allowed.
 */
async function checkRateLimit(
  ctx: BotContext,
  type: RateLimitType
): Promise<string | undefined> {
  if (!ctx.from) return undefined;

  const result = rateLimiter.check(ctx.from.id, type);
  if (!result.allowed) {
    const waitTime = formatRateLimitWait(result.resetIn);
    return `⏳ ${result.message}\n\nPlease wait ${waitTime} before trying again.`;
  }
  return undefined;
}

/**
 * Formats an Ethereum address for display.
 */
function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Safely cleans up a temporary file.
 */
function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Failed to cleanup file ${filePath}:`, error);
  }
}

// ============================================================================
// BOT FACTORY
// ============================================================================

/**
 * Creates and configures the Telegram bot instance.
 *
 * @param token - Telegram Bot API token from BotFather
 * @returns Configured Telegraf bot instance
 *
 * @example
 * const bot = createBot(process.env.TELEGRAM_BOT_TOKEN);
 * bot.launch();
 */
export function createBot(token: string): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(token);

  // Session middleware for conversation state
  bot.use(session());

  // Middleware to attach user context to every request
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      const user = storage.getUser(ctx.from.id);
      ctx.user = user;
    }
    return next();
  });

  // -------------------------------------------------------------------------
  // COMMANDS
  // -------------------------------------------------------------------------

  /**
   * /start - Initialize user account and wallet
   */
  bot.command("start", async (ctx) => {
    // Rate limit wallet creation
    const rateLimitError = await checkRateLimit(ctx, "wallet");
    if (rateLimitError) return ctx.reply(rateLimitError);

    const telegramId = ctx.from.id;
    let user = storage.getUser(telegramId);

    if (!user) {
      // Create new custodial wallet with encrypted key
      const privateKey = generateSecurePrivateKey();
      const account = privateKeyToAccount(privateKey);

      user = {
        telegramId,
        privateKey,
        address: account.address,
        role: "gardener",
      };
      storage.createUser(user);

      await ctx.reply(
        `🌿 *Welcome to Green Goods!*\n\n` +
          `I've created a wallet for you:\n` +
          `\`${user.address}\`\n\n` +
          `*Commands:*\n` +
          `/join <address> - Join a garden\n` +
          `/status - Check your current status\n` +
          `/help - Show all commands\n\n` +
          `_Send me a text or voice message to submit work!_`,
        { parse_mode: "Markdown" }
      );
    } else {
      await ctx.reply(
        `🌿 *Welcome back!*\n\n` +
          `Wallet: \`${formatAddress(user.address)}\`\n` +
          `Garden: ${user.currentGarden ? `\`${formatAddress(user.currentGarden)}\`` : "_Not joined_"}\n\n` +
          `_Send me a message to submit work or use /help for commands._`,
        { parse_mode: "Markdown" }
      );
    }
  });

  /**
   * /join - Join a garden by address
   */
  bot.command("join", async (ctx) => {
    // Rate limit command
    const rateLimitError = await checkRateLimit(ctx, "command");
    if (rateLimitError) return ctx.reply(rateLimitError);

    const args = ctx.message.text.split(" ").slice(1);
    const gardenAddress = args[0];

    if (!gardenAddress) {
      return ctx.reply(
        "📍 *Usage:* `/join <GardenAddress>`\n\n" +
          "Example: `/join 0x1234...abcd`",
        { parse_mode: "Markdown" }
      );
    }

    // Validate address format
    if (!isValidAddress(gardenAddress)) {
      return ctx.reply(
        "❌ Invalid address format.\n\n" +
          "Please provide a valid Ethereum address (0x followed by 40 hex characters)."
      );
    }

    const user = ctx.user;
    if (!user) {
      return ctx.reply("Please run /start first to create your wallet.");
    }

    // Verify garden exists on-chain
    await ctx.reply("🔍 Verifying garden...");
    const gardenInfo = await verificationService.getGardenInfo(gardenAddress);

    if (!gardenInfo.exists) {
      return ctx.reply(
        "❌ *Garden not found*\n\n" +
          "This address doesn't appear to be a valid Green Goods garden contract.\n\n" +
          "Please verify the address and try again.",
        { parse_mode: "Markdown" }
      );
    }

    storage.updateUser({
      telegramId: user.telegramId,
      currentGarden: gardenAddress,
    });

    await ctx.reply(
      `✅ *Joined garden successfully!*\n\n` +
        `Garden: ${gardenInfo.name ? `*${gardenInfo.name}*` : ""}\n` +
        `Address: \`${formatAddress(gardenAddress)}\`\n\n` +
        `You can now submit work by sending me a text or voice message.`,
      { parse_mode: "Markdown" }
    );
  });

  /**
   * /status - Show current user status
   */
  bot.command("status", async (ctx) => {
    // Rate limit command
    const rateLimitError = await checkRateLimit(ctx, "command");
    if (rateLimitError) return ctx.reply(rateLimitError);

    const user = ctx.user;
    if (!user) {
      return ctx.reply("Please run /start first to create your wallet.");
    }

    const pendingSession = storage.getSession(user.telegramId);
    const rateLimitStats = rateLimiter.peek(user.telegramId, "submission");

    await ctx.reply(
      `📊 *Your Status*\n\n` +
        `*Wallet:* \`${user.address}\`\n` +
        `*Role:* ${user.role || "gardener"}\n` +
        `*Garden:* ${user.currentGarden ? `\`${formatAddress(user.currentGarden)}\`` : "_Not joined_"}\n` +
        `*Session:* ${pendingSession?.step || "idle"}\n` +
        `*Submissions remaining:* ${rateLimitStats.remaining}/${rateLimitStats.limit}`,
      { parse_mode: "Markdown" }
    );
  });

  /**
   * /help - Show available commands
   */
  bot.command("help", async (ctx) => {
    const user = ctx.user;
    const isOperator = user?.role === "operator";

    let helpText =
      `🌿 *Green Goods Bot Help*\n\n` +
      `*Basic Commands:*\n` +
      `/start - Create wallet & get started\n` +
      `/join <address> - Join a garden\n` +
      `/status - Check your current status\n\n` +
      `*Submitting Work:*\n` +
      `Simply send a text or voice message describing your work!\n` +
      `Example: "I planted 5 trees today"\n\n`;

    if (isOperator) {
      helpText +=
        `*Operator Commands:*\n` +
        `/approve <id> - Approve a work submission\n` +
        `/reject <id> - Reject a work submission\n` +
        `/pending - List pending work for your garden\n\n`;
    }

    helpText += `_Need help? Contact @GreenGoodsSupport_`;

    await ctx.reply(helpText, { parse_mode: "Markdown" });
  });

  /**
   * /pending - List pending works (operator only)
   */
  bot.command("pending", async (ctx) => {
    const user = ctx.user;
    if (!user) {
      return ctx.reply("Please run /start first.");
    }

    if (user.role !== "operator") {
      return ctx.reply("This command is only available for operators.");
    }

    if (!user.currentGarden) {
      return ctx.reply("Please join a garden first with /join <address>");
    }

    const pendingWorks = storage.getPendingWorksForGarden(user.currentGarden);

    if (pendingWorks.length === 0) {
      return ctx.reply("No pending work submissions for your garden.");
    }

    let message = `📋 *Pending Work Submissions*\n\n`;
    for (const work of pendingWorks.slice(0, 10)) {
      message +=
        `*ID:* \`${work.id}\`\n` +
        `Gardener: \`${formatAddress(work.gardenerAddress)}\`\n` +
        `Title: ${work.data.title}\n` +
        `Plants: ${work.data.plantCount} (${work.data.plantSelection.join(", ")})\n\n`;
    }

    if (pendingWorks.length > 10) {
      message += `_...and ${pendingWorks.length - 10} more_\n\n`;
    }

    message += `Use \`/approve <id>\` or \`/reject <id>\` to process.`;

    await ctx.reply(message, { parse_mode: "Markdown" });
  });

  // -------------------------------------------------------------------------
  // MESSAGE HANDLERS
  // -------------------------------------------------------------------------

  /**
   * Voice message handler - Transcribe and process
   */
  bot.on(message("voice"), async (ctx) => {
    // Rate limit voice messages (more expensive to process)
    const rateLimitError = await checkRateLimit(ctx, "voice");
    if (rateLimitError) return ctx.reply(rateLimitError);

    const user = ctx.user;
    if (!user) {
      return ctx.reply("Please run /start first to create your wallet.");
    }

    if (!user.currentGarden) {
      return ctx.reply(
        "Please join a garden first with `/join <GardenAddress>`",
        { parse_mode: "Markdown" }
      );
    }

    const fileId = ctx.message.voice.file_id;
    const tempPath = path.resolve(`temp_${fileId}.ogg`);
    const wavPath = tempPath.replace(".ogg", ".wav");

    try {
      // Download voice file
      const fileLink = await ctx.telegram.getFileLink(fileId);
      await downloadFile(fileLink.href, tempPath);

      await ctx.reply("🎧 Processing your voice message...");

      // Transcribe
      const text = await ai.transcribe(tempPath);
      await ctx.reply(`📝 I heard: "${text}"\n\nAnalyzing...`);

      // Parse work data
      const workData = await ai.parseWorkText(text);

      // Store draft in session
      storage.setSession({
        telegramId: user.telegramId,
        step: "submitting_work",
        draft: workData,
      });

      // Show confirmation dialog
      await showConfirmationDialog(ctx, workData);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Voice processing error:", error);
      await ctx.reply(
        `❌ Sorry, I couldn't process that audio.\n\n` +
          `Error: ${message}\n\n` +
          `Try sending a text message instead.`
      );
    } finally {
      cleanupFile(tempPath);
      cleanupFile(wavPath);
    }
  });

  /**
   * Text message handler - Parse and process work submission
   */
  bot.on(message("text"), async (ctx) => {
    const text = ctx.message.text;

    // Ignore commands (handled separately)
    if (text.startsWith("/")) return;

    // Rate limit messages
    const rateLimitError = await checkRateLimit(ctx, "message");
    if (rateLimitError) return ctx.reply(rateLimitError);

    const user = ctx.user;
    if (!user) {
      return ctx.reply("Please run /start first to create your wallet.");
    }

    if (!user.currentGarden) {
      return ctx.reply(
        "Please join a garden first with `/join <GardenAddress>`",
        { parse_mode: "Markdown" }
      );
    }

    try {
      // Parse work data from text
      const workData = await ai.parseWorkText(text);

      if (workData.tasks.length === 0) {
        return ctx.reply(
          "🤔 I couldn't identify any work tasks from your message.\n\n" +
            "Try something like:\n" +
            '• "I planted 5 trees today"\n' +
            '• "Removed 10kg of weeds"\n' +
            '• "Planted 20 tomato seedlings"'
        );
      }

      // Store draft in session
      storage.setSession({
        telegramId: user.telegramId,
        step: "submitting_work",
        draft: workData,
      });

      // Show confirmation dialog
      await showConfirmationDialog(ctx, workData);
    } catch (error) {
      console.error("Text processing error:", error);
      await ctx.reply(
        "❌ Sorry, I couldn't process that message. Please try again."
      );
    }
  });

  // -------------------------------------------------------------------------
  // CALLBACK HANDLERS
  // -------------------------------------------------------------------------

  /**
   * Confirm work submission
   */
  bot.action("confirm_submission", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Rate limit submissions
    const result = rateLimiter.check(telegramId, "submission");
    if (!result.allowed) {
      const waitTime = formatRateLimitWait(result.resetIn);
      await ctx.answerCbQuery("Rate limited");
      return ctx.reply(
        `⏳ ${result.message}\n\nPlease wait ${waitTime} before submitting again.`
      );
    }

    const session = storage.getSession(telegramId);
    const user = storage.getUser(telegramId);

    if (!session?.draft || !user?.currentGarden) {
      await ctx.answerCbQuery("Session expired. Please try again.");
      return ctx.reply("Session expired or invalid. Please submit your work again.");
    }

    await ctx.answerCbQuery("Processing...");
    await ctx.editMessageReplyMarkup(undefined); // Remove buttons

    await ctx.reply("⛓️ Submitting to blockchain...");

    try {
      // Create WorkDraft from session
      const draft: WorkDraft = {
        actionUID: 0, // Default action
        title: "Telegram Submission",
        plantSelection: session.draft.tasks
          .filter((t) => t.species)
          .map((t) => t.species),
        plantCount: session.draft.tasks.reduce(
          (acc, t) => acc + (t.count || t.amount || 0),
          0
        ),
        feedback: session.draft.notes,
        media: [],
      };

      // Generate unique ID for pending work
      const pendingId = generateSecureId();

      // Store pending work for operator approval
      storage.addPendingWork({
        id: pendingId,
        actionUID: draft.actionUID,
        gardenerAddress: user.address,
        gardenerTelegramId: telegramId,
        gardenAddress: user.currentGarden,
        data: {
          ...draft,
          media: [], // No media for text submissions
        },
      });

      await ctx.reply(
        `✅ *Work submitted for approval!*\n\n` +
          `ID: \`${pendingId}\`\n\n` +
          `An operator will review your submission soon.`,
        { parse_mode: "Markdown" }
      );

      storage.clearSession(telegramId);

      // Notify operator if one exists
      const operator = storage.getOperatorForGarden(user.currentGarden);
      if (operator) {
        await bot.telegram.sendMessage(
          operator.telegramId,
          `🔔 *New Work Submission*\n\n` +
            `From: \`${formatAddress(user.address)}\`\n` +
            `ID: \`${pendingId}\`\n\n` +
            `${session.draft.notes}\n\n` +
            `Reply with \`/approve ${pendingId}\` to approve.`,
          { parse_mode: "Markdown" }
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Submission error:", error);
      await ctx.reply(`❌ Error submitting: ${message}`);
    }
  });

  /**
   * Cancel work submission
   */
  bot.action("cancel_submission", async (ctx) => {
    if (ctx.from) {
      storage.clearSession(ctx.from.id);
    }
    await ctx.answerCbQuery("Cancelled");
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.reply("❌ Submission cancelled.");
  });

  // -------------------------------------------------------------------------
  // OPERATOR COMMANDS
  // -------------------------------------------------------------------------

  /**
   * /approve - Approve a pending work submission
   */
  bot.command("approve", async (ctx) => {
    // Rate limit approvals
    const rateLimitError = await checkRateLimit(ctx, "approval");
    if (rateLimitError) return ctx.reply(rateLimitError);

    const args = ctx.message.text.split(" ");
    const workId = args[1];

    if (!workId) {
      return ctx.reply(
        "📍 *Usage:* `/approve <WorkID>`\n\nExample: `/approve abc123`",
        { parse_mode: "Markdown" }
      );
    }

    const user = ctx.user;
    if (!user) {
      return ctx.reply("Please run /start first.");
    }

    const pendingWork = storage.getPendingWork(workId);
    if (!pendingWork) {
      return ctx.reply("❌ Work not found or already processed.");
    }

    // Verify user is an operator for the garden
    const gardenAddress = pendingWork.gardenAddress || user.currentGarden;
    if (!gardenAddress) {
      return ctx.reply("❌ Cannot determine garden for this work.");
    }

    await ctx.reply("🔍 Verifying operator permissions...");

    const verification = await verificationService.isOperator(gardenAddress, user.address);
    if (!verification.verified) {
      return ctx.reply(
        `❌ *Permission Denied*\n\n${verification.reason}\n\n` +
          `Only registered operators can approve work for this garden.`,
        { parse_mode: "Markdown" }
      );
    }

    await ctx.reply(`⛓️ Approving work ${workId}...`);

    try {
      const account = privateKeyToAccount(user.privateKey as Hex);
      const chain = baseSepolia;

      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(),
      });

      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });

      // Submit work attestation on-chain
      const tx = await submitWorkBot(
        walletClient,
        publicClient,
        pendingWork.data as unknown as WorkDraft,
        pendingWork.gardenAddress || user.currentGarden || "0x0000000000000000000000000000000000000000",
        pendingWork.actionUID,
        "Telegram Action",
        chain.id,
        []
      );

      await ctx.reply(
        `✅ *Work approved and attested!*\n\n` +
          `Tx: \`${tx}\``,
        { parse_mode: "Markdown" }
      );

      storage.removePendingWork(workId);

      // Notify gardener
      await bot.telegram.sendMessage(
        pendingWork.gardenerTelegramId,
        `🎉 *Your work has been approved!*\n\n` +
          `ID: \`${workId}\`\n` +
          `Tx: \`${tx}\``,
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Approval error:", error);
      await ctx.reply(`❌ Error approving: ${message}`);
    }
  });

  /**
   * /reject - Reject a pending work submission
   */
  bot.command("reject", async (ctx) => {
    // Rate limit approvals (same limit as approve)
    const rateLimitError = await checkRateLimit(ctx, "approval");
    if (rateLimitError) return ctx.reply(rateLimitError);

    const args = ctx.message.text.split(" ");
    const workId = args[1];
    const reason = args.slice(2).join(" ") || "No reason provided";

    if (!workId) {
      return ctx.reply(
        "📍 *Usage:* `/reject <WorkID> [reason]`\n\n" +
          "Example: `/reject abc123 Insufficient documentation`",
        { parse_mode: "Markdown" }
      );
    }

    const user = ctx.user;
    if (!user) {
      return ctx.reply("Please run /start first.");
    }

    const pendingWork = storage.getPendingWork(workId);
    if (!pendingWork) {
      return ctx.reply("❌ Work not found or already processed.");
    }

    // Verify user is an operator for the garden
    const gardenAddress = pendingWork.gardenAddress || user.currentGarden;
    if (!gardenAddress) {
      return ctx.reply("❌ Cannot determine garden for this work.");
    }

    const verification = await verificationService.isOperator(gardenAddress, user.address);
    if (!verification.verified) {
      return ctx.reply(
        `❌ *Permission Denied*\n\n${verification.reason}\n\n` +
          `Only registered operators can reject work for this garden.`,
        { parse_mode: "Markdown" }
      );
    }

    // Remove pending work
    storage.removePendingWork(workId);

    await ctx.reply(`❌ Work ${workId} rejected.\n\nReason: ${reason}`);

    // Notify gardener
    await bot.telegram.sendMessage(
      pendingWork.gardenerTelegramId,
      `❌ *Your work has been rejected*\n\n` +
        `ID: \`${workId}\`\n` +
        `Reason: ${reason}\n\n` +
        `Please try again with more details or photos.`,
      { parse_mode: "Markdown" }
    );
  });

  return bot;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Shows a confirmation dialog for work submission.
 */
async function showConfirmationDialog(
  ctx: NarrowedContext<BotContext, Update.MessageUpdate<Message.TextMessage | Message.VoiceMessage>>,
  workData: ParsedWorkData
): Promise<void> {
  const tasksSummary = workData.tasks
    .map((t) => {
      if (t.count) return `• ${t.type}: ${t.count} ${t.species}`;
      if (t.amount) return `• ${t.type}: ${t.amount}${t.unit} ${t.species}`;
      return `• ${t.type}: ${t.species}`;
    })
    .join("\n");

  await ctx.reply(
    `📋 *Confirm your submission:*\n\n` +
      `*Tasks:*\n${tasksSummary}\n\n` +
      `*Notes:* ${workData.notes}\n` +
      `*Date:* ${workData.date}`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        Markup.button.callback("✅ Submit", "confirm_submission"),
        Markup.button.callback("❌ Cancel", "cancel_submission"),
      ]),
    }
  );
}
