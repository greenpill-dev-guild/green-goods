/**
 * Why Upload all leaves one item out of the call it sends. A kind throws one of these from its
 * attestation, so Upload all can tell them apart without knowing what a work or a decision is.
 *
 * They live apart from the kinds so a caller can recognise them without loading the kinds.
 */

/**
 * What the item would do is already done elsewhere, such as a decision another steward made on
 * its work. It is left out of the call, and the queue clears it and says why.
 */
export class UploadItemAlreadyDone extends Error {
  constructor(readonly reason: string) {
    super(`Upload item already done: ${reason}`);
    this.name = "UploadItemAlreadyDone";
  }
}

/**
 * Whether the item may still go could not be read now. It is left out of the call, unsent and
 * still ready, for the next tap.
 */
export class UploadItemUnchecked extends Error {
  constructor(cause: unknown) {
    super("Upload item could not be checked before sending", { cause });
    this.name = "UploadItemUnchecked";
  }
}
