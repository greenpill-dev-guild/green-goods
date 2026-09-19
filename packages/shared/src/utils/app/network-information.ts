/** The parts of the Network Information API the app reads; most browsers expose only some. */
export interface NetworkInformationLike extends EventTarget {
  saveData?: boolean;
  type?: string;
  effectiveType?: string;
}

/** The browser's connection details, where it shares them. */
export function networkInformation(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

/** Whether the person asked the browser to save data. */
export function isDataSaverOn(): boolean {
  return Boolean(networkInformation()?.saveData);
}
