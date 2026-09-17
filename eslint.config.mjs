import next from "eslint-config-next";

const config = [
  { ignores: ["out/**", ".next/**", "_previous/**", "supabase/functions/**", "src/lib/geo/laos.generated.ts"] },
  ...next,
];

export default config;
