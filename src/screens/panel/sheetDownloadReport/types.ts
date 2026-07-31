export type PaymentGatewayMid = {
  mid?: string;
  [key: string]: unknown;
};

export type SheetDownloadRow = {
  _id?: string;
  downloadedBy?: {
    name?: string;
    userId?: string;
    date?: string;
    city?: string;
    state?: string;
  };
  filter?: {
    type?: string;
    mid?: string;
  };
  [key: string]: unknown;
};

export type SheetDownloadListResponse = {
  items?: SheetDownloadRow[];
  total?: number;
  totalPages?: number;
};
