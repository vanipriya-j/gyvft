export type MigrationProgress = {
  phase: "checking" | "applying" | "committing";
  total: number;
  completed: number;
  filename?: string;
};
