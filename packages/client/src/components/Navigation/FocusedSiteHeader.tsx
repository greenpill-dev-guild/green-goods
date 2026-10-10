import { IconButton } from "@green-goods/shared/components/IconButton";
import { APP_NAME } from "@green-goods/shared/config/app";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiUserLine } from "@remixicon/react";
import {
  createContext,
  type ReactNode,
  type SyntheticEvent,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useIntl } from "react-intl";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";
import { FocusedAccountSheet } from "./FocusedAccountSheet";

/** What the focused shell opens to the page under it. */
interface FocusedShellSlots {
  /** The top bar's middle, where the page draws its flow's steps. */
  middle: HTMLElement | null;
  /** The sheet's account section, there only while the sheet is open. */
  account: HTMLElement | null;
  /** The page says it has an account section, and whether it is signed in; null when it leaves. */
  setPage: (page: { signedIn: boolean } | null) => void;
}

const Slots = createContext<FocusedShellSlots | null>(null);

/** What a person presses or tabs to on a page. Its words and layout are not among them. */
const CONTROLS = "button, a[href], input, select, textarea, summary, [tabindex]";
/** The page's title, which the page may focus: the cards that draw one give it a tabindex. */
const PAGE_TITLE = "h1[tabindex]";

/**
 * The focused shell for reporting ceremony pages: the top bar, then the page. The bar and its
 * Account and Help sheet are on screen before the page's code loads; the page then reaches into
 * them, drawing its steps in the bar's middle and its account in the sheet, so each piece is said
 * by the part of the page that knows it.
 *
 * The shell also keeps focus on the page. A step is taken by pressing a control, and the next
 * step either replaces that control, so focus falls back to the document and the next Tab starts
 * again from the top bar, or reuses its node under another name, so focus sits on an act the
 * person has not read yet. Either way a screen reader says nothing of the step that arrived. So
 * when the step has changed since the person last used a control, and focus is still where that
 * left it, the page's title takes it. A step has changed when that control is gone or the page's
 * title reads differently. A page that changes by itself, as on first load or when a send
 * settles, follows no control anyone used, and a dialog or the account sheet holds focus of its
 * own, so neither is touched.
 */
export function FocusedShell({ children }: { children: ReactNode }) {
  const [middle, setMiddle] = useState<HTMLElement | null>(null);
  const [account, setAccount] = useState<HTMLElement | null>(null);
  const [page, setPage] = useState<{ signedIn: boolean } | null>(null);
  const slots = useMemo(() => ({ middle, account, setPage }), [middle, account]);
  const mainRef = useRef<HTMLElement>(null);
  // The control a person last used on the page, and what the page's title said at the time.
  const lastUsed = useRef<{ control: Element; title: string | null } | null>(null);
  // Pressed as well as focused: some browsers leave focus where it was when a button is tapped.
  const noteControl = (event: SyntheticEvent) => {
    const control = event.target instanceof Element ? event.target.closest(CONTROLS) : null;
    if (!control) return;
    const title = mainRef.current?.querySelector(PAGE_TITLE)?.textContent ?? null;
    lastUsed.current = { control, title };
  };

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const observer = new MutationObserver(() => {
      const used = lastUsed.current;
      if (!used) return;
      const title = main.querySelector<HTMLElement>(PAGE_TITLE);
      const stepChanged =
        !used.control.isConnected || (title !== null && title.textContent !== used.title);
      if (!stepChanged) return;
      const active = document.activeElement;
      if (active && active !== document.body && active !== used.control) {
        // The person is somewhere else by now, in a dialog or on the top bar.
        lastUsed.current = null;
        return;
      }
      // Until the next step is drawn there is no title to go to.
      if (!title) return;
      lastUsed.current = null;
      title.focus();
    });
    // A title that changes in place is a change of its text, not of the page's nodes.
    observer.observe(main, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-bg-white-0">
      <FocusedSiteHeader
        middleRef={setMiddle}
        accountRef={setAccount}
        signedIn={page?.signedIn ?? false}
        pageSaysAccount={page !== null}
      />
      <Slots.Provider value={slots}>
        <main
          ref={mainRef}
          className="flex-1"
          onClickCapture={noteControl}
          onFocusCapture={noteControl}
        >
          {children}
        </main>
      </Slots.Provider>
    </div>
  );
}

