import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { loadPeople, peopleBelow, updateTeamMember, updateVolunteer, type Person } from "@/api/people";
import { Msg, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/feedback";
import { messageOf } from "@/lib/errors";

/**
 * The "Hierarchy" tab: who works under whom, drawn as a tree (admin panel only).
 * It is built from each person's "Works under" box.
 */
export function HierarchyTab({ onAddTeam, onAddVolunteer }: { onAddTeam: () => void; onAddVolunteer: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: people = [], isLoading, error, refetch } = useQuery({ queryKey: ["people"], queryFn: loadPeople });
  const [shut, setShut] = useState<Set<string>>(new Set()); // keys of collapsed people (kept across a refresh)

  const kids = (key: string | null) =>
    people.filter((p) => p.under === key).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  const toggle = (key: string) =>
    setShut((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /** "Works under" drop-down on a card: saves straight away and redraws the tree. */
  function underSelect(p: Person) {
    const skip = peopleBelow(people, p.key);
    skip.add(p.key);
    return (
      <select
        className="org-sel"
        aria-label={`Works under, for ${p.name}`}
        value={p.under ?? ""}
        onChange={async (e) => {
          const value = e.target.value || null;
          try {
            await (p.type === "team" ? updateTeamMember : updateVolunteer)(p.id, { reports_to: value });
            await qc.invalidateQueries({ queryKey: ["people"] });
            qc.invalidateQueries({ queryKey: ["team_members"] });
            qc.invalidateQueries({ queryKey: ["volunteers"] });
            toast(`${p.name} now works under ${value ? people.find((x) => x.key === value)?.name : "no one"}.`);
          } catch (err) {
            toast(messageOf(err), "err");
          }
        }}
      >
        <option value="">Works under: no one</option>
        {people
          .filter((c) => !skip.has(c.key) && c.status !== "inactive")
          .map((c) => (
            <option key={c.key} value={c.key}>
              {c.type === "team" ? `${c.name} · ${c.sub || "Team"}` : `${c.name} · Volunteer`}
            </option>
          ))}
      </select>
    );
  }

  const node = (p: Person): React.ReactNode => {
    const k = kids(p.key);
    const closed = shut.has(p.key);
    return (
      <li key={p.key}>
        <div className={`org-card ${p.type}${p.status === "inactive" ? " off" : ""}`}>
          {k.length ? (
            <button
              type="button"
              className="org-tog"
              aria-label={(closed ? "Show people under " : "Hide people under ") + p.name}
              aria-expanded={!closed}
              onClick={() => toggle(p.key)}
            >
              {closed ? "+" : "−"}
            </button>
          ) : null}
          <b>{p.name}</b>
          <span className="mut">{p.type === "team" ? p.sub || "Team" : ["Volunteer", p.sub].filter(Boolean).join(" · ")}</span>
          {k.length ? <span className="org-n">{`${k.length} direct`}</span> : null}
          {underSelect(p)}
        </div>
        {k.length && !closed ? <ul>{k.map(node)}</ul> : null}
      </li>
    );
  };

  const roots = kids(null);
  const lonely = roots.filter((p) => !kids(p.key).length);
  const lead = roots.filter((p) => kids(p.key).length);

  return (
    <div>
      <p className="mut">
        Who works under whom. Pick “Works under” on a card to place a person; use + / − to open or close a branch. Kept in the admin panel
        only.
      </p>
      <div className="row">
        <button type="button" className="ghost" onClick={() => setShut(new Set())}>
          Expand all
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => setShut(new Set(people.filter((p) => people.some((c) => c.under === p.key)).map((p) => p.key)))}
        >
          Collapse all
        </button>
        <button type="button" className="ghost" onClick={() => refetch()}>
          Refresh
        </button>
        <div className="grow" />
        <button type="button" onClick={onAddTeam}>
          + Add team member
        </button>
        <button type="button" onClick={onAddVolunteer}>
          + Add volunteer
        </button>
      </div>
      <div className="orgtree">
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <Msg kind="err">{messageOf(error)}</Msg>
        ) : !people.length ? (
          <p className="mut">No team members or volunteers yet.</p>
        ) : (
          <>
            <ul className="org-root">
              <li>
                <div className="org-card top">
                  <b>Sahara Jan Kalyan Samiti</b>
                </div>
                <ul>
                  {lead.map(node)}
                  {lonely.length ? (
                    <li>
                      <div className="org-card none">
                        <b>Not placed yet</b>
                        <span className="mut">{`${lonely.length} with no one above or below`}</span>
                      </div>
                      <ul>{lonely.map(node)}</ul>
                    </li>
                  ) : null}
                </ul>
              </li>
            </ul>
            <p className="mut">
              To change the tree, pick “Works under” on a person’s card (it is also in each person’s form). Volunteers marked inactive are
              shown faded.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
