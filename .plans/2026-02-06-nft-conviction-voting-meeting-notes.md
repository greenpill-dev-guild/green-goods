Feb 6, 2026

## Meeting Feb 6, 2026 at 17:09 PST

### Summary

**Implementing NFT Revocation Hook**  
The meeting established the feasibility of integrating NFTs for voting power, concluding that a specialized hook is required to instantly recompute conviction and support when NFT ownership is revoked. This solution necessitates an on-chain transaction or side effect to trigger the conviction update on all current proposals.

**Decoupling Staking From Conviction**  
Based on UX audit feedback, the strategic decision was made to make the covenant optional and decouple token staking from core community membership requirements. This change is intended to reduce complexity, enable diverse pool configurations, and allow Gardens to focus primarily on validating conviction voting use cases.

**Streamlining User Experience**  
The future focus is on streamlining the user experience, particularly for basic voting, by implementing a "Gardens light" approach that minimizes unnecessary transactions. Technical plans include configuring an NFT power registry to handle voting power and using batch calls to consolidate user actions upon joining a community.

### Details

**Decisions**

*Rate these decisions:* [Helpful](https://bit.ly/4j0NRI9) or [Not Helpful](https://bit.ly/4p4GaCr)

NEEDS FURTHER DISCUSSION

**Target Younger Gen Z Audience**

Strategic focus must shift toward younger Gen Z audiences at university and civic levels. Prioritize simple user experience where pool acts as application entry.

**Compound Voting Protections**

Implement ability to chain and compound multiple voting protections. Example protections include Passport score and allow lists.

**Reduce Audit Surface Features**

Optional features like staking process must be fully cut out of V2 main codebase. Removal lowers audit surface for security review.

**Governance Token Optionality Needs Review**

Exploration needed regarding optional governance token connection to conviction voting. Proposal allows creation of conviction pools based solely on NFT membership.

ALIGNED

**Implement NFT Voting Power**

New pool configuration implements NFT voting power allowing inputting multiple NFT addresses to derive voting power. NFT voting power mechanism uses delegate function and sync power facet.

**Implement Conviction Delegation Function**

Add delegate function for conviction. Function allows smart account (Garden contract) control over conviction updating.

**Add Sync Power Facet**

Implement \`sync power\` facet in Gardens. Hats registry module calls facet for updating conviction upon NFT revocation or minting.

**Market Streaming Pools Strategy**

Streaming pools marketing should heavily target project level use cases. Avoid emphasis on individual based streams due to poor UX.

**Make Covenant Feature Optional**

Covenant feature should become optional requirement when creating community.

**Eliminate Initial Staking Requirement**

Initial staking requirement for joining community should be eliminated.

**Move Configuration Controls To Pool**

Configuration controls must move to pool level. Configuration derived from community staking level eliminated.

**Front End Code Trimming Required**

Code trimming and removal required, particularly on front end, to simplify product flow. Goal is achieving high user friendliness through simplification.

**Voting Weight Calculated From Balance**

Voting weight calculation method changes from requiring token locking (staking) to checking wallet balance. Change avoids decreased voting weight in external applications.

**Implement NFT Support Power Registry**

NFT support implementation requires new \`power registry\` field in pool configuration. New field defaults to existing community registry when not specified.

**Review Code Generation Prompt Before Coding**

Code generation prompt subject to full review by Corantin. Review occurs prior to starting NFT implementation coding.

**Test NFT Facets Via Community Upgrade**

Testing strategy for new NFT power facets established. Testing begins by upgrading existing Green Pill community or dedicated test community.

*More details:*

* **Initial Call Setup and Technology Issues**: Afolabi Aiyeloja and Corantin Noll began the meeting by troubleshooting technical issues related to the microphone and connecting on Discord, with the realization that a quick restart often resolves such problems. Corantin Noll noted that a simple restart solved the issue "Like a charm".

* **Token Staking and Conviction Coupling**: The discussion moved to the relationship between token holdings and voting power, specifically how a decrease in a member's staked tokens might affect their existing conviction. Corantin Noll clarified that any unstake action directly impacts voting power because participants must stake the token.

* **Updating Voting Power Based on Staking**: Afolabi Aiyeloja asked if increasing staked tokens automatically updates voting power without manual intervention. Corantin Noll explained that while increased staking makes more voting power "available to cast," it is not automatically "casted to the existing proposal".

* **NFT Integration for Voting Power**: Afolabi Aiyeloja suggested that the per-member storage of voting power should allow for integration with NFTs. Corantin Noll agreed this seemed feasible, but noted that distinguishing NFT voting power from standard token voting would require careful consideration.

* **Handling NFT Ownership Changes and Conviction**: The conversation addressed the challenge of instantly updating voting power (or "support") if a member no longer possesses the required NFT after casting a vote. Corantin Noll proposed that a "hook" or event would be needed to trigger a recomputation of the conviction/support on all current proposals.

* **Staking NFTs to Contracts for Conviction**: Corantin Noll suggested a mechanism where users would need to stake their NFT into a contract, and unstaking the NFT would automatically remove their conviction from any proposals they staked on. Afolabi Aiyeloja found this feasible, noting that an operator removing a "gardener's hat" could trigger a call to update conviction.

* **Implementing the NFT Revocation Hook**: Afolabi Aiyeloja reasoned that an NFT revocation is an on-chain transaction that could trigger a side effect to manage conviction updates. They identified the "delegate function" as a potential solution, allowing a smart account (like the 'garden contract') to delegate access control over conviction updates.

* **Delegation Function in Gardens V2**: Corantin Noll confirmed that Gardens V1 included a delegation mechanism, making it sensible to reintroduce the same functionality in Gardens V2. Afolabi Aiyeloja acknowledged this delegate function would simplify the implementation of NFT-based voting power, even while requiring some overrides.

* **NFT Voting Power Without Staked Amounts**: Afolabi Aiyeloja clarified that for NFT-based pools, the staked token amount is irrelevant, focusing solely on the NFT ownership. Corantin Noll confirmed this specific configuration, noting that a pool could be created without relying on token staking for voting power.

* **Preventing Unauthorized Allocation After Hat Removal**: The discussion returned to how to handle a scenario where a user allocates conviction and then their NFT "hat" is revoked. Afolabi Aiyeloja proposed adding a side effect hook to the Green Goods module to call the garden signaling pool and remove the conviction upon revocation.

* **Implementation of the NFT Power Sync Hook**: The solution involves adding a function to sync the power within the Gardens facet, which would be called by the Green Goods hats registry module upon revocation. This synchronization would be configured when creating a new pool with NFT voting parameters.

* **Thoughts on Superfluid Streaming UX**: Afolabi Aiyeloja expressed reservations about the current user experience (UX) of Superfluid streaming, specifically finding it tedious for individuals to claim their incoming streams. They suggested streaming is currently better suited for project-level or high-level distribution rather than individual income streams.

* **Improving Streaming UX for Subscriptions**: Corantin Noll offered a positive counterpoint, mentioning a Superfluid standard for continuous subscriptions, which provides a good UX for outgoing streams that can be cancelled anytime without needing a refund. Afolabi Aiyeloja agreed that outgoing streams for subscriptions represent a good UX.

* **Marketing Streaming Pools for Projects**: Afolabi Aiyeloja recommended heavily marketing streaming pools towards projects rather than focusing on individual-based streams, although they acknowledged the potential for experimentation in contributor payment. They noted that conviction needs better weighting, which the NFT integration would enable, as current ERC20 governance tokens are not well distributed.

* **Required Functions for NFT Voting Strategy**: Corantin Noll outlined the necessary functions for the NFT voting strategy implementation, noting that it primarily requires modifying or adding \`get member power in strategy\`. Functions related to getting member stake amount would not be necessary in this configuration.

* **UX Audit and Weekly Calls**: Afolabi Aiyeloja addressed Corantin Noll's absence from the weekly UX calls, confirming that the calls have been running for several weeks as part of a UX audit. Corantin Noll explained that they were unaware of the specific schedule, noting that the typical Tuesday and Thursday meeting times conflict with their availability.

* **Upcoming UX Changes and Covenant/Staking**: Afolabi Aiyeloja summarized key points of agreement from the UX calls, stating that the covenant should be optional, staking should not be a requirement for community membership, and configuration should move to the pool level. This shift aims to allow for pools with different token parameters and governance templates.

* **Discussion on Conviction Voting Value Proposition**: The conversation shifted to the core value proposition of Gardens, with Afolabi Aiyeloja expressing that the Gardens pitch often relies on unproven claims, especially regarding conviction voting solving current DAO distribution problems. Corantin Noll argued that conviction voting does solve issues like sudden voting fluctuation due to quick token withdrawal, an issue seen in snapshot voting.

* **Focusing on Validation and Use Cases**: Afolabi Aiyeloja countered that scenarios like rapid token fluctuation are often edge cases and that focusing on solving these complex mathematical problems draws resources away from the primary goal. They argued that Gardens should focus on validating conviction voting use cases with more data by making it simple and easy for users to participate.

* **Target Audience and User Experience**: Afolabi Aiyeloja proposed targeting younger, Gen Z-based audiences, particularly at university and civic levels, due to their openness to new voting mechanisms and higher web3 savviness. The desired UX would be streamlined so a user could receive a link, and the system would check their NFT/token balance at the pool level, allowing them to vote in a single transaction.

* **Most Powerful Moments in Using Gardens**: When asked what moments in Gardens feel "most magical," Corantin Noll identified two moments: executing a proposal and seeing people create proposals on their pool. Afolabi Aiyeloja agreed with these positive aspects of the experience.

* **Unique Advantages of Conviction Voting**: The participants discussed the unique outcomes possible with conviction voting, noting continuous decision-making, setting a threshold instead of a deadline, and gathering continuous signals. They concluded that Gardens outperforms alternatives like Snapshot by helping prevent rapid voting fluctuations.

* **Improving Voting Protection Configurations**: The need for better user experience around conviction parameters was highlighted, suggesting that safe and risky settings should be clearly communicated, potentially through templates. Corantin Noll noted that voting protection often relies on features like passport scores and allow lists and confirmed that chaining or compounding these protections is visible but adds further configuration complexity.

* **Reducing the Audit Surface for Gardens V2**: Afolabi Aiyeloja suggested making non-essential features, like the staking process and the covenant, completely optional or removing them to reduce the complexity and audit surface of the codebase. Corantin Noll clarified that there is no code for the covenant and that removing the staking process would be a notable change.

* **Decoupling from ERC20 Governance Problems**: Afolabi Aiyeloja emphasized the strategic benefit of decoupling Gardens from the burden of solving the ERC20 governance distribution problem. They concluded that making ERC20 token waiting a configurable option rather than a requirement would enable Gardens to focus on validating conviction voting use cases and finding successful decision-making templates.

* **Code Refactoring and Trimming**: Afolabi Aiyeloja suggests that the project is in a good position to focus on polishing, removing, and trimming code, particularly on the front end, which they feel is a great position to be in. Corantin Noll notes that they have already removed a layer of user interface previously, demonstrating that code trimming can be done.

* **Sacred Features and Staking Debate**: The conversation turned to which features of Gardens are "sacred" or untouchable, with Afolabi Aiyeloja suggesting only conviction voting is sacred, while Corantin Noll and Paul (another participant, not present) also considered staking sacred. Staking is seen as a mechanism that links a user to the community and shows dedication, though they acknowledged that staking a token does not always equate to being a contributor.

* **Improving Staking Mechanisms**: Corantin Noll suggests that one improvement to staking could be to give more power to people who stake for a longer period of time, which Afolabi Aiyeloja agrees would make a lot of sense. Afolabi Aiyeloja differentiates this from typical staking rewards, noting that their current system provides Ether (ETH) staking rewards rather than growing the native governance token.

* **Decoupling Staking from Core Conviction Voting**: Afolabi Aiyeloja proposes making the ERC20 staking mechanism less coupled to the core conviction voting feature and more of a side effect, or optional feature, to encourage experimentation and discover useful user patterns. They dislike the current staking mechanism because locking tokens can decrease a user's voting weight in other decentralized applications and because it is a very centralizing feature.

* **Governance Token Level Discussion**: The participants agree that the governance token should remain at the community level, but with different mechanisms for assigning voting power for polls, which Afolabi Aiyeloja agrees with. Afolabi Aiyeloja advocates for a "Gardens light" version that is easy to use and friendly, where a user can simply receive a link, open it, and vote, suggesting that more complex features can follow.

* **Addressing User Friction and Complexity**: Afolabi Aiyeloja notes the current friction for "low-level users" who only want to vote, as they often have to complete multiple transactions, calling this unnecessary complexity in blockchain applications. They emphasize that simplifying the base user experience will enable community managers to attract more users.

* **Implementation of NFT Power Registry**: Corantin Noll discusses the technical implementation for the NFT (non-fungible token) feature, stating they will add an extra field to set a power registry that, by default, will be the same as the community registry. At the creation of a pool, a user will specify the voting power registry, which will be a duplicate of the community registry for most pools.

* **User Experience for Joining and Activating Governance**: Afolabi Aiyeloja raises concerns about users needing to manually initiate joining a community and activating governance separately, ideally wanting to consolidate these actions for a better user experience. They discuss the possibility of using batch calls, such as a multi-call with Wagmi, to combine the joining and activating governance actions, which Corantin Noll confirms is possible.

* **Coding Process and Automation**: Afolabi Aiyeloja plans to use an agent-building flow, possibly using the call notes to set up a GitHub issue for the coding, though Corantin Noll advises against using automation for contract development due to security concerns with the business logic. Afolabi Aiyeloja agrees to send the code prompt for full review before coding anything, which Corantin Noll approves of.

* **Deployment and Testing Strategy**: Corantin Noll suggests starting the deployment with a test community on testnets, such as Sepolia, to prevent loss and minimize risk. They confirm that communities can be upgraded individually per chain, and Corantin Noll plans to deploy to Ether (ETH) and integrate the refactoring into the streaming branch.

* **Tooling and Final Follow-up**: Afolabi Aiyeloja mentions they will be using new versions of Codex and Cloud Code for development. The participants conclude the meeting, with plans to finalize the notes and reconvene the following week.

### Suggested next steps

- [ ] Corantin Noll will try to join the two remaining UX calls next week, potentially after 6 PM.  
- [ ] Afolabi Aiyeloja will use the notes to generate a prompt, have Corantin Noll review the prompt, and then generate the spec to build.  
- [ ] Afolabi Aiyeloja will extract the notes after the call, polish a prompt, use the streaming pool branch for coding, and send the prompt to Corantin Noll for a full review before coding anything.  
- [ ] Corantin Noll will deploy to ETHA and get the refactor into the streaming branch.

*You should review Gemini's notes to make sure they're accurate. [Get tips and learn how Gemini takes notes](https://support.google.com/meet/answer/14754931)*

*Please provide feedback about using Gemini to take notes in a [short survey.](https://google.qualtrics.com/jfe/form/SV_9vK3UZEaIQKKE7A?confid=CHO5GcIS-kJWepUeCOUBDxIWOAIIigIgABgBCA&detailid=standard)*