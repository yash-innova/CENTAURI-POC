import { BadRequestException } from '@nestjs/common';
import { createStrictQueryPipe } from '../../strict-query.decorator.js';
import { escapeLikePattern } from '../tasks.service.js';
import { ListTasksQueryDto } from './list-tasks-query.dto.js';

// Runs the same pipe that @StrictQuery() applies to GET /tasks.
function parse(query: Record<string, unknown>): Promise<ListTasksQueryDto> {
  return createStrictQueryPipe().transform(query, {
    type: 'custom',
    metatype: ListTasksQueryDto,
  });
}

async function rejectionMessages(
  query: Record<string, unknown>,
): Promise<string[]> {
  const error = await parse(query).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(BadRequestException);
  const response = (error as BadRequestException).getResponse() as {
    message: string[];
  };
  return response.message;
}

describe('ListTasksQueryDto', () => {
  it('accepts an empty query', async () => {
    await expect(parse({})).resolves.toEqual(new ListTasksQueryDto());
  });

  it('accepts every supported parameter', async () => {
    const query = await parse({
      search: 'report',
      status: 'completed',
      sort: 'title',
      order: 'asc',
    });

    expect(query).toBeInstanceOf(ListTasksQueryDto);
    expect(query).toMatchObject({
      search: 'report',
      status: 'completed',
      sort: 'title',
      order: 'asc',
    });
  });

  it.each(['createdAt', 'updatedAt', 'title', 'status'])(
    'accepts sort=%s',
    async (sort) => {
      await expect(parse({ sort })).resolves.toMatchObject({ sort });
    },
  );

  it('trims search text', async () => {
    await expect(parse({ search: '  report  ' })).resolves.toMatchObject({
      search: 'report',
    });
  });

  it('treats a whitespace-only search as no search', async () => {
    const query = await parse({ search: '   ' });

    expect(query.search).toBeUndefined();
  });

  it('accepts a 100 character search and rejects 101 characters', async () => {
    await expect(parse({ search: 'a'.repeat(100) })).resolves.toBeDefined();
    expect(await rejectionMessages({ search: 'a'.repeat(101) })).toEqual([
      'search must be shorter than or equal to 100 characters',
    ]);
  });

  it.each([
    ['status', 'bogus'],
    ['status', 'OPEN'],
    ['status', ''],
    ['sort', 'password'],
    ['sort', 'title; DROP TABLE tasks'],
    ['sort', 'LOWER(title)'],
    ['sort', ''],
    ['order', 'sideways'],
    ['order', 'ASC'],
    ['order', ''],
  ])('rejects %s=%j', async (key, value) => {
    const messages = await rejectionMessages({ [key]: value });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(new RegExp(`^${key} must be`));
  });

  it('rejects repeated parameters', async () => {
    const messages = await rejectionMessages({
      status: ['open', 'completed'],
    });

    expect(messages[0]).toMatch(/^status must be/);
  });

  it('rejects a non-string search', async () => {
    expect(await rejectionMessages({ search: ['a', 'b'] })).toContain(
      'search must be a string',
    );
  });

  it('rejects unknown query parameters', async () => {
    expect(await rejectionMessages({ completed: 'true' })).toEqual([
      'property completed should not exist',
    ]);
  });
});

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLikePattern('100% done_now\\x')).toBe(
      '100\\% done\\_now\\\\x',
    );
  });

  it('leaves ordinary text unchanged', () => {
    expect(escapeLikePattern('Quarterly report')).toBe('Quarterly report');
  });
});
