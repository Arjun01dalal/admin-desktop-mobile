export type CallbackType = 'incoming_message' | 'outgoing_message' | 'dlr';

export type WhatsappTextContent = {
  type: 'text';
  text: { body: string };
};

export type WhatsappImageContent = {
  type: 'image';
  image: { url: string; caption?: string; s3_url?: string };
};

export type WhatsappContent = WhatsappTextContent | WhatsappImageContent;

export type WhatsappMessage = {
  callback_type: CallbackType;
  from?: string;
  to?: string;
  timestamp: string;
  profile_name?: string;
  description?: string;
  content?: WhatsappContent & { profile_name?: string };
};

export type GroupedChats = Record<string, WhatsappMessage[]>;

export type ChatSummary = {
  phone: string;
  profileName: string;
  lastMessage: WhatsappMessage;
  preview: string;
  timestamp: string;
};
