// Ambient module definition for react-window.
// The package ships Flow types only, so we maintain a minimal TypeScript surface here.
declare module "react-window" {
  import type * as React from "react";

  type ScrollDirection = "forward" | "backward";
  type ScrollToAlign = "auto" | "smart" | "center" | "end" | "start";
  type Direction = "ltr" | "rtl";
  type Layout = "horizontal" | "vertical";

  export interface ListOnScrollProps {
    scrollDirection: ScrollDirection;
    scrollOffset: number;
    scrollUpdateWasRequested: boolean;
  }

  export interface ListOnItemsRenderedProps {
    overscanStartIndex: number;
    overscanStopIndex: number;
    visibleStartIndex: number;
    visibleStopIndex: number;
  }

  export interface ListChildComponentProps<TData = unknown> {
    data: TData;
    index: number;
    isScrolling?: boolean;
    style: React.CSSProperties;
  }

  export interface FixedSizeListProps<TData = unknown> {
    children: React.ComponentType<ListChildComponentProps<TData>>;
    className?: string;
    direction?: Direction;
    height: number;
    innerElementType?: React.ElementType;
    innerRef?: React.Ref<unknown>;
    itemCount: number;
    itemData?: TData;
    itemKey?: (index: number, data: TData) => React.Key;
    itemSize: number;
    layout?: Layout;
    overscanCount?: number;
    onItemsRendered?: (props: ListOnItemsRenderedProps) => void;
    onScroll?: (props: ListOnScrollProps) => void;
    outerElementType?: React.ElementType;
    outerRef?: React.Ref<unknown>;
    style?: React.CSSProperties;
    useIsScrolling?: boolean;
    width: number | string;
  }

  export interface VariableSizeListProps<TData = unknown>
    extends Omit<FixedSizeListProps<TData>, "itemSize"> {
    estimatedItemSize?: number;
    itemSize: (index: number) => number;
  }

  export interface ListRef {
    scrollTo(scrollOffset: number): void;
    scrollToItem(index: number, align?: ScrollToAlign): void;
    resetAfterIndex?(index: number, shouldForceUpdate?: boolean): void;
  }

  export const FixedSizeList: <TData = unknown>(
    props: FixedSizeListProps<TData> & { ref?: React.Ref<ListRef> }
  ) => React.ReactElement | null;

  export const VariableSizeList: <TData = unknown>(
    props: VariableSizeListProps<TData> & { ref?: React.Ref<ListRef> }
  ) => React.ReactElement | null;

  export interface GridChildComponentProps<TData = unknown> {
    columnIndex: number;
    data: TData;
    isScrolling?: boolean;
    rowIndex: number;
    style: React.CSSProperties;
  }

  export interface FixedSizeGridProps<TData = unknown> {
    children: React.ComponentType<GridChildComponentProps<TData>>;
    className?: string;
    columnCount: number;
    columnWidth: number;
    direction?: Direction;
    estimatedColumnWidth?: number;
    estimatedRowHeight?: number;
    height: number;
    itemData?: TData;
    onItemsRendered?: (props: {
      overscanColumnStartIndex: number;
      overscanColumnStopIndex: number;
      overscanRowStartIndex: number;
      overscanRowStopIndex: number;
      visibleColumnStartIndex: number;
      visibleColumnStopIndex: number;
      visibleRowStartIndex: number;
      visibleRowStopIndex: number;
    }) => void;
    onScroll?: (props: {
      horizontalScrollDirection: ScrollDirection;
      scrollLeft: number;
      scrollTop: number;
      scrollUpdateWasRequested: boolean;
      verticalScrollDirection: ScrollDirection;
    }) => void;
    overscanColumnCount?: number;
    overscanRowCount?: number;
    rowCount: number;
    rowHeight: number;
    style?: React.CSSProperties;
    useIsScrolling?: boolean;
    width: number | string;
  }

  export interface VariableSizeGridProps<TData = unknown>
    extends Omit<FixedSizeGridProps<TData>, "columnWidth" | "rowHeight"> {
    columnWidth: (index: number) => number;
    rowHeight: (index: number) => number;
  }

  export interface GridRef {
    scrollTo({ scrollLeft, scrollTop }: { scrollLeft: number; scrollTop: number }): void;
    scrollToItem(rowIndex: number, columnIndex: number, align?: ScrollToAlign): void;
    resetAfterColumnIndex?(index: number, shouldForceUpdate?: boolean): void;
    resetAfterRowIndex?(index: number, shouldForceUpdate?: boolean): void;
  }

  export const FixedSizeGrid: <TData = unknown>(
    props: FixedSizeGridProps<TData> & { ref?: React.Ref<GridRef> }
  ) => React.ReactElement | null;

  export const VariableSizeGrid: <TData = unknown>(
    props: VariableSizeGridProps<TData> & { ref?: React.Ref<GridRef> }
  ) => React.ReactElement | null;

  export const areEqual: <TProps>(prevProps: TProps, nextProps: TProps) => boolean;

  export function createListComponent<TData = unknown>(
    config: Record<string, unknown>
  ): React.ComponentType<FixedSizeListProps<TData>>;

  export function createGridComponent<TData = unknown>(
    config: Record<string, unknown>
  ): React.ComponentType<FixedSizeGridProps<TData>>;
}
