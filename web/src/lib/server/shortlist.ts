import { store } from "./store";
import { findStudentVisible, studentVisibleProperties } from "./listings";
import { toListingCard } from "./student-dto";

/** Shortlisting is private to the student: no lead, no broker notification (D-16). */
export function setShortlisted(studentId: string, code: string, on: boolean): boolean {
  const property = findStudentVisible(code);
  if (!property) return false;
  const s = store();
  const set = s.shortlists.get(studentId) ?? new Set<string>();
  if (on) set.add(property.id);
  else set.delete(property.id);
  s.shortlists.set(studentId, set);
  return true;
}

export function shortlistCards(studentId: string, collegeId: string | null) {
  const ids = store().shortlists.get(studentId) ?? new Set<string>();
  return studentVisibleProperties()
    .filter((p) => ids.has(p.id))
    .map((p) => toListingCard(p, { studentId, collegeId }));
}
