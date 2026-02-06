export type IssueKind = "error" | "warning" | "conflict";

export interface IssueRow {
  row?: number;
  field?: string;
  message: string;
  kind: IssueKind;
}
