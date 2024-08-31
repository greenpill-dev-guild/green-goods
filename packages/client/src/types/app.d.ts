declare interface Link<T> {
  title: string;
  Icon: T;
  link: string;
  action?: () => void;
}
