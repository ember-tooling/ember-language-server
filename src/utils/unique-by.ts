export default function uniqueBy<T extends object, K extends keyof T>(arr: T[], property: K): T[] {
  const flags = new Map<any, boolean>();

  return arr.filter((entry) => {
    if (flags.get(entry[property])) {
      return false;
    }

    flags.set(entry[property], true);
    return true;
  });
}
