declare module "@orbitdb/core" {
  export function createOrbitDB(opts: any): Promise<any>;
  export function useDatabaseType(type: any): void;
}

declare module "@orbitdb/nested-db" {
  const Nested: any;
  export { Nested };
}
