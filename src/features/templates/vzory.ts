// Sample templates inserted by the migration (and by "Obnoviť vzory"). None of them repeats.
import type { NotePayload, ProjectPayload, TaskPayload, TemplateKind, TemplatePayload } from './types';

export interface SampleTemplate {
  key: string;
  name: string;
  icon: string;
  kind: TemplateKind;
  payload: TemplatePayload;
}

const task = (p: Partial<TaskPayload> & Pick<TaskPayload, 'title'>): TaskPayload => ({
  body: '',
  tags: [],
  priority: 0,
  checklist: [],
  dueOffsetDays: 0,
  ...p,
});
const note = (p: Partial<NotePayload> & Pick<NotePayload, 'title'>): NotePayload => ({ body: '', tags: [], checklist: [], ...p });

export const SAMPLE_TEMPLATES: SampleTemplate[] = [
  {
    key: 'weekly-review',
    name: 'Týždenná revízia',
    icon: '🗓️',
    kind: 'task',
    payload: task({
      title: 'Týždenná revízia {datum}',
      tags: ['revízia'],
      checklist: [
        'Prejsť kalendár na budúci týždeň',
        'Vyčistiť Inbox úloh',
        'Skontrolovať projekty a ciele',
        'Pozrieť štatistiky fokusu a aktivít',
        'Naplánovať 3 hlavné veci na týždeň',
      ],
    }),
  },
  {
    key: 'meeting',
    name: 'Porada',
    icon: '🤝',
    kind: 'note',
    payload: note({
      title: 'Porada {datum}',
      body: 'Účastníci:\n\nTémy:\n\nRozhodnutia:\n\nÚlohy:\n',
      tags: ['porada'],
    }),
  },
  {
    key: 'shopping',
    name: 'Nákupný zoznam',
    icon: '🛒',
    kind: 'note',
    payload: note({ title: 'Nákup {datum}', tags: ['nákup'], checklist: ['Pečivo', 'Mlieko', 'Ovocie a zelenina'] }),
  },
  {
    key: 'packing',
    name: 'Balenie na cestu',
    icon: '🧳',
    kind: 'task',
    payload: task({
      title: 'Balenie na cestu',
      tags: ['cesta'],
      dueOffsetDays: 1,
      checklist: ['Doklady a peniaze', 'Nabíjačky', 'Oblečenie', 'Hygiena', 'Lieky'],
    }),
  },
  {
    key: 'concert',
    name: 'Koncert / vystúpenie',
    icon: '🎤',
    kind: 'project',
    payload: {
      name: 'Koncert',
      icon: '🎤',
      description: 'Príprava vystúpenia od repertoáru po záverečnú skúšku.',
      deadlineOffsetDays: 42,
      tasks: [
        { title: 'Vybrať repertoár', dueOffsetDays: 7 },
        { title: 'Nacvičiť skladby', dueOffsetDays: 28, checklist: ['Skladba 1', 'Skladba 2', 'Skladba 3'] },
        { title: 'Pripraviť techniku a zvuk', dueOffsetDays: 35 },
        { title: 'Generálka', dueOffsetDays: 40 },
        { title: 'Pozvať ľudí', dueOffsetDays: 21 },
      ],
    } satisfies ProjectPayload,
  },
];
