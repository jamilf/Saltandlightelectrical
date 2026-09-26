// Loads content/milestones.json: the stages of the road to launch and the revision history.
// The current stage, the status block, the revision letter and "last updated" all come from here.
import { join } from 'node:path';
import { SiteError, fillTokens, isIsoDate, isYearMonth, readJson } from './util.mjs';

const ORDER = { done: 0, current: 1, planned: 2 };

export function loadMilestones(root, config) {
  const data = readJson(join(root, 'content', 'milestones.json'));
  const problems = [];
  const need = (condition, message) => {
    if (!condition) problems.push(message);
  };
  const isText = (value) => typeof value === 'string' && value.trim() !== '';

  need(isText(data.drawing?.number) && isText(data.drawing?.title), 'drawing needs a number and a title.');

  const stages = Array.isArray(data.stages) ? data.stages : [];
  need(stages.length >= 2, 'stages needs at least two entries.');
  const ids = new Set();
  const refs = new Set();
  stages.forEach((stage, index) => {
    const label = `Stage ${index + 1} (${stage.id ?? 'no id'})`;
    need(isText(stage.id) && /^[a-z0-9-]+$/.test(stage.id), `${label}: id must be lowercase letters, numbers and hyphens.`);
    need(!ids.has(stage.id), `${label}: id "${stage.id}" is used twice.`);
    need(isText(stage.ref) && !refs.has(stage.ref), `${label}: ref must be set and unique, like S3.`);
    ids.add(stage.id);
    refs.add(stage.ref);
    need(stage.status in ORDER, `${label}: status must be done, current or planned.`);
    need(isText(stage.title) && isText(stage.short) && isText(stage.when), `${label}: needs title, short and when.`);
    need(stage.from === undefined || isYearMonth(stage.from), `${label}: from must look like 2026-03.`);
    need(stage.to === undefined || isYearMonth(stage.to), `${label}: to must look like 2026-03.`);
    need(stage.kind === undefined || stage.kind === 'load', `${label}: kind can only be "load".`);
    need(stage.kind !== 'load' || index === stages.length - 1, `${label}: only the last stage can be the load (the lamp).`);
  });
  if (stages.length) need(stages[stages.length - 1].kind === 'load', 'The last stage must have "kind": "load". It is the lamp at the end of the diagram.');

  for (let index = 1; index < stages.length; index += 1) {
    need(
      ORDER[stages[index - 1].status] <= ORDER[stages[index].status],
      `Stages must run done, then current, then planned. "${stages[index].id}" is out of order.`,
    );
  }
  const current = stages.filter((stage) => stage.status === 'current');
  if (config.mode === 'live') need(current.length <= 1, 'Only one stage can be current.');
  else need(current.length === 1, `Exactly one stage must be current (found ${current.length}).`);

  const revisions = Array.isArray(data.revisions) ? data.revisions : [];
  need(revisions.length > 0, 'revisions needs at least one entry.');
  const letters = new Set();
  for (const revision of revisions) {
    need(isText(revision.rev) && !letters.has(revision.rev), `Revision "${revision.rev}" must be set and unique.`);
    letters.add(revision.rev);
    need(isIsoDate(revision.date), `Revision ${revision.rev}: date must look like 2026-09-26.`);
    need(isText(revision.note), `Revision ${revision.rev}: note is missing.`);
  }

  if (problems.length) throw new SiteError(problems, 'content/milestones.json needs fixing');

  const tokens = { launchYear: config.site.launchYear };
  const filled = stages.map((stage, index) => ({
    ...stage,
    number: index + 1,
    isLoad: stage.kind === 'load',
    isDone: stage.status === 'done',
    isCurrent: stage.status === 'current',
    isPlanned: stage.status === 'planned',
    title: fillTokens(stage.title, tokens),
    when: fillTokens(stage.when, tokens),
    explain: stage.explain ? fillTokens(stage.explain, tokens) : null,
    learning: stage.learning ?? null,
  }));

  const sortedRevisions = [...revisions].sort((a, b) =>
    a.date === b.date ? String(b.rev).localeCompare(String(a.rev)) : b.date.localeCompare(a.date),
  );

  const currentStage = filled.find((stage) => stage.isCurrent) ?? null;
  const currentIndex = currentStage ? filled.indexOf(currentStage) : filled.length - 1;
  return {
    drawing: { ...data.drawing },
    stages: filled,
    current: currentStage,
    next: filled.slice(currentIndex + 1).find((stage) => !stage.isLoad) ?? null,
    done: filled.filter((stage) => stage.isDone),
    load: filled[filled.length - 1],
    revisions: sortedRevisions,
    latest: sortedRevisions[0],
  };
}

/** The stage a post was written in: its own `stage`, else the stage whose dates cover it, else the current one. */
export function stageForDate(milestones, isoDate) {
  const month = isoDate.slice(0, 7);
  const dated = milestones.stages.filter((stage) => stage.from && stage.from <= month && (!stage.to || stage.to >= month));
  if (dated.length) return { stage: dated[dated.length - 1], pinned: false };
  return { stage: milestones.current ?? milestones.done[milestones.done.length - 1] ?? milestones.stages[0], pinned: false };
}
