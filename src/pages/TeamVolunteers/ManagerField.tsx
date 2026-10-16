import { useQuery } from "@tanstack/react-query";
import { loadPeople, peopleBelow, type Person } from "@/api/people";
import { Field } from "@/components/forms/controls";

const label = (p: Person) => [p.name, p.type === "team" ? p.sub : "Volunteer"].filter(Boolean).join(" · ");

/** The choices of a "Works under" box: no one, then every team member and volunteer except the person and those below them. */
function Options({ people, selfKey, current }: { people: Person[]; selfKey: string | null; current: string | null }) {
  const skip = peopleBelow(people, selfKey);
  if (selfKey) skip.add(selfKey);
  const group = (type: Person["type"], text: string) => {
    const list = people.filter((p) => p.type === type && !skip.has(p.key) && (p.status !== "inactive" || p.key === current));
    return list.length ? (
      <optgroup label={text}>
        {list.map((p) => (
          <option key={p.key} value={p.key}>
            {label(p)}
          </option>
        ))}
      </optgroup>
    ) : null;
  };
  return (
    <>
      <option value="">No one</option>
      {group("team", "Team")}
      {group("volunteer", "Volunteers")}
    </>
  );
}

/**
 * The "Works under" box for a form. `selfKey` = the person being edited ("team:3"), null for a new person.
 * `value` is the chosen key ("team:3", "volunteer:7") or null; the parent keeps it and sends it only when it changed.
 */
export function ManagerField({
  selfKey,
  saved,
  value,
  onChange
}: {
  selfKey: string | null;
  saved: string | null;
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  const { data: people, isError, isLoading } = useQuery({ queryKey: ["people"], queryFn: loadPeople });
  return (
    <Field label="Works under (who this person reports to; kept in the admin panel only)">
      <select disabled={isLoading || isError} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        {isLoading ? (
          <option value={saved ?? ""}>Loading…</option>
        ) : isError || !people ? (
          <option value={saved ?? ""}>The list could not be loaded.</option>
        ) : (
          <Options people={people} selfKey={selfKey} current={saved} />
        )}
      </select>
    </Field>
  );
}
