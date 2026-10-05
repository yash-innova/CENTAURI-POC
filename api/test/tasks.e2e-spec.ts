import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

// Runs against the local task_tracker database. Every task created here has
// this run's unique prefix, and only those tasks are updated or deleted.
const PREFIX = `e2e-${randomUUID().slice(0, 8)}`;
const AUTH = { Authorization: 'Bearer task-tracker-dev-token' };

type TaskBody = {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'completed';
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

describe('Tasks (e2e)', () => {
  let app: INestApplication<App>;
  const createdIds = new Set<string>();
  const seeded: Record<string, TaskBody> = {};

  const api = () => request(app.getHttpServer());

  async function createTask(title: string, description?: string) {
    const response = await api()
      .post('/tasks')
      .set(AUTH)
      .send({ title: `${PREFIX} ${title}`, description })
      .expect(201);
    createdIds.add(response.body.id);
    return response.body as TaskBody;
  }

  async function listTasks(query: Record<string, string>) {
    const response = await api().get('/tasks').query(query).set(AUTH).expect(200);
    return response.body as TaskBody[];
  }

  // Titles of this run's tasks, in the order the API returned them.
  async function listOwnTitles(query: Record<string, string>) {
    const tasks = await listTasks(query);
    return tasks
      .filter((task) => createdIds.has(task.id))
      .map((task) => task.title.slice(PREFIX.length + 1));
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    // Created sequentially so createdAt order is alpha → echo.
    seeded.alpha = await createTask('alpha report', 'quarterly numbers');
    seeded.bravo = await createTask('Bravo', 'contains REPORT in description');
    seeded.charlie = await createTask('charlie');
    seeded.delta = await createTask('delta 100% done');
    seeded.echo = await createTask('echo 1000 items');

    await api()
      .patch(`/tasks/${seeded.bravo.id}`)
      .set(AUTH)
      .send({ status: 'completed' })
      .expect(200);
    await api()
      .patch(`/tasks/${seeded.echo.id}`)
      .set(AUTH)
      .send({ completed: true })
      .expect(200);
  }, 60_000);

  afterAll(async () => {
    if (app) {
      for (const id of createdIds) {
        await api().delete(`/tasks/${id}`).set(AUTH);
      }
      await app.close();
    }
  });

  describe('GET /tasks without query parameters', () => {
    it('returns all tasks, newest first (backward compatible)', async () => {
      const tasks = await listTasks({});

      const createdAt = tasks.map((task) => Date.parse(task.createdAt));
      expect(createdAt).toEqual([...createdAt].sort((a, b) => b - a));
      expect(await listOwnTitles({})).toEqual([
        'echo 1000 items',
        'delta 100% done',
        'charlie',
        'Bravo',
        'alpha report',
      ]);
    });

    it('treats a whitespace-only search as no search', async () => {
      const all = await listTasks({});
      const blank = await listTasks({ search: '   ' });

      expect(blank.map((task) => task.id)).toEqual(all.map((task) => task.id));
    });
  });

  describe('search', () => {
    it('matches title text case-insensitively', async () => {
      const tasks = await listTasks({ search: `${PREFIX} ALPHA` });

      expect(tasks.map((task) => task.id)).toEqual([seeded.alpha.id]);
    });

    it('matches title or description', async () => {
      expect(await listOwnTitles({ search: 'report' })).toEqual([
        'Bravo',
        'alpha report',
      ]);
    });

    it('returns an empty list when nothing matches', async () => {
      expect(await listTasks({ search: `${PREFIX}-no-such-task` })).toEqual([]);
    });

    it('treats % as a literal character', async () => {
      expect(await listOwnTitles({ search: '100%' })).toEqual([
        'delta 100% done',
      ]);
    });

    it('treats _ as a literal character', async () => {
      expect(await listOwnTitles({ search: '1_00' })).toEqual([]);
    });
  });

  describe('status filter', () => {
    it('returns only open tasks', async () => {
      const tasks = await listTasks({ search: PREFIX, status: 'open' });

      expect(tasks.every((task) => task.status === 'open' && !task.completed)).toBe(true);
      expect(tasks.map((task) => task.id)).toEqual([
        seeded.delta.id,
        seeded.charlie.id,
        seeded.alpha.id,
      ]);
    });

    it('returns only completed tasks', async () => {
      const tasks = await listTasks({ search: PREFIX, status: 'completed' });

      expect(tasks.every((task) => task.status === 'completed' && task.completed)).toBe(true);
      expect(tasks.map((task) => task.id)).toEqual([
        seeded.echo.id,
        seeded.bravo.id,
      ]);
    });
  });

  describe('sorting', () => {
    it('sorts by title ascending, ignoring case', async () => {
      expect(
        await listOwnTitles({ search: PREFIX, sort: 'title', order: 'asc' }),
      ).toEqual([
        'alpha report',
        'Bravo',
        'charlie',
        'delta 100% done',
        'echo 1000 items',
      ]);
    });

    it('sorts by title descending', async () => {
      expect(
        await listOwnTitles({ search: PREFIX, sort: 'title', order: 'desc' }),
      ).toEqual([
        'echo 1000 items',
        'delta 100% done',
        'charlie',
        'Bravo',
        'alpha report',
      ]);
    });

    it('sorts by createdAt ascending', async () => {
      expect(
        await listOwnTitles({ search: PREFIX, sort: 'createdAt', order: 'asc' }),
      ).toEqual([
        'alpha report',
        'Bravo',
        'charlie',
        'delta 100% done',
        'echo 1000 items',
      ]);
    });

    it('defaults to descending order when only sort is given', async () => {
      expect(await listOwnTitles({ search: PREFIX, sort: 'createdAt' })).toEqual([
        'echo 1000 items',
        'delta 100% done',
        'charlie',
        'Bravo',
        'alpha report',
      ]);
    });

    it('sorts by updatedAt descending', async () => {
      const titles = await listOwnTitles({
        search: PREFIX,
        sort: 'updatedAt',
        order: 'desc',
      });

      // echo and bravo were updated after all tasks were created.
      expect(titles.slice(0, 2)).toEqual(['echo 1000 items', 'Bravo']);
    });

    it('sorts by status with open before completed', async () => {
      const tasks = await listTasks({ search: PREFIX, sort: 'status', order: 'asc' });

      expect(tasks.map((task) => task.status)).toEqual([
        'open',
        'open',
        'open',
        'completed',
        'completed',
      ]);
    });
  });

  it('combines search, status and sorting', async () => {
    expect(
      await listOwnTitles({
        search: PREFIX,
        status: 'open',
        sort: 'title',
        order: 'desc',
      }),
    ).toEqual(['delta 100% done', 'charlie', 'alpha report']);
  });

  describe('invalid query parameters', () => {
    it.each([
      [{ status: 'bogus' }, /^status must be/],
      [{ sort: 'password' }, /^sort must be/],
      [{ sort: 'title; DROP TABLE tasks' }, /^sort must be/],
      [{ order: 'sideways' }, /^order must be/],
      [{ completed: 'true' }, /^property completed should not exist$/],
      [{ search: 'a'.repeat(101) }, /^search must be shorter/],
    ])('rejects %j with 400', async (query, message) => {
      const response = await api().get('/tasks').query(query).set(AUTH).expect(400);

      expect(response.body.message).toEqual([expect.stringMatching(message)]);
    });

    it('rejects repeated status parameters with 400', async () => {
      await api().get('/tasks?status=open&status=completed').set(AUTH).expect(400);
    });
  });

  describe('authentication', () => {
    it('requires an Authorization header', async () => {
      const response = await api().get('/tasks').query({ status: 'open' }).expect(401);

      expect(response.body.message).toBe('Authorization header is required');
    });

    it('rejects a wrong token', async () => {
      await api()
        .get('/tasks')
        .set('Authorization', 'Bearer wrong-token')
        .expect(401);
    });

    it('checks authentication before query validation', async () => {
      await api().get('/tasks').query({ sort: 'password' }).expect(401);
    });
  });

  describe('create, read, update and delete (regression)', () => {
    it('creates an open task', async () => {
      const task = await createTask('crud create', 'details');

      expect(task).toMatchObject({
        title: `${PREFIX} crud create`,
        description: 'details',
        status: 'open',
        completed: false,
      });
    });

    it('rejects an empty title', async () => {
      await api().post('/tasks').set(AUTH).send({ title: '' }).expect(400);
    });

    it('reads a task by id and returns 404 for an unknown id', async () => {
      const response = await api()
        .get(`/tasks/${seeded.alpha.id}`)
        .set(AUTH)
        .expect(200);
      expect(response.body.title).toBe(`${PREFIX} alpha report`);

      await api()
        .get('/tasks/00000000-0000-0000-0000-000000000000')
        .set(AUTH)
        .expect(404);
    });

    it('keeps status and completed in sync on update', async () => {
      const task = await createTask('crud update');

      const completed = await api()
        .patch(`/tasks/${task.id}`)
        .set(AUTH)
        .send({ completed: true, title: `${PREFIX} crud updated` })
        .expect(200);
      expect(completed.body).toMatchObject({
        title: `${PREFIX} crud updated`,
        status: 'completed',
        completed: true,
      });

      const reopened = await api()
        .patch(`/tasks/${task.id}`)
        .set(AUTH)
        .send({ status: 'open' })
        .expect(200);
      expect(reopened.body).toMatchObject({ status: 'open', completed: false });
    });

    it('deletes a task', async () => {
      const task = await createTask('crud delete');

      await api().delete(`/tasks/${task.id}`).set(AUTH).expect(200);
      createdIds.delete(task.id);

      await api().get(`/tasks/${task.id}`).set(AUTH).expect(404);
    });
  });
});
