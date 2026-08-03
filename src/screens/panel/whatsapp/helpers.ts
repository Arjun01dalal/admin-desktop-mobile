import type {
  ChatSummary,
  GroupedChats,
  WhatsappMessage,
} from './types';

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return phone.trim();
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+${digits}`;
}

export function groupChats(data: WhatsappMessage[]): GroupedChats {
  return data.reduce<GroupedChats>((acc, item) => {
    const raw =
      item.callback_type === 'incoming_message' ? item.from : item.to;
    if (!raw) return acc;
    const number = normalizePhone(raw);
    if (!acc[number]) acc[number] = [];
    acc[number].push(item);
    return acc;
  }, {});
}

export function sortChats(grouped: GroupedChats): GroupedChats {
  Object.values(grouped).forEach((messages) =>
    messages.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    ),
  );
  return grouped;
}

export function getProfileName(messages: WhatsappMessage[], phone: string) {
  const withName = [...messages]
    .reverse()
    .find((m) => m.profile_name || m.content?.profile_name);
  return (
    withName?.profile_name ||
    withName?.content?.profile_name ||
    phone
  );
}

export function getMessagePreview(msg: WhatsappMessage): string {
  const content = msg.content;
  if (!content) return msg.description || '';
  switch (content.type) {
    case 'text':
      return content.text.body;
    case 'image':
      return content.image.caption
        ? `📷 ${content.image.caption}`
        : '📷 Photo';
    default:
      return msg.description || '';
  }
}

export function buildChatSummaries(records: GroupedChats): ChatSummary[] {
  return Object.entries(records)
    .map(([phone, messages]) => {
      const visibleMessages = messages.filter((m) => m.callback_type !== 'dlr');
      const lastMessage =
        visibleMessages[visibleMessages.length - 1] ??
        messages[messages.length - 1];
      if (!lastMessage) return null;
      return {
        phone,
        profileName: getProfileName(messages, phone),
        lastMessage,
        preview: getMessagePreview(lastMessage),
        timestamp: lastMessage.timestamp,
      };
    })
    .filter((summary): summary is ChatSummary => summary !== null)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}

export function formatMessageTime(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export function formatListTime(timestamp: string) {
  return formatMessageTime(timestamp);
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(-2).toUpperCase();
}

export function getMessageKey(msg: WhatsappMessage, index: number) {
  return `${msg.timestamp}-${msg.callback_type}-${index}`;
}

export function isIncoming(msg: WhatsappMessage) {
  return msg.callback_type === 'incoming_message';
}

export function formatWhatsappTo(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}