/** A page's steps, drawn in the top bar's middle. Outside the focused shell it draws nothing. */
export function FocusedHeaderSteps({ children }: { children: ReactNode }) {
  const slots = useContext(Slots);
  return slots?.middle ? createPortal(children, slots.middle) : null;
}

/**
 * A page's account: whether it is signed in, which the profile button marks with a dot, and what
 * the sheet's account section shows. While a page has one, the sheet leaves the section to it.
 * Outside the focused shell it draws nothing.
 */
export function FocusedHeaderAccount({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: ReactNode;
}) {
  const slots = useContext(Slots);
  const setPage = slots?.setPage;
  useEffect(() => {
    setPage?.({ signedIn });
    return () => setPage?.(null);
  }, [setPage, signedIn]);
  return slots?.account ? createPortal(children, slots.account) : null;
}

/**
 * Top bar for reporting ceremony pages, laid out as the app's flow bar is (Submit Work, Add Proof):
 * the mark where that bar has Back, the flow's steps in the middle, and the profile button where
 * that bar keeps its spare slot. There is no navigation or install action, so nothing competes
 * with the one step the person came to finish. The profile button opens Account and Help without
 * leaving the page.
 *
 * The mark and the profile button sit on the line of the step markers, not of the bar, so the
 * three read as one row with the step names under it. The bar stays at the top of the viewport and
 * keeps to the page's column, so they line up with what is under them at every width. On a
 * viewport too short to share, it scrolls away with the page, as the bottom bar does.
 */
function FocusedSiteHeader({
  middleRef,
  accountRef,
  signedIn,
  pageSaysAccount,
}: {
  /** Receives the element a page's steps are drawn into. */
  middleRef: (element: HTMLElement | null) => void;
  /** Receives the element a page's account section is drawn into. */
  accountRef: (element: HTMLElement | null) => void;
  signedIn: boolean;
  /** The page under the bar fills the sheet's account section itself. */
  pageSaysAccount: boolean;
}) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  // The bottom sheet hands focus back to what opened it. The side sheet leaves it on the page, so
  // once it has closed the button takes focus back and the keyboard carries on from where it was.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      opener.current?.focus();
    }
  }, [open]);
  return (
    <header
      className="sticky top-0 z-nav bg-bg-white-0 [@media(max-height:20rem)]:static"
      data-variant="focused"
    >
      {/* The row starts where the steps start. Equal side columns centre the steps on the screen;
          when a small phone has no room for that, the sides keep to the mark and the button and
          the steps take what is left. Each side is a marker's height, so what it holds is centred
          on the markers' line. */}
      <div className="mx-auto grid h-20 w-full max-w-3xl grid-cols-[1fr_auto_1fr] items-start gap-2 px-4 pt-[1.1875rem] sm:px-6">
        <div className="flex h-6 items-center justify-self-start">
          <img src="/icon.png" alt={APP_NAME} className="h-7 w-auto" />
        </div>
        <div ref={middleRef} className="min-w-0" data-component="FocusedHeaderMiddle" />
        <div className="flex h-6 items-center justify-self-end">
          <IconButton
            ref={opener}
            emphasis="secondary"
            size="compact"
            aria-label={intl.formatMessage(
              signedIn
                ? {
                    id: "public.reporting.account.openSignedIn",
                    defaultMessage: "Account and Help, signed in",
                  }
                : { id: "public.reporting.account.title", defaultMessage: "Account and Help" }
            )}
            aria-haspopup="dialog"
            icon={<RiUserLine aria-hidden="true" />}
            badge={
              signedIn ? (
                <span
                  data-component="FocusedHeaderSignedIn"
                  className={cn(
                    "inline-flex h-2.5 w-2.5 rounded-full border border-bg-white-0",
                    pwaStatusStyles.success.dot
                  )}
                />
              ) : null
            }
            onClick={() => setOpen(true)}
          />
        </div>
      </div>
      <FocusedAccountSheet
        open={open}
        onOpenChange={setOpen}
        accountRef={accountRef}
        pageSaysAccount={pageSaysAccount}
      />
    </header>
  );
}
