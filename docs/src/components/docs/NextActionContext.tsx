import {createContext} from "react";
import type {Props} from "@theme/DocPaginator";

// The authored recommendation overrides only the next card. Docusaurus still owns the
// current document and previous-page metadata, read by its original DocItem paginator.
export const NextActionContext = createContext<Props["next"]>(undefined);
