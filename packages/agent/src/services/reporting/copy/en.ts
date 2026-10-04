/**
 * English reporting copy. Deterministic templates: the conversation model may phrase a permitted
 * question, but every summary, disclosure and outcome comes from these strings and validated
 * state. `{name}` placeholders are filled by `reportingText`.
 */
export const EN_REPORTING_COPY = {
  "consent.notice":
    "Hi! I'm the Green Goods reporting assistant. To help you report garden work, I store and read the messages and files you send here{processors}. Nothing becomes public until you confirm a report.\n\nSend STOP at any time to stop, DELETE to remove your unpublished data, or HELP for support ({support}).\n\nDo you agree?",
  "consent.processors": " and may use AI to understand them",
  "consent.agree": "I agree",
  "consent.decline": "No thanks",
  "consent.declined":
    "Okay. I won't process your messages, and I've removed what you sent. Contact {support} if you change your mind.",
  "consent.granted": "Thank you! Tell me about the work you did. You can send text and photos.",
  "consent.stopped":
    "You've stopped the assistant. I won't read new messages until you send START. Published reports stay public; unpublished drafts are being removed. Support: {support}",
  "consent.deleted":
    "Your unpublished drafts and files are being deleted. Published reports stay public on chain and IPFS and can't be removed. Support: {support}",
  help: "Green Goods reporting:\n• Describe your work and send photos to start a report.\n• NEW starts a new report, STATUS shows where you are, CANCEL cancels the current report.\n• Stewards: send REVIEW to see work waiting for review.\n• CONNECT, or your account address on its own, links your Green Goods account: open the verification link I send and return here with PAIR followed by its six-digit code. You can link Telegram and WhatsApp to the same account. RECOVER reconnects an account after losing chat access.\n• STOP stops processing, DELETE removes unpublished data.\nSupport: {support}",
  "intake.paused":
    "Reporting is paused for maintenance. Your message is saved and I'll reply when it resumes. Support: {support}",
  "media.photoAdded": "Photo added to your report.",
  "media.fileRead": "I read your file and added what I could to your report.",
  "media.fileKept": "I saved your file privately. I'll ask you for the details instead.",
  "media.tooLarge": "That file is larger than 10 MB, so I can't use it. Your report is saved.",
  "media.unsupported":
    "I can't use that kind of file. Your report is saved; send photos (JPEG, PNG or WebP), a PDF, a Word or Excel file, a CSV, or type the details.",
  "media.unreadable":
    "I couldn't read that file. It may be damaged, password-protected or contain macros. Your report is saved; send it again as a PDF or photos, or type the details.",
  "media.pdfTooLong":
    "That document has more than 20 pages, so I didn't read it. Send the pages that matter as a shorter PDF or photos.",
  "media.voiceOff": "Voice notes aren't supported yet. Please type your update.",
  "media.voicePaused": "I can't listen to voice notes right now. Please type your update.",
  "media.voiceTooLong":
    "That voice note is longer than 2 minutes, so I didn't send it anywhere. Send a shorter one or type your update.",
  "media.voiceEmpty":
    "I couldn't hear any words in that voice note. Please try again or type your update.",
  "media.voiceFailed":
    "I couldn't transcribe that voice note. Your report is saved; please try again or type your update.",
  "voice.consent":
    "Can I transcribe your voice notes? I send the recording to an AI service to turn it into text, add the text to your report and show it to you to check. The recording itself is never published.",
  "voice.agree": "Yes, transcribe",
  "voice.decline": "No, I'll type",
  "voice.granted": "Thank you. I'm transcribing your voice note now.",
  "voice.declined": "OK, I won't transcribe voice notes. Please type your update instead.",
  "voice.heard": "I heard: “{transcript}”\nIf I got anything wrong, just send the correction.",
  "media.documentsOff":
    "I saved your file privately, but reading documents is turned off right now. Please type the key details or send photos.",
  "media.fetchFailed": "I couldn't download your file. Please send it again.",
  "media.late": "That file arrived after your report was confirmed, so it wasn't added.",
  "media.hiddenExcluded":
    "Some sheets, rows or columns in your spreadsheet were hidden, so I left them out.",
  "media.partial":
    "I could only read part of that file. Please check the summary carefully before confirming.",
  "media.wordNative":
    "I read the Word document's text, but couldn't read its pictures or charts. Please check the summary before confirming.",
  "media.spreadsheetNative":
    "I read the spreadsheet's visible cells, but couldn't read its pictures or charts. Please check the summary before confirming.",
  "report.askGarden": "Which garden is this report for?",
  "report.askOwnGarden": "Which of your gardens is this report for?",
  "report.otherGardens": "Other gardens",
  "report.gardensUnavailable":
    "I can't load the list of gardens right now. Your message is saved; please send another message in a few minutes. Support: {support}",
  "report.askAction": "Which activity in {garden} best matches your work?",
  "report.moreChoices": "More options",
  "report.noActions":
    "{garden} has no activity open for reporting right now. Your draft is saved. Send EDIT to choose another garden, or contact {support} if this is unexpected.",
  "report.catalogUnavailable":
    "I couldn't load {garden}'s activities just now. That's a problem on my side, and your draft is saved. Tap Try again or send any message.",
  "report.tryAgain": "Try again",
  "report.choiceHelp":
    "I didn't catch which one you mean. Tap a choice below or reply with its number. Send HELP to see everything I can do, or CANCEL to stop this report.",
  "report.askNumber": "{title}? Please reply with a number{unit}.",
  "report.askChoice": "{title}?",
  "report.askMulti": "{title}? You can pick more than one, for example: 1, 3.",
  "report.askText": "{title}?",
  "report.askTime": "How much time did you spend on this work? For example: 2 hours or 45 minutes.",
  "report.askTimeUnit": "Was that {value} hours or {value} minutes?",
  "report.hours": "Hours",
  "report.minutes": "Minutes",
  "report.askTitle": "What title should this report have?",
  "report.askFeedback": "Please describe the work you did in a sentence or two.",
  "report.askEvidence": "Please send {count} photo(s) of the work.",
  "report.evidenceLimit":
    "This activity accepts up to {maximum} photos, so I didn't add the last one.",
  "report.photoAdded": "Photo received ({have} so far).",
  "report.conflict":
    "You told me “{current}” for {field}, but “{proposed}” was suggested from {source}. Which is right?",
  "report.keepCurrent": "Keep {current}",
  "report.useProposed": "Use {proposed}",
  "report.unsupportedInput":
    "{action} needs a list ({field}) I can't collect in chat yet. Please choose another activity or submit this one in the Green Goods app. Your draft is saved.",
  "report.invalid.not_a_number": "Please reply with a number, for example 12.",
  "report.invalid.ambiguous_number":
    "Did you mean a whole number or a decimal? Please write it without a thousands separator, for example 1200 or 1.2.",
  "report.invalid.negative": "Please reply with a number of zero or more.",
  "report.invalid.unit_mismatch":
    "This is counted in {unit}, but you wrote {stated}. Could you give it in {unit}?",
  "report.invalid.unit_required": "Please include the unit, for example 2 hours or 30 minutes.",
  "report.invalid.too_long": "That's a little long. Could you shorten it?",
  "report.invalid.empty": "I didn't catch an answer. Could you try again?",
  "report.summary":
    "Please check your report for {garden}:\n• Activity: {action}\n• Title: {title}\n• Time spent: {time}\n• Description: {feedback}{details}\n• Photos: {photos}\n\nWhen published, the title, description, details and photos become public on Arbitrum and IPFS and cannot be deleted.{account}\n\nReply CONFIRM {token} to publish, EDIT to change something, or CANCEL.",
  "report.summaryAccount": "\nIt will be published by your account {account}.",
  "report.confirm": "Confirm",
  "report.edit": "Edit",
  "report.cancel": "Cancel",
  "edit.garden": "Garden",
  "edit.action": "Activity",
  "edit.title": "Title",
  "edit.time": "Time spent",
  "edit.feedback": "Description",
  "report.editPrompt":
    "What would you like to change? Just tell me, for example: “time was 3 hours”.",
  "report.cancelled": "Report cancelled. Unpublished content will be removed.",
  "report.cancelHint": "To cancel this report, reply CANCEL.",
  "report.nothingToCancel": "There's no report in progress.",
  "report.confirmToken": "To publish, reply CONFIRM {token} exactly as shown in the summary.",
  "report.frozen":
    "This report is being published, so I can't change it now. I've kept your message and will use it if publishing doesn't complete.",
  "report.alreadyPublished": "That report is already published. Send NEW to start another report.",
  "report.newStarted": "New report started. Tell me about the work you did.",
  "report.resumeFirst":
    "You have a report in progress. Send CANCEL to discard it or keep going with it.",
  "report.status": "Your report for {garden} is {state}.",
  "state.collecting": "still being filled in",
  "state.review": "waiting for your confirmation",
  "state.authority": "waiting for account checks",
  "state.preparing": "being prepared for publishing",
  "state.signature": "waiting for your signature",
  "state.publishing": "being published",
  "report.noStatus": "You don't have a report in progress. Describe your work to start one.",
  "report.expired":
    "Your unfinished report expired after 7 days without activity, so its private content was removed.",
  "link.request":
    "To publish, verify your existing Green Goods account (wallet or passkey) here. The link expires in 10 minutes and never moves funds.",
  "link.label": "Verify account",
  "link.pairHint": "When the page shows a code, send it here as: PAIR 123456",
  "link.paired": "Your account {account} is now linked.{gardens}",
  "link.gardens": "\nYour gardens: {gardens}.",
  "link.gardensMore": "{gardens} and {count} more",
  "link.noGardens": "\nI don't see it in a garden yet. A garden steward can add you.",
  "link.offer":
    "Before your first report, connect your Green Goods account so I can show your gardens. Or skip this and tell me about the work you did; I'll ask you to connect when you publish.",
  "link.offerLabel": "Connect account",
  "link.offerDeclined":
    "No problem. Tell me about the work you did; you can send text and photos. Send CONNECT whenever you want to link your account.",
  "link.connect":
    "To connect your Green Goods account (wallet or passkey), verify it here. The link expires in 10 minutes and never moves funds.",
  "link.connectNamed":
    "{account} is in: {gardens}.\nTo connect it to this chat, verify it here with that account. The link expires in 10 minutes and never moves funds.",
  "link.connectNamedNoGardens":
    "I don't see {account} in a garden yet.\nTo connect it to this chat, verify it here with that account. The link expires in 10 minutes and never moves funds.",
  "link.already": "This chat is linked to {account}.{gardens}",
  "link.pairFailed":
    "That code doesn't match an open verification. Check the code on the Green Goods page.",
  "link.accountMismatch":
    "This chat is linked to a different account. Verify with {account} or contact {support}.",
  "link.accountTaken":
    "That account is already linked to another chat. If it's yours, send RECOVER from the chat you want to use. Support: {support}",
  "publish.consent":
    "Publish your confirmed report to {garden} from {account}? The title, description, details and photos become public and cannot be deleted. Reply PUBLISH {token} to continue.",
  "publish.publish": "Publish",
  "publish.signLink": "Open this page to review and sign the exact publication with your {kind}.",
  "publish.signLabel": "Review and publish",
  "publish.grantOffer":
    "Your passkey account can let Green Goods publish your future reports to {garden} after you confirm each one here: up to {count} reports in 24 hours, reports only, revocable any time. Or publish just this report.",
  "publish.allowReporting": "Allow reporting in chat",
  "publish.thisReportOnly": "Publish this report only",
  "publish.roleMissing":
    "Your account isn't a gardener in {garden}, so I can't publish there. Your report is saved; ask a garden steward to add you, then reply RETRY.",
  "publish.paused":
    "Publishing is paused right now. Your confirmed report is saved and will continue when publishing resumes.",
  "publish.preparationFailed":
    "I couldn't prepare your report for publishing. Your report is saved; reply RETRY to try again.",
  "publish.sending": "Publishing your report now. I'll confirm when it's on chain.",
  "publish.uncertain":
    "Your publication was sent but I can't confirm it on chain yet. I won't send it twice; I'll tell you when I know.",
  "publish.unknown":
    "I didn't hear back from your wallet, so I can't tell yet whether it was sent. I won't send it again; I'm checking the chain and will tell you what I find.",
  "publish.rejected":
    "The signature was declined, so nothing was published. Here is your report again; confirm it when you're ready.",
  "publish.reverted":
    "The publication failed on chain. Your report is saved; check it and confirm again to retry.",
  "publish.published": "Your report is published ✅\nWork: {uid}\nTransaction: {tx}",
  "grant.active":
    "Reporting in chat is on for {garden} until {until}. I'll still ask you to confirm each report.",
  "grant.unavailable":
    "I can't publish this one from chat: the reporting permission is paused, used up or has ended. Confirm again and I'll send you a page to sign it yourself.",
  "grant.paused":
    "Reporting permission is paused. I'll ask you to publish with your passkey instead.",
  "review.pendingList": "Work waiting for your review in {garden}. Choose one to start:",
  "review.none": "There's no work waiting for your review.",
  "review.askDecision": "Do you approve or reject “{title}” by {gardener}?",
  "review.approve": "Approve",
  "review.reject": "Reject",
  "review.askConfidence": "How confident are you in this work?",
  "review.confidence.1": "Low",
  "review.confidence.2": "Medium",
  "review.confidence.3": "High",
  "review.askFeedback":
    "Add feedback for the gardener (it will be public). For an approval you can reply SKIP.",
  "review.summary":
    "Your review of “{title}” in {garden}:\n• Decision: {decision}\n• Confidence: {confidence}\n• Feedback: {feedback}\n• Method: human review\n\nThe decision and feedback become public on Arbitrum.\nReply CONFIRM {token} to record it, EDIT to change it, or CANCEL.",
  "review.selfReview": "You can't review your own work.",
  "review.notSteward": "Your account isn't a steward of {garden}, so you can't review this work.",
  "review.notOperator":
    "Your account isn't a steward of any garden, so there's no work for you to review.",
  "review.recorded": "Your review is recorded ✅\nTransaction: {tx}",
  "account.wallet": "wallet",
  "account.passkey": "passkey",
  "review.link":
    "To review work, verify your existing Green Goods account (wallet or passkey) here. The link expires in 10 minutes and never moves funds.",
  "review.confidence.0": "None",
  "review.askRejectionFeedback":
    "Tell the gardener why you're rejecting this work (it will be public).",
  "review.noFeedback": "(none)",
  "review.feedbackInvalid": "Please send feedback of up to 2,000 characters.",
  "review.frozen": "This review can't be changed now because it is already being recorded.",
  "review.confirmToken":
    "To record your review, reply CONFIRM {token} exactly as shown in the summary.",
  "review.cancelled": "Review cancelled. Nothing was recorded.",
  "review.signLink": "Open this page to check and sign your decision with your {kind}.",
  "review.signLabel": "Check and sign",
  "review.grantLink":
    "Open this page to record this confirmed decision and allow up to 5 reviews, including this one, for this garden over 1 hour. You must confirm every review separately in chat.",
  "review.grantLabel": "Allow reviews in chat",
  "review.rejectedBeforeSend":
    "The signature was declined, so your review wasn't recorded. Here it is again; confirm it when you're ready.",
  "review.reverted": "Recording your review failed on chain. Check it and confirm again to retry.",
  "recovery.started":
    "To move your Green Goods account to this chat, open this page and verify the account you used before. The link expires in 10 minutes.",
  "recovery.code": "Enter this code on the Green Goods recovery page: {code}",
  "recovery.completed":
    "This chat is now linked to your account. Your old chat no longer has access, and any chat reporting permission is paused until you approve it again.",
  "recovery.label": "Move my account",
  "recovery.alreadyLinked": "This chat is already linked to {account}. Nothing needs to be moved.",
  "recovery.draftOpen": "Finish or cancel the report in this chat first, then send RECOVER again.",
  "recovery.suspended":
    "This chat's access is paused while your account moves to another chat. Support: {support}",
  "error.generic": "Something went wrong on my side. Your report is saved. Support: {support}",
} as const;

export type ReportingCopyKey = keyof typeof EN_REPORTING_COPY;
