export type FunnelSummary = {
  since: string; sessionsByEvent: Record<string, number>; visitors: number; qualifiedLeads: number; leads: number; quotes: number; orders: number;
  revenueLak: number; pipelineLak: number; avgOrderLak: number; repeatCustomers: number; reorders: number;
  leadsBySource: Record<string, number>; leadsByStatus: Record<string, number>;
  productViews: { product: string; views: number }[]; abandonment: { flow: string; stage: string; count: number }[];
  qrByCode: { code: string; label: string; scans: number }[]; daily: { day: string; visitors: number; leads: number }[];
};
