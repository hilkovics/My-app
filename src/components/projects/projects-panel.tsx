import { router } from 'expo-router';
import { useState } from 'react';

import { useDb, useLiveQuery, useNow } from '@/db/hooks';
import { listItemsWithProject } from '@/features/items/repository';
import { listGoals, listProjects } from '@/features/projects/repository';
import { applyTemplate, listTemplates } from '@/features/templates/repository';
import { t } from '@/i18n/sk';

import { Button, Chip, Empty, Row, Section } from '../ui';
import { ProjectCard } from './project-card';

/** "Projekty" view of the Tasks tab. */
export function ProjectsPanel() {
  const db = useDb();
  const now = useNow();
  const [showFinished, setShowFinished] = useState(false);
  const data = useLiveQuery(
    async (d) => ({
      projects: await listProjects(d),
      items: await listItemsWithProject(d),
      goals: await listGoals(d, true),
      templates: await listTemplates(d, 'project'),
    }),
    [],
  );
  if (!data) return null;
  const active = data.projects.filter((p) => p.status === 'active');
  const finished = data.projects.filter((p) => p.status !== 'active');
  const card = (p: (typeof data.projects)[number]) => (
    <ProjectCard
      key={p.id}
      project={p}
      items={data.items.filter((i) => i.projectId === p.id)}
      goal={data.goals.find((g) => g.id === p.goalId)}
      now={now}
    />
  );

  return (
    <>
      <Button variant="secondary" icon="add" label={t.projects.new} onPress={() => router.push('/project/edit')} />
      {data.templates.length ? (
        <Section title={t.projects.fromTemplate}>
          <Row>
            {data.templates.map((tpl) => (
              <Chip
                key={tpl.id}
                label={`${tpl.icon} ${tpl.name}`}
                onPress={() =>
                  void applyTemplate(db, tpl).then(({ id }) => router.push({ pathname: '/project/[id]', params: { id } }))
                }
              />
            ))}
          </Row>
        </Section>
      ) : null}
      {active.length ? active.map(card) : <Empty text={t.projects.empty} />}
      {finished.length ? (
        <>
          <Button
            small
            variant="ghost"
            label={`${t.projects.finished} (${finished.length}) ${showFinished ? '▲' : '▼'}`}
            onPress={() => setShowFinished(!showFinished)}
          />
          {showFinished ? finished.map(card) : null}
        </>
      ) : null}
    </>
  );
}
