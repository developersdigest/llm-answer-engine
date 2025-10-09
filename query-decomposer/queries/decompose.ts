export function decomposeQuery(query: string): string[] {
  return [
    `What is ${query}?`,
    `Examples of ${query}`,
    `Benefits and drawbacks of ${query}`
  ];
}