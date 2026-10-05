import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Task } from './task.entity.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import {
  ListTasksQueryDto,
  TaskSortField,
} from './dto/list-tasks-query.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { TaskStatus } from './task.entity.js';

const SORT_EXPRESSIONS: Record<TaskSortField, string> = {
  createdAt: 'task.createdAt',
  updatedAt: 'task.updatedAt',
  // Case-insensitive regardless of the database collation.
  title: 'LOWER(task.title)',
  status: 'task.status',
};

// Makes user-supplied %, _ and \ match literally inside ILIKE.
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  findAll(query: ListTasksQueryDto = {}): Promise<Task[]> {
    const { search, status, sort = 'createdAt', order = 'desc' } = query;
    const builder = this.taskRepository.createQueryBuilder('task');

    if (search) {
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('task.title ILIKE :term')
            .orWhere('task.description ILIKE :term');
        }),
        { term: `%${escapeLikePattern(search)}%` },
      );
    }

    if (status) {
      builder.andWhere('task.status = :status', { status });
    }

    // Only allowlisted expressions reach ORDER BY; task.id keeps ties stable.
    return builder
      .orderBy(SORT_EXPRESSIONS[sort], order === 'asc' ? 'ASC' : 'DESC')
      .addOrderBy('task.id', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.taskRepository.findOneBy({ id });

    if (!task) {
      throw new NotFoundException(`Task ${id} was not found`);
    }

    return task;
  }

  create(body: CreateTaskDto): Promise<Task> {
    const task = this.taskRepository.create({
      title: body.title,
      description: body.description ?? '',
      status: TaskStatus.OPEN,
      completed: false,
    });

    return this.taskRepository.save(task);
  }

  async update(id: string, changes: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);

    Object.assign(task, changes);

    if (changes.status) {
      task.completed = changes.status === TaskStatus.COMPLETED;
    } else if (changes.completed !== undefined) {
      task.status = changes.completed ? TaskStatus.COMPLETED : TaskStatus.OPEN;
    }

    return this.taskRepository.save(task);
  }

  async remove(id: string): Promise<void> {
    const result = await this.taskRepository.delete(id);

    if (!result.affected) {
      throw new NotFoundException(`Task ${id} was not found`);
    }
  }
}