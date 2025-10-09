import _ from "lodash";

export function dedupeResults(results: any[][]): any[] {
  return _.uniqBy(results.flat(), "url");
}