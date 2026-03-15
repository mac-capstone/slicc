/**
 * Date formatting utilities for display across the app.
 */

export function formatCreationDate(
  dateInput: Date | string | undefined
): string {
  if (!dateInput) return '';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === yesterday.toDateString()) {
    return 'Created yesterday';
  }
  return `Created ${date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })}`;
}

export function formatEventWhen(startDate: Date | string): string {
  const eventDate = startDate instanceof Date ? startDate : new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays >= 2 && diffDays <= 6) return `in ${diffDays} days`;
  if (diffDays > 0 && eventDate.getMonth() !== today.getMonth())
    return 'next month';
  if (diffDays >= 7 && diffDays <= 13) return 'next week';
  if (diffDays >= 14 && diffDays <= 20) return 'in 2 weeks';
  if (diffDays >= 21 && diffDays <= 27) return 'in 3 weeks';
  if (diffDays >= 28) return 'next month';
  if (diffDays >= -7 && diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  return eventDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatEventDescription(
  eventName: string,
  startDate: Date | string
): string {
  const when = formatEventWhen(startDate);
  return `${eventName} ${when}`;
}
