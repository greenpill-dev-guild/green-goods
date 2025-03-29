interface formatDateTimeArgs {
  date: number | string | Date;
  locale?: Intl.LocalesArgument;
}

export const formatDate = ({ date, locale = "pt-BR" }: formatDateTimeArgs) => {
  return new Date(date).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
};

export const formatTime = ({ date, locale = "pt-BR" }: formatDateTimeArgs) => {
  return new Date(date).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDateTime = ({
  date,
  locale = "pt-BR",
}: formatDateTimeArgs) => {
  const formattedDate = formatDate({ date, locale });
  const formattedTime = formatTime({ date, locale });

  return `${formattedDate} at ${formattedTime}`;
};
