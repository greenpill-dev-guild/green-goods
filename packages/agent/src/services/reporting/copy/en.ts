/**
 * English reporting copy. Deterministic templates: the conversation model may phrase a permitted
 * question, but every summary, disclosure and outcome comes from these strings and validated
 * state. `{name}` placeholders are filled by `reportingText`.
 */
export const EN_REPORTING_COPY = {
  "consent.notice":
    "Hi! I'm the Green Goods reporting assistant, operated by WEFA. To help you report garden work, I store and read the messages and files you send here{processors}. Nothing becomes public until you confirm a report.\n\nSend STOP at any time to stop, DELETE to remove your unpublished data, or HELP for support ({support}).\n\nDo you agree?",
  "consent.processors": " and may use OpenAI and TypeSafe to understand them",
  "consent.agree": "I agree",
  "consent.decline": "No thanks",
  "consent.declined":
    "Okay. I won't process your messages, and I've removed what you sent. Contact {support} if you change your mind.",
  "consent.granted": "Thank you! Tell me about the work you did. You can send text and photos.",
  "consent.stopped":
    "You've stopped the assistant. I won't read new messages until you send START. Published reports stay public; unpublished drafts are being removed. Support: {support}",
  "consent.deleted":
    "Your unpublished drafts and files are being deleted. Published reports stay public on chain and IPFS and can't be removed. Support: {support}",
  help: "Green Goods reporting:\n• Describe your work and send photos to start a report.\n• NEW starts a new report, STATUS shows where you are, CANCEL cancels the current report.\n• STOP stops processing, DELETE removes unpublished data.\nSupport: {support}",
  "intake.paused":
    "Reporting is paused for maintenance. Your message is saved and I'll reply when it resumes. Support: {support}",
  "media.photoAdded": "Photo added to your report.",
  "media.fileRead": "I read your file and added what I could to your report.",
  "media.tooLarge": "That file is larger than 10 MB, so I can't use it. Your report is saved.",
  "media.unsupported":
    "I can't use that kind of file. Your report is saved; send photos (JPEG, PNG or WebP), a PDF, a Word or Excel file, a CSV, or type the details.",
  "media.unreadable":
    "I couldn't read that file. It may be damaged, password-protected or contain macros. Your report is saved; send it again as a PDF or photos, or type the details.",
  "media.pdfTooLong":
    "That document has more than 20 pages, so I didn't read it. Send the pages that matter as a shorter PDF or photos.",
  "media.voiceOff": "Voice notes aren't supported yet. Please type your update.",
  "media.documentsOff":
    "I saved your file privately, but reading documents is turned off right now. Please type the key details or send photos.",
  "media.fetchFailed": "I couldn't download your file. Please send it again.",
  "media.late": "That file arrived after your report was confirmed, so it wasn't added.",
  "media.hiddenExcluded":
    "Some sheets, rows or columns in your spreadsheet were hidden, so I left them out.",
  "media.partial":
    "I could only read part of that file. Please check the summary carefully before confirming.",
  "report.askGarden": "Which garden is this report for?",
  "report.noGardens":
    "No garden is set up for reporting yet. Your message is saved. Support: {support}",
  "report.askAction": "Which activity in {garden} best matches your work?",
  "report.moreChoices": "More options",
  "report.noActions":
    "{garden} has no activity open for reporting right now. Your draft is saved; contact {support} if this is unexpected.",
  "report.catalogUnavailable":
    "I can't read {garden}'s activities right now. Your draft is saved; send any message to try again.",
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
  "report.invalid.unknown_option":
    "Please choose one of the listed options by replying with its number.",
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
  "link.paired": "Your account {account} is now linked.",
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
  "review.rejectedBeforeSend":
    "The signature was declined, so your review wasn't recorded. Here it is again; confirm it when you're ready.",
  "review.reverted": "Recording your review failed on chain. Check it and confirm again to retry.",
  "recovery.started":
    "To move your Green Goods account to this chat, open this page and verify the account you used before. The link expires in 10 minutes.",
  "recovery.code": "Send this code in the browser recovery page: {code}",
  "recovery.completed":
    "This chat is now linked to your account. Your old chat no longer has access, and any chat reporting permission is paused until you approve it again.",
  "error.generic": "Something went wrong on my side. Your report is saved. Support: {support}",
} as const;

export type ReportingCopyKey = keyof typeof EN_REPORTING_COPY;
