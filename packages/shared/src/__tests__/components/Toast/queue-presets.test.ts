// TEST-QUALITY: allow-small-test-file - no other file covers the queue toasts' copy; the provider's test mocks them and covers which garden reaches this one, and these three cases are all its two variants have.
/**
 * The queue's failure toast (PWA Home step 12). Your Work lists only the active garden, so a failed
 * upload in another of the member's gardens names that garden and offers the switcher, which
 * changes nothing until the member picks; one in the active garden keeps today's toast.
 */

import { createIntl } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueueToasts } from "../../../components/Toast/presets/queue";
import { toastService } from "../../../components/Toast/toast.service";
import en from "../../../i18n/en.json";
import es from "../../../i18n/es.json";
import pt from "../../../i18n/pt.json";

const toastsIn = (locale: string, messages: Record<string, string>) =>
  createQueueToasts(createIntl({ locale, messages }).formatMessage);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("queue failure toast", () => {
  it("names the other garden a failed upload waits in, and its action opens the switcher", () => {
    const error = vi.spyOn(toastService, "error").mockReturnValue("work-upload");
    const openSwitcher = vi.fn();

    toastsIn("en", en).jobFailed("work", "Max retries (3) exceeded", {
      gardenName: "Vida Verde",
      openSwitcher,
    });

    const [shown] = error.mock.calls[0];
    expect(shown).toMatchObject({
      id: "work-upload",
      title: "Sync failed",
      message:
        "Your work in Vida Verde is still saved on this device. Switch to that garden to try again.",
      action: { label: "See Your Gardens", dismissOnClick: true },
    });
    shown.action?.onClick();
    expect(openSwitcher).toHaveBeenCalledOnce();
  });

  it("says the same of a decision, in every language the app speaks", () => {
    const error = vi.spyOn(toastService, "error").mockReturnValue("approval-submit");
    const elsewhere = { gardenName: "Vida Verde", openSwitcher: vi.fn() };

    toastsIn("en", en).jobFailed("approval", undefined, elsewhere);
    toastsIn("es", es).jobFailed("approval", undefined, elsewhere);
    toastsIn("pt", pt).jobFailed("work", undefined, elsewhere);

    expect(error.mock.calls.map(([shown]) => [shown.message, shown.action?.label])).toEqual([
      [
        "Your decision in Vida Verde is still saved on this device. Switch to that garden to try again.",
        "See Your Gardens",
      ],
      [
        "Tu decisión en Vida Verde sigue guardada en este dispositivo. Cambia a ese jardín para intentarlo de nuevo.",
        "Ver tus jardines",
      ],
      [
        "Seu trabalho em Vida Verde continua salvo neste dispositivo. Troque para esse jardim para tentar de novo.",
        "Ver seus jardins",
      ],
    ]);
  });

  it("keeps today's toast for a failed upload the active garden's Your Work lists", () => {
    const error = vi.spyOn(toastService, "error").mockReturnValue("work-upload");

    toastsIn("en", en).jobFailed("work");

    const [shown] = error.mock.calls[0];
    expect(shown.message).toBe(
      "Your work is still saved on this device. Open Your Work to try again."
    );
    expect(shown.action).toBeUndefined();
  });
});
