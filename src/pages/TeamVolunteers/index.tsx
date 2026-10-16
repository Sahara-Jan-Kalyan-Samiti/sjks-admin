import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getTeamMembers, loadPeople } from "@/api/people";
import { PageHeader, Tabs } from "@/components/ui/primitives";
import { useList } from "@/hooks/useList";
import { getVolunteers } from "@/api/people";
import type { TeamMember } from "@/types";
import { HierarchyTab } from "./HierarchyTab";
import { TeamForm, TeamTab } from "./TeamTab";
import { VolunteerForm, VolunteersTab } from "./VolunteersTab";

/** Team & Volunteers: the team (executive committee + management), the volunteers and the hierarchy tree. "?tab=volunteers" opens the volunteers. */
export default function TeamVolunteers() {
  const [params, setParams] = useSearchParams();
  const tab = ["team", "volunteers", "hierarchy"].includes(params.get("tab") ?? "") ? params.get("tab")! : "team";
  const qc = useQueryClient();
  const team = useList("team_members", getTeamMembers);
  const volunteers = useList("volunteers", getVolunteers);
  const people = useQuery({ queryKey: ["people"], queryFn: loadPeople });
  const [addTeam, setAddTeam] = useState(false);
  const [addVolunteer, setAddVolunteer] = useState(false);
  const refreshAll = () => ["team_members", "volunteers", "people", "badges"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const teamRows: TeamMember[] = team.rows;

  return (
    <div>
      <PageHeader title="Team & Volunteers">
        The executive committee, management team and volunteers shown on the website About Us page.
      </PageHeader>
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        tabs={[
          { key: "team", label: "Team", count: team.loading ? undefined : team.rows.length },
          { key: "volunteers", label: "Volunteers", count: volunteers.loading ? undefined : volunteers.rows.length },
          { key: "hierarchy", label: "Hierarchy", count: people.data?.length }
        ]}
      />
      {tab === "team" && <TeamTab />}
      {tab === "volunteers" && <VolunteersTab />}
      {tab === "hierarchy" && <HierarchyTab onAddTeam={() => setAddTeam(true)} onAddVolunteer={() => setAddVolunteer(true)} />}
      {addTeam && <TeamForm all={teamRows} onClose={() => setAddTeam(false)} onSaved={refreshAll} />}
      {addVolunteer && <VolunteerForm onClose={() => setAddVolunteer(false)} onSaved={refreshAll} />}
    </div>
  );
}
