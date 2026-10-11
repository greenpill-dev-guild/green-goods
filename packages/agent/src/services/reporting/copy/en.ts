/**
 * English reporting copy. Deterministic templates: the conversation model may phrase a permitted
 * question, but every summary, disclosure and outcome comes from these strings and validated
 * state. `{name}` placeholders are filled by `reportingText`.
 */
export const EN_REPORTING_COPY = {
  "link.browserHint":
    "Open it in Safari or Chrome. If it opens inside the chat app, use that page's menu to open it in your browser, or copy the link.",
  "link.copyButton": "Copy link",
  "link.copyAddress": "Copy address",
  "chat.welcomeLinked":
    "Hi! This chat is connected to {account}.{gardens}\nTell me what you worked on, in your own words, and send photos if you have them. To use a different account, send SWITCH.",
  "chat.hello": "Hi! Your report is still open, so here's where we were.",
  "link.notLinked": "This chat isn't connected to an account. Send CONNECT to link one.",
  "link.disconnected":
    "Done. This chat is no longer connected to {account}, and any chat reporting permission you approved for it is paused. Send CONNECT to link an account.",
  "link.disconnectBusy":
    "A report or review is on its way out with this account, so I can't disconnect it yet. Finish or cancel it, then send DISCONNECT again.",
  "link.disconnectHint":
    "To disconnect this chat from your account, send DISCONNECT. To use a different account, send SWITCH.",
  "report.explainGarden":
    "These are the gardens your account is in. Pick the one where you did this work, or join another garden.",
  "report.explainGardenUnlinked":
    "A garden is the community or place your work belongs to. Pick the one where you did this work, or send CONNECT to link your account and choose from your own gardens.",
  "report.explainAction":
    "These are the kinds of work {garden} is tracking right now. Pick the closest match to what you did; the details come next.",
  "report.explainField": "{title}: {hint}. Pick the option that fits best.",
  "report.explainNumber": "{title} is a number{unit}: {hint}. For example, 12.",
  "report.explainNumberPlain": "{title} is a number{unit}. For example, 12.",
  "report.fieldLead": "{title}?",
  "report.fieldLeadHint": "{title}: {hint}.",
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
  help: "Green Goods reporting:\n• Describe your work and send photos to start a report.\n• NEW starts a new report, STATUS shows where you are, CANCEL cancels the current report.\n• GARDEN changes the garden for your report, and JOIN shows how to join another garden.\n• Stewards: send REVIEW to see work waiting for review.\n• CONNECT, or your account address on its own, links your Green Goods account: open the verification link I send and send the six-digit code alone in this chat. You can link Telegram and WhatsApp to the same account. RECOVER reconnects an account after losing chat access.\n• DISCONNECT unlinks your account from this chat, and SWITCH links a different one.\n• STOP stops processing, DELETE removes unpublished data.\nSupport: {support}",
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
  "report.joinAnother": "Join another garden",
  "report.changeGarden": "Change garden",
  "report.gardenTaken": "{garden} is your only garden, so I'll use it for this report.{how}",
  "report.gardenTakenWords": " Send GARDEN to change it, or JOIN to join another garden.",
  "report.gardenDropped": "This account isn't in {garden}, so your report needs another garden.",
  "report.gardenUnlisted":
    "The garden this report was for no longer takes reports from chat, so it needs another garden.",
  "report.joinFirst":
    "I don't see {account} in a garden yet, so there's nowhere to send this report. It's saved.\n\nJoin the Community Garden below, or ask a steward of your garden to add this account. A garden you just joined can take a few minutes to show here.",
  "report.joinFirstSteward":
    "I don't see {account} in a garden yet, so there's nowhere to send this report. It's saved.\n\nAsk a steward of your garden to add this account. It can take a few minutes to show here once they do.",
  "report.joinAnotherHow":
    "Your account {account} can report to the gardens it's in.\n\nTo add one, join the Community Garden below, or ask a steward of another garden to add this account. A garden you just joined can take a few minutes to show here.",
  "report.joinAnotherSteward":
    "Your account {account} can report to the gardens it's in. To add one, ask a steward of that garden to add this account. It can take a few minutes to show here once they do.",
  "report.checkAgain": "Check again",
  "report.showMyGardens": "Show my gardens",
  "report.gardensUnavailable":
    "I can't load the list of gardens right now. Your message is saved; please send another message in a few minutes. Support: {support}",
  "report.ownGardensUnavailable":
    "I can't load your gardens right now. That's a problem on my side, and your report is saved. Tap Try again or send any message.",
  "report.questionPosition": "{position} of {total} · ",
  "report.actionAdoptedOne":
    "Got it: {action} at {garden}. 1 quick question, then a summary to check.",
  "report.actionAdoptedMany":
    "Got it: {action} at {garden}. {count} quick questions, then a summary to check.",
  "report.askAction": "Which activity in {garden} best matches your work?",
  "report.moreChoices": "More options",
  "report.noActions":
    "{garden} has no activity open for reporting right now. Your draft is saved. Send EDIT to choose another garden, or contact {support} if this is unexpected.",
  "report.catalogUnavailable":
    "I couldn't load {garden}'s activities just now. That's a problem on my side, and your draft is saved. Tap Try again or send any message.",
  "report.tryAgain": "Try again",
  "report.choiceHelp":
    "I'm not sure which one you mean. Tap a choice below or reply with its number. Send HELP to see everything I can do, or CANCEL to stop this report.",
  "report.askNumber": "{title} Send just the number{unit}.",
  "report.askChoice": "{title}",
  "report.askMulti": "{title} You can pick more than one, for example: 1, 3.",
  "report.askText": "{title}",
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
  "report.summaryButtonInstruction": "Tap Confirm to publish, Edit to change something, or Cancel.",
  "report.summaryCodeInstruction":
    "Reply CONFIRM {token} to publish, EDIT to change something, or CANCEL.",
  "publish.consentButtonInstruction": "Tap Publish to continue.",
  "publish.consentCodeInstruction": "Reply PUBLISH {token} to continue.",
  "review.summaryButtonInstruction": "Tap Confirm to record it, Edit to change it, or Cancel.",
  "review.summaryCodeInstruction":
    "Reply CONFIRM {token} to record it, EDIT to change it, or CANCEL.",
  "report.summary":
    "Please check your report for {garden}:\n• Activity: {action}\n• Title: {title}\n• Time spent: {time}\n• Description: {feedback}{details}\n• Photos: {photos}\n\nWhen published, the title, description, details and photos become public on Arbitrum and IPFS and cannot be deleted.{account}\n\n{instruction}",
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
  "report.confirmToken": "To publish, reply CONFIRM {token}.",
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
  "link.pairHint": "When the page shows a code, send the six digits alone here.",
  "link.otherAccountHint":
    "The page opens with the account your browser last used. To link another, tap “Use a different account” there.",
  "link.paired": "Your account {account} is now linked.{gardens}",
  "link.gardens": "\nYour gardens: {gardens}.",
  "link.gardensMore": "{gardens} and {count} more",
  "link.gardensUnknown": "\nI can't load your gardens right now.",
  "link.joinCommunity": "Open this link to join the Community Garden with {account}.",
  "link.joinCommunityQuestion":
    "I don't see your account in this garden yet. Join the Community Garden, then tap I've joined.",
  "link.joinCommunityLabel": "Join the Community Garden",
  "link.joined": "I've joined",
  "link.noGardens":
    "\nI don't see it in a garden yet. A garden you just joined can take a few minutes to show here.",
  "link.offer":
    "Hi! I help you report garden work on Green Goods. Want to connect your account first, so I can show your gardens? You can also just tell me what you did, and I'll ask you to connect when you publish.",
  "link.offerLabel": "Connect account",
  "link.offerDeclined":
    "No problem. Tell me about the work you did; you can send text and photos. Send CONNECT whenever you want to link your account.",
  "link.connect":
    "To connect your Green Goods account (wallet or passkey), verify it here. The link expires in 10 minutes and never moves funds.",
  "link.connectNamed":
    "{account} is in: {gardens}.\nTo connect it to this chat, verify it here with that account. The link expires in 10 minutes and never moves funds.",
  "link.connectNamedNoGardens":
    "I don't see {account} in a garden yet.\nTo connect it to this chat, verify it here with that account. The link expires in 10 minutes and never moves funds.",
  "link.already":
    "This chat is connected to {account}.{gardens}\nTo use a different account, send SWITCH.",
  "link.pairFailed":
    "That code doesn't match an open verification. Check the code on the Green Goods page.",
  "link.accountMismatch":
    "This chat is linked to a different account. Verify with {account} or contact {support}.",
  "link.accountTaken":
    "That account is already linked to another chat. If it's yours, send RECOVER from the chat you want to use. Support: {support}",
  "publish.consent":
    "Publish your confirmed report to {garden} from {account}? The title, description, details and photos become public and cannot be deleted. {instruction}",
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
  "publish.confirmed":
    "The transaction is confirmed. I'm checking the attestation details and will send the link when I have it. You don't need to sign or send anything again.",
  "publish.viewAttestation": "View attestation",
  "publish.viewTransaction": "View transaction",
  "publish.published": "Your report is published ✅",
  "grant.active":
    "Reporting in chat is on for {garden} until {until}. I'll still ask you to confirm each report.",
  "grant.unavailable":
    "I can't publish this one from chat: the reporting permission is paused, used up or has ended. Confirm again and I'll send you a page to sign it yourself.",
  "grant.paused":
    "Reporting permission is paused. I'll ask you to publish with your passkey instead.",
  "grant.spent":
    "The reporting permission for this garden is used up for now. I'll ask you to publish with your passkey instead.",
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
    "Your review of “{title}” in {garden}:\n• Decision: {decision}\n• Confidence: {confidence}\n• Feedback: {feedback}\n• Method: human review\n\nThe decision and feedback become public on Arbitrum.\n{instruction}",
  "review.selfReview": "You can't review your own work.",
  "review.notSteward": "Your account isn't a steward of {garden}, so you can't review this work.",
  "review.notOperator":
    "Your account isn't a steward of any garden, so there's no work for you to review.",
  "review.recorded": "Your review is recorded ✅",
  "review.viewWork": "View the work",
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
