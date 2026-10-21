import {useContext} from "react";
import OriginalDocPaginator from "@theme-original/DocPaginator";
import type {Props} from "@theme/DocPaginator";
import {NextActionContext} from "@site/src/components/docs/NextActionContext";

export default function DocPaginator(props: Props) {
  const recommendation = useContext(NextActionContext);
  if (!recommendation) return <OriginalDocPaginator {...props} />;

  // Some guides recommend returning to the previous page. Show one card for that destination.
  const previous =
    props.previous?.permalink.replace(/\/+$/, "") ===
    recommendation.permalink.replace(/\/+$/, "")
      ? undefined
      : props.previous;

  return <OriginalDocPaginator {...props} previous={previous} next={recommendation} />;
}
