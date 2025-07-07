import { Person } from "../types";

// Helper to extract a person's display name in a case-insensitive way.
export function getPersonDisplayName(person: Person): string {
  const nameKey = Object.keys(person.attributes).find(
    (k) => k.toLowerCase() === "name"
  );
  return nameKey ? person.attributes[nameKey] : person.id;
}
